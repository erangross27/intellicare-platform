const path = require('path');
const mongoose = require(path.resolve(__dirname, '../../../../backend/node_modules/mongoose'));

// Service proxy for lazy loading (prevents circular dependencies)
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ReferralManagementService {
  constructor() {
    this.serviceId = 'referralManagementService';
    this.serviceToken = null;
    this.initialized = false;
    
    // Referral statuses
    this.REFERRAL_STATUS = {
      DRAFT: 'draft',
      REQUESTED: 'requested',
      PENDING_AUTH: 'pending_authorization',
      AUTHORIZED: 'authorized',
      SCHEDULED: 'scheduled',
      ACCEPTED: 'accepted',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
      DENIED: 'denied'
    };

    // Referral priorities
    this.PRIORITY_LEVELS = {
      EMERGENCY: 'emergency',
      URGENT: 'urgent',
      ROUTINE: 'routine',
      ELECTIVE: 'elective'
    };

    // Referral types
    this.REFERRAL_TYPES = {
      INTERNAL: 'internal',
      EXTERNAL: 'external',
      SPECIALIST: 'specialist',
      DIAGNOSTIC: 'diagnostic',
      THERAPY: 'therapy',
      SURGERY: 'surgery'
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Get service authentication
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      const auth = await serviceAccountManager.authenticate(this.serviceId);
      this.serviceToken = auth;
      
      // Initialize referral schema
      await this.initializeSchema();
      
      this.initialized = true;
      console.log('ReferralManagementService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ReferralManagementService:', error);
      throw error;
    }
  }

  getServiceContext(practiceId, operation = 'referral-management') {
    return {
      serviceId: this.serviceId,
      operation: operation,
      practiceId: practiceId
    };
  }

  async initializeSchema() {
    try {
      const referralSchema = {
        referralId: { type: String, required: true, unique: true },
        patientId: { type: String, required: true, encrypted: true },
        referringProviderId: { type: String, required: true },
        receivingProviderId: { type: String },
        specialtyRequired: { type: String },
        type: { type: String, enum: Object.values(this.REFERRAL_TYPES) },
        priority: { type: String, enum: Object.values(this.PRIORITY_LEVELS) },
        status: { type: String, enum: Object.values(this.REFERRAL_STATUS) },
        
        // Medical information
        reasonForReferral: { type: String, encrypted: true },
        clinicalNotes: { type: String, encrypted: true },
        diagnosis: [{
          code: String,
          description: String,
          date: Date
        }],
        attachedDocuments: [{
          documentId: String,
          documentType: String,
          uploadDate: Date
        }],
        
        // Insurance and authorization
        insuranceInfo: {
          providerId: String,
          authorizationNumber: String,
          authorizationStatus: String,
          preAuthRequired: Boolean,
          authorizationDate: Date,
          expirationDate: Date
        },
        
        // Specialist information
        specialistInfo: {
          providerId: String,
          name: String,
          specialty: String,
          facility: String,
          address: Object,
          phone: String,
          fax: String,
          email: String,
          acceptedInsurance: [String]
        },
        
        // Appointment details
        appointmentDetails: {
          scheduledDate: Date,
          appointmentId: String,
          location: String,
          preparationInstructions: String,
          estimatedDuration: Number
        },
        
        // Communication trail
        communications: [{
          type: String, // email, phone, fax, portal
          direction: String, // incoming, outgoing
          timestamp: Date,
          sender: String,
          recipient: String,
          subject: String,
          content: { type: String, encrypted: true },
          attachments: [String]
        }],
        
        // Timeline tracking
        timeline: {
          createdAt: Date,
          requestedAt: Date,
          authorizedAt: Date,
          scheduledAt: Date,
          completedAt: Date,
          followUpDate: Date
        },
        
        // Outcomes and follow-up
        outcomes: {
          visitCompleted: Boolean,
          specialistReport: { type: String, encrypted: true },
          recommendations: { type: String, encrypted: true },
          followUpRequired: Boolean,
          followUpInstructions: String
        },
        
        // Quality metrics
        metrics: {
          daysToSchedule: Number,
          daysToComplete: Number,
          patientSatisfaction: Number,
          outcomeSuccess: Boolean
        },
        
        practiceId: { type: String, required: true },
        createdBy: { type: String, required: true },
        updatedBy: String,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      };
      
      // Store schema definition for SecureDataAccess
      this.schema = referralSchema;
    } catch (error) {
      console.error('Error initializing referral schema:', error);
      throw error;
    }
  }

  // Create new referral request
  async createReferral(referralData, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      const referralId = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const referral = {
        referralId,
        patientId: referralData.patientId,
        referringProviderId: referralData.referringProviderId || context.userId,
        receivingProviderId: referralData.receivingProviderId,
        specialtyRequired: referralData.specialtyRequired,
        type: referralData.type || this.REFERRAL_TYPES.SPECIALIST,
        priority: referralData.priority || this.PRIORITY_LEVELS.ROUTINE,
        status: this.REFERRAL_STATUS.REQUESTED,
        
        reasonForReferral: referralData.reasonForReferral,
        clinicalNotes: referralData.clinicalNotes,
        diagnosis: referralData.diagnosis || [],
        attachedDocuments: referralData.attachedDocuments || [],
        
        insuranceInfo: referralData.insuranceInfo || {},
        specialistInfo: referralData.specialistInfo || {},
        
        timeline: {
          createdAt: new Date(),
          requestedAt: new Date()
        },
        
        communications: [],
        
        practiceId: context.practiceId,
        createdBy: context.userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Save to database
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.create('referrals', referral, this.getServiceContext(context.practiceId, 'create-referral'));
      
      // Log action
      const AuditLog = require('../../../../backend/models/AuditLog');
      await AuditLog.create({
        action: 'REFERRAL_CREATED',
        userId: context.userId,
        practiceId: context.practiceId,
        details: { referralId, patientId: referralData.patientId }
      });
      
      // Send notifications
      await this.sendReferralNotification(referral, 'created', context);
      
      // Check if pre-authorization is required
      if (referralData.insuranceInfo && referralData.insuranceInfo.preAuthRequired) {
        await this.initiatePreAuthorization(referralId, context);
      }
      
      return {
        success: true,
        referralId,
        status: referral.status,
        message: 'Referral request created successfully'
      };
    } catch (error) {
      console.error('Error creating referral:', error);
      throw error;
    }
  }

  // Get specialist network
  async getSpecialistNetwork(specialty, location, insurance, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      // Query specialist database
      const filter = {};
      if (specialty) filter.specialty = specialty;
      if (location) {
        filter['address.city'] = location.city;
        filter['address.state'] = location.state;
      }
      if (insurance) {
        filter.acceptedInsurance = insurance;
      }
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const specialists = await secureDataAccess.query('specialists', filter, {
        limit: 50,
        sort: { rating: -1, availabilityScore: -1 }
      }, this.getServiceContext(context.practiceId, 'query-specialists'));
      
      // Calculate availability and wait times
      const enrichedSpecialists = await Promise.all(specialists.map(async (specialist) => {
        const nextAvailable = await this.getNextAvailableSlot(specialist.providerId);
        const avgWaitTime = await this.getAverageWaitTime(specialist.providerId);
        
        return {
          ...specialist,
          nextAvailable,
          avgWaitTime,
          acceptsNewPatients: specialist.acceptsNewPatients !== false,
          insuranceAccepted: insurance ? specialist.acceptedInsurance?.includes(insurance) : null
        };
      }));
      
      return {
        success: true,
        specialists: enrichedSpecialists,
        totalCount: enrichedSpecialists.length
      };
    } catch (error) {
      console.error('Error getting specialist network:', error);
      throw error;
    }
  }

  // Handle authorization workflow
  async processAuthorization(referralId, authorizationData, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      // Get current referral
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const referrals = await secureDataAccess.query('referrals', 
        { referralId },
        { limit: 1 },
        this.getServiceContext(context.practiceId, 'get-referral')
      );
      
      if (!referrals || referrals.length === 0) {
        throw new Error('Referral not found');
      }
      
      const referral = referrals[0];
      
      // Update authorization info
      const updates = {
        'insuranceInfo.authorizationNumber': authorizationData.authorizationNumber,
        'insuranceInfo.authorizationStatus': authorizationData.status,
        'insuranceInfo.authorizationDate': new Date(),
        'insuranceInfo.expirationDate': authorizationData.expirationDate,
        status: authorizationData.status === 'approved' ? 
                this.REFERRAL_STATUS.AUTHORIZED : 
                this.REFERRAL_STATUS.DENIED,
        'timeline.authorizedAt': authorizationData.status === 'approved' ? new Date() : null
      };
      
      await secureDataAccess.update('referrals',
        { referralId },
        updates,
        this.getServiceContext(context.practiceId, 'update-authorization')
      );
      
      // Log authorization
      const AuditLog = require('../../../../backend/models/AuditLog');
      await AuditLog.create({
        action: 'REFERRAL_AUTHORIZATION_PROCESSED',
        userId: context.userId,
        practiceId: context.practiceId,
        details: {
          referralId,
          authorizationStatus: authorizationData.status,
          authorizationNumber: authorizationData.authorizationNumber
        }
      });
      
      // Send notifications
      await this.sendReferralNotification(referral, 'authorization_update', context);
      
      // If approved, attempt to schedule
      if (authorizationData.status === 'approved') {
        await this.attemptAutoScheduling(referralId, context);
      }
      
      return {
        success: true,
        referralId,
        authorizationStatus: authorizationData.status,
        message: `Referral authorization ${authorizationData.status}`
      };
    } catch (error) {
      console.error('Error processing authorization:', error);
      throw error;
    }
  }

  // Track referral status
  async trackReferral(referralId, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const referrals = await secureDataAccess.query('referrals',
        { referralId },
        { limit: 1 },
        this.getServiceContext(context.practiceId, 'track-referral')
      );
      
      if (!referrals || referrals.length === 0) {
        throw new Error('Referral not found');
      }
      
      const referral = referrals[0];
      
      // Calculate timeline metrics
      const metrics = this.calculateReferralMetrics(referral);
      
      // Get latest communication
      const latestCommunication = referral.communications?.slice(-1)[0];
      
      // Check for any pending actions
      const pendingActions = await this.getPendingActions(referral);
      
      return {
        success: true,
        referral: {
          referralId: referral.referralId,
          status: referral.status,
          priority: referral.priority,
          patientId: referral.patientId,
          specialtyRequired: referral.specialtyRequired,
          timeline: referral.timeline,
          appointmentDetails: referral.appointmentDetails,
          metrics,
          latestCommunication,
          pendingActions
        }
      };
    } catch (error) {
      console.error('Error tracking referral:', error);
      throw error;
    }
  }

  // Inter-provider communication
  async sendDoctorMessage(referralId, message, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const referrals = await secureDataAccess.query('referrals',
        { referralId },
        { limit: 1 },
        this.getServiceContext(context.practiceId, 'get-referral-for-message')
      );
      
      if (!referrals || referrals.length === 0) {
        throw new Error('Referral not found');
      }
      
      const referral = referrals[0];
      
      // Encrypt message content
      const encryptionService = proxy.getService('encryptionService');
      const encryptedContent = await encryptionService.encrypt(message.content, 'phi');
      
      const communication = {
        type: message.type || 'portal',
        direction: message.direction || 'outgoing',
        timestamp: new Date(),
        sender: message.sender || context.userId,
        recipient: message.recipient,
        subject: message.subject,
        content: encryptedContent,
        attachments: message.attachments || []
      };
      
      // Add to communications log
      await secureDataAccess.update('referrals',
        { referralId },
        {
          $push: { communications: communication },
          updatedAt: new Date()
        },
        this.getServiceContext(context.practiceId, 'add-communication')
      );
      
      // Send actual message via appropriate channel
      await this.deliverMessage(communication, referral, context);
      
      // Log communication
      const AuditLog = require('../../../../backend/models/AuditLog');
      await AuditLog.create({
        action: 'REFERRAL_COMMUNICATION_SENT',
        userId: context.userId,
        practiceId: context.practiceId,
        details: {
          referralId,
          messageType: message.type,
          recipient: message.recipient
        }
      });
      
      return {
        success: true,
        message: 'Message sent successfully',
        timestamp: communication.timestamp
      };
    } catch (error) {
      console.error('Error sending provider message:', error);
      throw error;
    }
  }

  // Referral analytics
  async generateReferralAnalytics(dateRange, filters, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      const query = {
        practiceId: context.practiceId,
        createdAt: {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate
        }
      };
      
      if (filters.specialty) query.specialtyRequired = filters.specialty;
      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const referrals = await secureDataAccess.query('referrals', query, {}, this.getServiceContext(context.practiceId, 'analytics-query'));
      
      // Calculate comprehensive analytics
      const analytics = {
        summary: {
          totalReferrals: referrals.length,
          completedReferrals: referrals.filter(r => r.status === this.REFERRAL_STATUS.COMPLETED).length,
          pendingReferrals: referrals.filter(r => [
            this.REFERRAL_STATUS.REQUESTED,
            this.REFERRAL_STATUS.PENDING_AUTH,
            this.REFERRAL_STATUS.SCHEDULED
          ].includes(r.status)).length,
          cancelledReferrals: referrals.filter(r => r.status === this.REFERRAL_STATUS.CANCELLED).length,
          deniedReferrals: referrals.filter(r => r.status === this.REFERRAL_STATUS.DENIED).length
        },
        
        bySpecialty: this.groupBySpecialty(referrals),
        byPriority: this.groupByPriority(referrals),
        
        timeMetrics: {
          avgDaysToSchedule: this.calculateAverage(referrals, 'metrics.daysToSchedule'),
          avgDaysToComplete: this.calculateAverage(referrals, 'metrics.daysToComplete'),
          avgAuthorizationTime: this.calculateAuthorizationTime(referrals)
        },
        
        authorizationMetrics: {
          requiresAuth: referrals.filter(r => r.insuranceInfo?.preAuthRequired).length,
          authApproved: referrals.filter(r => r.insuranceInfo?.authorizationStatus === 'approved').length,
          authDenied: referrals.filter(r => r.insuranceInfo?.authorizationStatus === 'denied').length,
          authPending: referrals.filter(r => r.insuranceInfo?.authorizationStatus === 'pending').length
        },
        
        providerMetrics: this.calculateProviderMetrics(referrals),
        
        trends: this.calculateTrends(referrals, dateRange)
      };
      
      return {
        success: true,
        analytics,
        dateRange,
        filters
      };
    } catch (error) {
      console.error('Error generating referral analytics:', error);
      throw error;
    }
  }

  // Helper: Send referral notifications
  async sendReferralNotification(referral, type, context) {
    try {
      const notifications = [];
      
      switch (type) {
        case 'created':
          notifications.push({
            recipient: referral.receivingProviderId,
            subject: 'New Referral Request',
            message: `New ${referral.priority} priority referral for ${referral.specialtyRequired}`
          });
          break;
          
        case 'authorization_update':
          notifications.push({
            recipient: referral.referringProviderId,
            subject: 'Referral Authorization Update',
            message: `Referral ${referral.referralId} authorization status: ${referral.insuranceInfo?.authorizationStatus}`
          });
          break;
          
        case 'scheduled':
          notifications.push({
            recipient: referral.patientId,
            subject: 'Appointment Scheduled',
            message: `Your referral appointment has been scheduled for ${referral.appointmentDetails?.scheduledDate}`
          });
          break;
      }
      
      // Send all notifications
      // TODO: Implement notification service
      // await Promise.all(notifications.map(n => 
      //   notificationService.sendNotification(n, context)
      // ));
      
    } catch (error) {
      console.error('Error sending referral notification:', error);
    }
  }

  // Helper: Initiate pre-authorization
  async initiatePreAuthorization(referralId, context) {
    try {
      // Integration with insurance authorization service would go here
      console.log(`Initiating pre-authorization for referral ${referralId}`);
      
      // Update referral status
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.update('referrals',
        { referralId },
        {
          status: this.REFERRAL_STATUS.PENDING_AUTH,
          'insuranceInfo.authorizationStatus': 'pending'
        },
        this.getServiceContext(context.practiceId, 'initiate-preauth')
      );
    } catch (error) {
      console.error('Error initiating pre-authorization:', error);
    }
  }

  // Helper: Attempt auto-scheduling
  async attemptAutoScheduling(referralId, context) {
    try {
      // Integration with appointment scheduling service
      console.log(`Attempting auto-scheduling for referral ${referralId}`);
      
      // This would integrate with the appointment scheduling system
      // For now, just update status to indicate ready for scheduling
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.update('referrals',
        { referralId },
        {
          status: this.REFERRAL_STATUS.AUTHORIZED
        },
        this.getServiceContext(context.practiceId, 'auto-schedule')
      );
    } catch (error) {
      console.error('Error in auto-scheduling:', error);
    }
  }

  // Helper: Get next available slot for specialist
  async getNextAvailableSlot(providerId) {
    // This would integrate with the scheduling system
    // For demo purposes, return a date 3-7 days from now
    const daysOut = 3 + Math.floor(Math.random() * 5);
    const date = new Date();
    date.setDate(date.getDate() + daysOut);
    return date;
  }

  // Helper: Get average wait time
  async getAverageWaitTime(providerId) {
    // This would calculate from historical data
    // For demo purposes, return 5-15 days
    return 5 + Math.floor(Math.random() * 11);
  }

  // Helper: Calculate referral metrics
  calculateReferralMetrics(referral) {
    const metrics = {};
    
    if (referral.timeline.createdAt && referral.timeline.scheduledAt) {
      metrics.daysToSchedule = Math.floor(
        (referral.timeline.scheduledAt - referral.timeline.createdAt) / (1000 * 60 * 60 * 24)
      );
    }
    
    if (referral.timeline.createdAt && referral.timeline.completedAt) {
      metrics.daysToComplete = Math.floor(
        (referral.timeline.completedAt - referral.timeline.createdAt) / (1000 * 60 * 60 * 24)
      );
    }
    
    return metrics;
  }

  // Helper: Get pending actions
  async getPendingActions(referral) {
    const actions = [];
    
    if (referral.status === this.REFERRAL_STATUS.REQUESTED) {
      actions.push({ action: 'review', description: 'Review and approve referral' });
    }
    
    if (referral.status === this.REFERRAL_STATUS.PENDING_AUTH) {
      actions.push({ action: 'authorization', description: 'Awaiting insurance authorization' });
    }
    
    if (referral.status === this.REFERRAL_STATUS.AUTHORIZED && !referral.appointmentDetails?.scheduledDate) {
      actions.push({ action: 'schedule', description: 'Schedule appointment with specialist' });
    }
    
    return actions;
  }

  // Helper: Deliver message via appropriate channel
  async deliverMessage(communication, referral, context) {
    // This would integrate with various communication channels
    // For now, log the message delivery
    console.log(`Delivering message via ${communication.type} to ${communication.recipient}`);
  }

  // ========== SPECIALIST NETWORK MANAGEMENT ==========
  
  // Add or update specialist in network
  async addSpecialistToNetwork(specialistData, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      const specialist = {
        providerId: specialistData.providerId || `SP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        name: specialistData.name,
        credentials: specialistData.credentials,
        specialties: Array.isArray(specialistData.specialties) ? specialistData.specialties : [specialistData.specialties],
        
        // Contact information
        contact: {
          phone: specialistData.phone,
          fax: specialistData.fax,
          email: specialistData.email,
          preferredContact: specialistData.preferredContact || 'phone'
        },
        
        // Practice information
        practice: {
          name: specialistData.practiceName,
          address: specialistData.address,
          hours: specialistData.hours,
          acceptingNewPatients: specialistData.acceptingNewPatients !== false
        },
        
        // Network status
        network: {
          status: specialistData.networkStatus || 'in-network',
          contractDate: specialistData.contractDate,
          feeSchedule: specialistData.feeSchedule,
          performanceTier: specialistData.performanceTier || 'standard'
        },
        
        // Insurance acceptance
        acceptedInsurance: specialistData.acceptedInsurance || [],
        
        // Performance metrics
        metrics: {
          averageWaitTime: specialistData.avgWaitTime || 7,
          patientSatisfaction: specialistData.satisfaction || 4.5,
          referralSuccessRate: specialistData.successRate || 0.95,
          responseTime: specialistData.responseTime || 24,
          qualityScore: specialistData.qualityScore || 85
        },
        
        // Availability
        availability: {
          nextAvailable: null,
          typicalWaitDays: specialistData.typicalWaitDays || 7,
          urgentSlots: specialistData.urgentSlots || false,
          telehealth: specialistData.telehealth || false
        },
        
        // Preferences
        preferences: {
          languages: specialistData.languages || ['English'],
          gender: specialistData.gender,
          ageGroups: specialistData.ageGroups || ['adult'],
          specialInterests: specialistData.specialInterests || []
        },
        
        active: true,
        practiceId: context.practiceId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.create('specialists', specialist, this.getServiceContext(context.practiceId, 'add-specialist'));
      
      const AuditLog = require('../../../../backend/models/AuditLog');
      await AuditLog.create({
        action: 'SPECIALIST_ADDED_TO_NETWORK',
        userId: context.userId,
        practiceId: context.practiceId,
        details: { providerId: specialist.providerId, name: specialist.name }
      });
      
      return {
        success: true,
        providerId: specialist.providerId,
        message: 'Specialist added to network successfully'
      };
    } catch (error) {
      console.error('Error adding specialist to network:', error);
      throw error;
    }
  }

  // Match patient to optimal specialist
  async matchPatientToSpecialist(patientId, condition, preferences, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      // Get patient information
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const patients = await secureDataAccess.query('patients',
        { patientId },
        { limit: 1 },
        this.getServiceContext(context.practiceId, 'get-patient-for-matching')
      );
      
      if (!patients || patients.length === 0) {
        throw new Error('Patient not found');
      }
      
      const patient = patients[0];
      
      // Build specialist query based on condition and preferences
      const query = {
        active: true,
        'practice.acceptingNewPatients': true
      };
      
      // Match by condition/diagnosis
      if (condition.diagnosisCode) {
        // Map diagnosis codes to specialties
        const specialty = await this.mapDiagnosisToSpecialty(condition.diagnosisCode);
        if (specialty) {
          query.specialties = specialty;
        }
      } else if (condition.specialty) {
        query.specialties = condition.specialty;
      }
      
      // Apply patient preferences
      if (preferences) {
        if (preferences.gender) {
          query['preferences.gender'] = preferences.gender;
        }
        if (preferences.language) {
          query['preferences.languages'] = preferences.language;
        }
        if (preferences.maxDistance) {
          // Would integrate with geographic search
          query['practice.distance'] = { $lte: preferences.maxDistance };
        }
      }
      
      // Check insurance compatibility
      if (patient.insurance && patient.insurance.provider) {
        query.acceptedInsurance = patient.insurance.provider;
      }
      
      // Get matching specialists
      const specialists = await secureDataAccess.query('specialists', query, {
        sort: { 
          'metrics.qualityScore': -1,
          'metrics.averageWaitTime': 1,
          'metrics.patientSatisfaction': -1
        },
        limit: 10
      }, this.getServiceContext(context.practiceId, 'match-specialists'));
      
      // Score and rank specialists
      const rankedSpecialists = specialists.map(spec => {
        let score = 0;
        
        // Quality score (40% weight)
        score += (spec.metrics.qualityScore / 100) * 40;
        
        // Wait time score (30% weight) - inverse relationship
        const waitScore = Math.max(0, (30 - spec.metrics.averageWaitTime)) / 30;
        score += waitScore * 30;
        
        // Patient satisfaction (20% weight)
        score += (spec.metrics.patientSatisfaction / 5) * 20;
        
        // Network status (10% weight)
        score += spec.network.status === 'in-network' ? 10 : 5;
        
        return {
          ...spec,
          matchScore: score,
          matchReasons: this.generateMatchReasons(spec, condition, preferences)
        };
      }).sort((a, b) => b.matchScore - a.matchScore);
      
      return {
        success: true,
        matches: rankedSpecialists,
        bestMatch: rankedSpecialists[0],
        totalMatches: rankedSpecialists.length
      };
    } catch (error) {
      console.error('Error matching patient to specialist:', error);
      throw error;
    }
  }

  // ========== AUTHORIZATION WORKFLOW MANAGEMENT ==========
  
  // Check if pre-authorization is required
  async checkAuthorizationRequirement(referralData, insuranceInfo, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      // Check authorization rules based on procedure/specialty
      const authRules = await this.getAuthorizationRules(
        referralData.specialty,
        referralData.procedureCode,
        insuranceInfo.provider
      );
      
      const requiresAuth = authRules.some(rule => {
        if (rule.always) return true;
        if (rule.costThreshold && referralData.estimatedCost > rule.costThreshold) return true;
        if (rule.outOfNetwork && referralData.networkStatus === 'out-of-network') return true;
        return false;
      });
      
      return {
        success: true,
        requiresAuthorization: requiresAuth,
        authorizationType: requiresAuth ? authRules[0].type : null,
        requiredDocuments: requiresAuth ? authRules[0].requiredDocuments : [],
        estimatedProcessingTime: requiresAuth ? authRules[0].processingTime : null
      };
    } catch (error) {
      console.error('Error checking authorization requirement:', error);
      throw error;
    }
  }

  // Submit authorization request
  async submitAuthorizationRequest(referralId, authData, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const referrals = await secureDataAccess.query('referrals',
        { referralId },
        { limit: 1 },
        this.getServiceContext(context.practiceId, 'get-referral-for-auth')
      );
      
      if (!referrals || referrals.length === 0) {
        throw new Error('Referral not found');
      }
      
      const referral = referrals[0];
      
      // Create authorization request
      const authRequest = {
        authorizationId: `AUTH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        referralId,
        patientId: referral.patientId,
        
        // Clinical information
        clinical: {
          diagnosis: authData.diagnosis || referral.diagnosis,
          procedureCode: authData.procedureCode,
          medicalNecessity: authData.medicalNecessity,
          clinicalNotes: authData.clinicalNotes
        },
        
        // Supporting documentation
        documentation: {
          attachments: authData.attachments || [],
          labResults: authData.labResults,
          imagingResults: authData.imagingResults,
          previousTreatments: authData.previousTreatments
        },
        
        // Insurance information
        insurance: {
          provider: authData.insuranceProvider,
          memberId: authData.memberId,
          groupNumber: authData.groupNumber,
          authorizationContact: authData.authContact
        },
        
        // Request details
        requestDetails: {
          urgency: authData.urgency || 'routine',
          serviceDate: authData.serviceDate,
          expirationDate: authData.expirationDate,
          numberOfVisits: authData.numberOfVisits || 1
        },
        
        // Status tracking
        status: 'submitted',
        submittedAt: new Date(),
        submittedBy: context.userId,
        
        // Timeline
        timeline: {
          submitted: new Date(),
          lastUpdated: new Date(),
          expectedResponse: new Date(Date.now() + (authData.urgency === 'urgent' ? 2 : 5) * 24 * 60 * 60 * 1000)
        },
        
        practiceId: context.practiceId
      };
      
      // Save authorization request
      await secureDataAccess.create('authorizations', authRequest, this.getServiceContext(context.practiceId, 'create-authorization'));
      
      // Update referral status
      await secureDataAccess.update('referrals',
        { referralId },
        {
          status: this.REFERRAL_STATUS.PENDING_AUTH,
          'insuranceInfo.authorizationId': authRequest.authorizationId,
          'insuranceInfo.authorizationStatus': 'pending'
        },
        this.getServiceContext(context.practiceId, 'update-referral-auth')
      );
      
      // Log submission
      const AuditLog = require('../../../../backend/models/AuditLog');
      await AuditLog.create({
        action: 'AUTHORIZATION_REQUEST_SUBMITTED',
        userId: context.userId,
        practiceId: context.practiceId,
        details: {
          authorizationId: authRequest.authorizationId,
          referralId,
          urgency: authData.urgency
        }
      });
      
      // Send to insurance (would integrate with actual insurance APIs)
      await this.transmitAuthorizationRequest(authRequest, context);
      
      return {
        success: true,
        authorizationId: authRequest.authorizationId,
        status: 'submitted',
        expectedResponseDate: authRequest.timeline.expectedResponse,
        message: 'Authorization request submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting authorization request:', error);
      throw error;
    }
  }

  // Track authorization status
  async trackAuthorizationStatus(authorizationId, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const authorizations = await secureDataAccess.query('authorizations',
        { authorizationId },
        { limit: 1 },
        this.getServiceContext(context.practiceId, 'track-authorization')
      );
      
      if (!authorizations || authorizations.length === 0) {
        throw new Error('Authorization not found');
      }
      
      const authorization = authorizations[0];
      
      // Check for updates from insurance (would integrate with actual APIs)
      const updates = await this.checkAuthorizationUpdates(authorizationId);
      
      if (updates && updates.statusChanged) {
        // Update authorization record
        await secureDataAccess.update('authorizations',
          { authorizationId },
          {
            status: updates.newStatus,
            'timeline.lastUpdated': new Date(),
            decision: updates.decision,
            authorizationNumber: updates.authNumber,
            approvedServices: updates.approvedServices,
            denialReason: updates.denialReason
          },
          this.getServiceContext(context.practiceId, 'update-authorization')
        );
        
        authorization.status = updates.newStatus;
        authorization.decision = updates.decision;
      }
      
      return {
        success: true,
        authorization: {
          authorizationId: authorization.authorizationId,
          status: authorization.status,
          decision: authorization.decision,
          authorizationNumber: authorization.authorizationNumber,
          timeline: authorization.timeline,
          approvedServices: authorization.approvedServices,
          denialReason: authorization.denialReason
        }
      };
    } catch (error) {
      console.error('Error tracking authorization status:', error);
      throw error;
    }
  }

  // Appeal denied authorization
  async appealAuthorization(authorizationId, appealData, context) {
    try {
      if (!this.initialized) await this.initialize();
      
      const appeal = {
        appealId: `APPEAL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        authorizationId,
        
        // Appeal details
        appealReason: appealData.reason,
        additionalDocumentation: appealData.additionalDocs,
        clinicalJustification: appealData.clinicalJustification,
        peerToPeerRequested: appealData.requestPeerToPeer || false,
        
        // Status tracking
        status: 'submitted',
        level: appealData.level || 1,
        submittedAt: new Date(),
        submittedBy: context.userId,
        
        practiceId: context.practiceId
      };
      
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.create('appeals', appeal, this.getServiceContext(context.practiceId, 'create-appeal'));
      
      // Update authorization status
      await secureDataAccess.update('authorizations',
        { authorizationId },
        {
          appealStatus: 'pending',
          appealId: appeal.appealId
        },
        this.getServiceContext(context.practiceId, 'update-auth-appeal')
      );
      
      const AuditLog = require('../../../../backend/models/AuditLog');
      await AuditLog.create({
        action: 'AUTHORIZATION_APPEAL_SUBMITTED',
        userId: context.userId,
        practiceId: context.practiceId,
        details: { appealId: appeal.appealId, authorizationId }
      });
      
      return {
        success: true,
        appealId: appeal.appealId,
        status: 'submitted',
        message: 'Appeal submitted successfully'
      };
    } catch (error) {
      console.error('Error appealing authorization:', error);
      throw error;
    }
  }

  // Helper: Map diagnosis to specialty
  async mapDiagnosisToSpecialty(diagnosisCode) {
    // This would use a comprehensive mapping table
    // For demo, basic mapping
    const mappings = {
      'I10': 'Cardiology',
      'E11': 'Endocrinology',
      'M79.3': 'Rheumatology',
      'G43': 'Neurology',
      'J45': 'Pulmonology'
    };
    
    return mappings[diagnosisCode] || 'Internal Medicine';
  }

  // Helper: Get authorization rules
  async getAuthorizationRules(specialty, procedureCode, insurance) {
    // This would fetch from a rules database
    // For demo, return sample rules
    return [{
      type: 'pre-authorization',
      always: specialty === 'Surgery' || procedureCode?.startsWith('9'),
      costThreshold: 5000,
      outOfNetwork: true,
      requiredDocuments: ['clinical_notes', 'test_results'],
      processingTime: '3-5 business days'
    }];
  }

  // Helper: Generate match reasons
  generateMatchReasons(specialist, condition, preferences) {
    const reasons = [];
    
    if (specialist.network.status === 'in-network') {
      reasons.push('In-network provider');
    }
    
    if (specialist.metrics.averageWaitTime < 7) {
      reasons.push('Short wait time');
    }
    
    if (specialist.metrics.qualityScore > 90) {
      reasons.push('Excellent quality score');
    }
    
    if (specialist.metrics.patientSatisfaction > 4.5) {
      reasons.push('High patient satisfaction');
    }
    
    if (preferences?.language && specialist.preferences.languages.includes(preferences.language)) {
      reasons.push(`Speaks ${preferences.language}`);
    }
    
    return reasons;
  }

  // Helper: Transmit authorization request to insurance
  async transmitAuthorizationRequest(authRequest, context) {
    // This would integrate with actual insurance APIs
    console.log(`Transmitting authorization ${authRequest.authorizationId} to insurance`);
  }

  // Helper: Check for authorization updates
  async checkAuthorizationUpdates(authorizationId) {
    // This would check with insurance APIs for status updates
    // For demo, return null (no updates)
    return null;
  }

  // Helper analytics functions
  groupBySpecialty(referrals) {
    const grouped = {};
    referrals.forEach(r => {
      const specialty = r.specialtyRequired || 'Other';
      if (!grouped[specialty]) grouped[specialty] = 0;
      grouped[specialty]++;
    });
    return grouped;
  }

  groupByPriority(referrals) {
    const grouped = {};
    Object.values(this.PRIORITY_LEVELS).forEach(p => grouped[p] = 0);
    referrals.forEach(r => {
      if (r.priority && grouped[r.priority] !== undefined) {
        grouped[r.priority]++;
      }
    });
    return grouped;
  }

  calculateAverage(items, field) {
    const values = items.map(item => {
      const keys = field.split('.');
      let value = item;
      for (const key of keys) {
        value = value?.[key];
      }
      return value;
    }).filter(v => v !== undefined && v !== null);
    
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  calculateAuthorizationTime(referrals) {
    const authTimes = referrals
      .filter(r => r.timeline?.requestedAt && r.timeline?.authorizedAt)
      .map(r => (r.timeline.authorizedAt - r.timeline.requestedAt) / (1000 * 60 * 60 * 24));
    
    if (authTimes.length === 0) return 0;
    return authTimes.reduce((sum, t) => sum + t, 0) / authTimes.length;
  }

  calculateProviderMetrics(referrals) {
    const providers = {};
    referrals.forEach(r => {
      const id = r.receivingProviderId;
      if (!id) return;
      
      if (!providers[id]) {
        providers[id] = {
          totalReferrals: 0,
          completed: 0,
          avgDaysToComplete: []
        };
      }
      
      providers[id].totalReferrals++;
      if (r.status === this.REFERRAL_STATUS.COMPLETED) {
        providers[id].completed++;
        if (r.metrics?.daysToComplete) {
          providers[id].avgDaysToComplete.push(r.metrics.daysToComplete);
        }
      }
    });
    
    // Calculate averages
    Object.values(providers).forEach(p => {
      if (p.avgDaysToComplete.length > 0) {
        const sum = p.avgDaysToComplete.reduce((a, b) => a + b, 0);
        p.avgDaysToComplete = sum / p.avgDaysToComplete.length;
      } else {
        p.avgDaysToComplete = null;
      }
    });
    
    return providers;
  }

  calculateTrends(referrals, dateRange) {
    // Group by week or month depending on range
    const msPerDay = 1000 * 60 * 60 * 24;
    const rangeDays = (dateRange.endDate - dateRange.startDate) / msPerDay;
    const groupBy = rangeDays > 90 ? 'month' : 'week';
    
    const trends = {};
    referrals.forEach(r => {
      const date = new Date(r.createdAt);
      let key;
      
      if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        const weekNum = Math.floor((date - dateRange.startDate) / (msPerDay * 7));
        key = `Week ${weekNum + 1}`;
      }
      
      if (!trends[key]) trends[key] = 0;
      trends[key]++;
    });
    
    return trends;
  }
}

// Register with ServiceProxy for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('referralManagementService', () => {
    return module.exports;
  });
}

module.exports = new ReferralManagementService();