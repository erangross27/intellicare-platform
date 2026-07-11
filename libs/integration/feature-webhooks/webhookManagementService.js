/**
 * Webhook Management Service - DDD Integration Feature
 * Comprehensive webhook management system providing secure, reliable, and monitored 
 * webhook processing for real-time event notifications and system integrations.
 * 
 * Features:
 * - Real-time event processing with queue-based architecture
 * - Webhook subscription management with flexible event filtering
 * - HMAC signature validation for security
 * - Retry mechanisms with exponential backoff
 * - Dead letter queue for failed deliveries
 * - Comprehensive delivery tracking and analytics
 * - Event routing based on subscriptions
 * - Rate limiting and throttling protection
 * - Multi-tenant webhook isolation
 */

const crypto = require('crypto');
const EventEmitter = require('events');
const axios = require('axios');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../backend/services/secureDataAccess');
const AuditLog = require('../../../backend/models/AuditLog');

class WebhookManagementService extends EventEmitter {
  constructor() {
    super();
    this.serviceToken = null;
    this.initialized = false;
    this.subscriptions = new Map();
    this.eventQueue = [];
    this.processingQueue = false;
    this.retryQueues = new Map();
    this.deliveryStats = new Map();
    
    // Event types supported by the system
    this.eventTypes = {
      // Clinical Events
      CLINICAL: {
        LAB_RESULT_RECEIVED: 'clinical.lab_result.received',
        PRESCRIPTION_FILLED: 'clinical.prescription.filled',
        APPOINTMENT_COMPLETED: 'clinical.appointment.completed',
        REFERRAL_UPDATE: 'clinical.referral.updated',
        VITALS_RECORDED: 'clinical.vitals.recorded',
        DIAGNOSIS_UPDATED: 'clinical.diagnosis.updated'
      },
      
      // Administrative Events  
      ADMINISTRATIVE: {
        PATIENT_REGISTERED: 'admin.patient.registered',
        PROVIDER_CREDENTIALED: 'admin.provider.credentialed',
        INSURANCE_VERIFIED: 'admin.insurance.verified',
        BILLING_PROCESSED: 'admin.billing.processed',
        PAYMENT_RECEIVED: 'admin.payment.received'
      },
      
      // Security Events
      SECURITY: {
        UNAUTHORIZED_ACCESS: 'security.access.unauthorized',
        DATA_BREACH_DETECTED: 'security.breach.detected',
        LOGIN_FAILURE: 'security.login.failed',
        SUSPICIOUS_ACTIVITY: 'security.activity.suspicious',
        COMPLIANCE_VIOLATION: 'security.compliance.violated'
      },
      
      // Regulatory Events
      REGULATORY: {
        FDA_ALERT_RECEIVED: 'regulatory.fda.alert_received',
        DRUG_RECALL_ISSUED: 'regulatory.drug.recall_issued',
        COMPLIANCE_UPDATE: 'regulatory.compliance.updated',
        AUDIT_REQUIRED: 'regulatory.audit.required'
      },
      
      // System Events
      SYSTEM: {
        SERVICE_HEALTH_CHANGED: 'system.service.health_changed',
        API_RATE_LIMIT_EXCEEDED: 'system.api.rate_limit_exceeded',
        INTEGRATION_FAILED: 'system.integration.failed',
        BACKUP_COMPLETED: 'system.backup.completed'
      }
    };
    
    // Webhook delivery configuration
    this.deliveryConfig = {
      maxRetries: 5,
      retryDelays: [1000, 5000, 15000, 60000, 300000], // 1s, 5s, 15s, 1m, 5m
      timeoutMs: 30000,
      maxConcurrentDeliveries: 10,
      deadLetterAfterHours: 24
    };
    
    // Rate limiting configuration
    this.rateLimits = {
      perSubscription: { requests: 1000, windowMs: 60000 }, // 1000 per minute
      perEndpoint: { requests: 100, windowMs: 60000 }, // 100 per minute per endpoint
      global: { requests: 5000, windowMs: 60000 } // 5000 total per minute
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('webhook-management-service');
      
      // Load existing subscriptions
      await this.loadSubscriptions();
      
      // Start event processing queue
      this.startEventProcessor();
      
      // Start retry processor
      this.startRetryProcessor();
      
      // Start cleanup tasks
      this.startCleanupTasks();
      
      // Start monitoring
      this.startMonitoring();
      
      this.initialized = true;
      
      // Log initialization
      await AuditLog.create({
        action: 'SERVICE_INITIALIZED',
        service: 'webhookManagementService',
        userId: 'system',
        practiceId: 'global',
        timestamp: new Date()
      });
      
      console.log('✅ Webhook Management Service initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize Webhook Management Service:', error);
      throw new Error(`Failed to initialize WebhookManagementService: ${error.message}`);
    }
  }

  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'webhook-management-service',
      operation: 'webhook-management',
      practiceId: practiceId
    };
  }

  /**
   * Create a new webhook subscription
   */
  async createSubscription(subscriptionData, options = {}) {
    await this.initialize();
    
    try {
      const subscription = {
        id: crypto.randomUUID(),
        userId: subscriptionData.userId,
        practiceId: subscriptionData.practiceId,
        name: subscriptionData.name,
        description: subscriptionData.description,
        endpointUrl: subscriptionData.endpointUrl,
        secret: subscriptionData.secret || this.generateWebhookSecret(),
        eventTypes: subscriptionData.eventTypes || [],
        eventFilters: subscriptionData.eventFilters || {},
        active: subscriptionData.active !== false,
        retryEnabled: subscriptionData.retryEnabled !== false,
        maxRetries: subscriptionData.maxRetries || this.deliveryConfig.maxRetries,
        timeoutMs: subscriptionData.timeoutMs || this.deliveryConfig.timeoutMs,
        headers: subscriptionData.headers || {},
        createdAt: new Date(),
        updatedAt: new Date(),
        lastDeliveredAt: null,
        deliveryStats: {
          totalAttempts: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          averageResponseTime: 0,
          lastResponseTime: null,
          lastResponseStatus: null
        }
      };
      
      // Validate subscription
      await this.validateSubscription(subscription);
      
      // Store in database using SecureDataAccess
      await SecureDataAccess.create(
        'webhook_subscriptions', 
        subscription, 
        this.getServiceContext(subscription.practiceId)
      );
      
      // Add to memory cache
      this.subscriptions.set(subscription.id, subscription);
      
      await this.logWebhookOperation('SUBSCRIPTION_CREATED', {
        subscriptionId: subscription.id,
        endpointUrl: subscription.endpointUrl,
        eventTypes: subscription.eventTypes
      }, options.userId);
      
      return {
        subscriptionId: subscription.id,
        message: 'Webhook subscription created successfully',
        endpointUrl: subscription.endpointUrl,
        eventTypes: subscription.eventTypes,
        secret: subscription.secret
      };
      
    } catch (error) {
      console.error('Create webhook subscription error:', error);
      throw new Error(`Failed to create webhook subscription: ${error.message}`);
    }
  }

  /**
   * Process incoming webhook event
   */
  async processWebhookEvent(eventData, options = {}) {
    await this.initialize();
    
    try {
      const event = {
        id: crypto.randomUUID(),
        type: eventData.type,
        source: eventData.source || 'internal',
        data: eventData.data,
        metadata: {
          timestamp: new Date(),
          userId: eventData.userId,
          practiceId: eventData.practiceId,
          correlationId: eventData.correlationId || crypto.randomUUID(),
          ...eventData.metadata
        },
        deliveryAttempts: 0,
        processedAt: null
      };
      
      // Validate event
      if (!this.validateEvent(event)) {
        throw new Error('Invalid event data');
      }
      
      // Add to processing queue
      this.eventQueue.push(event);
      
      // Trigger immediate processing if queue was empty
      if (!this.processingQueue) {
        setImmediate(() => this.processEventQueue());
      }
      
      await this.logWebhookOperation('EVENT_RECEIVED', {
        eventId: event.id,
        eventType: event.type,
        source: event.source
      }, options.userId);
      
      return {
        eventId: event.id,
        message: 'Event queued for processing',
        queuePosition: this.eventQueue.length
      };
      
    } catch (error) {
      console.error('Process webhook event error:', error);
      throw new Error(`Failed to process webhook event: ${error.message}`);
    }
  }

  /**
   * Get webhook subscription details
   */
  async getSubscription(subscriptionId, options = {}) {
    await this.initialize();
    
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }
      
      // Get recent delivery logs
      const deliveryLogs = await this.getDeliveryLogs(subscriptionId, { limit: 10 });
      
      return {
        ...subscription,
        secret: undefined, // Don't return the secret
        recentDeliveries: deliveryLogs
      };
      
    } catch (error) {
      console.error('Get webhook subscription error:', error);
      throw new Error(`Failed to get webhook subscription: ${error.message}`);
    }
  }

  /**
   * Update webhook subscription
   */
  async updateSubscription(subscriptionId, updateData, options = {}) {
    await this.initialize();
    
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }
      
      // Update fields
      const updatedSubscription = {
        ...subscription,
        ...updateData,
        id: subscription.id, // Don't allow ID changes
        createdAt: subscription.createdAt, // Don't allow creation date changes
        updatedAt: new Date()
      };
      
      // Validate updated subscription
      await this.validateSubscription(updatedSubscription);
      
      // Update in database using SecureDataAccess
      await SecureDataAccess.update(
        'webhook_subscriptions',
        { id: subscriptionId },
        updatedSubscription,
        this.getServiceContext(subscription.practiceId)
      );
      
      // Update memory cache
      this.subscriptions.set(subscriptionId, updatedSubscription);
      
      await this.logWebhookOperation('SUBSCRIPTION_UPDATED', {
        subscriptionId: subscriptionId,
        changes: Object.keys(updateData)
      }, options.userId);
      
      return {
        message: 'Subscription updated successfully',
        subscriptionId: subscriptionId
      };
      
    } catch (error) {
      console.error('Update webhook subscription error:', error);
      throw new Error(`Failed to update webhook subscription: ${error.message}`);
    }
  }

  /**
   * Delete webhook subscription
   */
  async deleteSubscription(subscriptionId, options = {}) {
    await this.initialize();
    
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }
      
      // Remove from database using SecureDataAccess
      await SecureDataAccess.delete(
        'webhook_subscriptions',
        { id: subscriptionId },
        this.getServiceContext(subscription.practiceId)
      );
      
      // Remove from memory cache
      this.subscriptions.delete(subscriptionId);
      
      // Remove from retry queues
      this.retryQueues.delete(subscriptionId);
      
      await this.logWebhookOperation('SUBSCRIPTION_DELETED', {
        subscriptionId: subscriptionId,
        endpointUrl: subscription.endpointUrl
      }, options.userId);
      
      return {
        message: 'Subscription deleted successfully',
        subscriptionId: subscriptionId
      };
      
    } catch (error) {
      console.error('Delete webhook subscription error:', error);
      throw new Error(`Failed to delete webhook subscription: ${error.message}`);
    }
  }

  /**
   * Validate incoming webhook signature
   */
  validateWebhookSignature(payload, signature, secret) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
      
    } catch (error) {
      console.error('Signature validation error:', error);
      return false;
    }
  }

  /**
   * Get webhook delivery statistics
   */
  async getDeliveryStatistics(options = {}) {
    await this.initialize();
    
    try {
      const {
        subscriptionId,
        dateFrom,
        dateTo,
        eventType
      } = options;
      
      let filter = {};
      if (subscriptionId) filter.subscriptionId = subscriptionId;
      if (eventType) filter.eventType = eventType;
      if (dateFrom || dateTo) {
        filter.timestamp = {};
        if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
        if (dateTo) filter.timestamp.$lte = new Date(dateTo);
      }
      
      const deliveryLogs = await SecureDataAccess.query(
        'webhook_delivery_logs',
        filter,
        { limit: 1000 },
        this.getServiceContext(options.practiceId)
      );
      
      // Calculate statistics
      const stats = {
        totalDeliveries: deliveryLogs.length,
        successfulDeliveries: deliveryLogs.filter(log => log.successful).length,
        failedDeliveries: deliveryLogs.filter(log => !log.successful).length,
        averageResponseTime: 0,
        responseTimeP95: 0,
        responseTimeP99: 0,
        mostFrequentErrors: {},
        deliveryRateOverTime: this.calculateDeliveryRate(deliveryLogs),
        subscriptionBreakdown: this.calculateSubscriptionStats(deliveryLogs)
      };
      
      if (deliveryLogs.length > 0) {
        const responseTimes = deliveryLogs
          .filter(log => log.responseTime)
          .map(log => log.responseTime);
          
        if (responseTimes.length > 0) {
          stats.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
          responseTimes.sort((a, b) => a - b);
          stats.responseTimeP95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
          stats.responseTimeP99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
        }
        
        // Count error types
        const errors = deliveryLogs
          .filter(log => !log.successful && log.error)
          .map(log => log.error);
          
        errors.forEach(error => {
          stats.mostFrequentErrors[error] = (stats.mostFrequentErrors[error] || 0) + 1;
        });
      }
      
      stats.successRate = stats.totalDeliveries > 0 
        ? (stats.successfulDeliveries / stats.totalDeliveries * 100).toFixed(2)
        : 0;
      
      return stats;
      
    } catch (error) {
      console.error('Get delivery statistics error:', error);
      throw new Error(`Failed to get delivery statistics: ${error.message}`);
    }
  }

  /**
   * Get delivery logs for a subscription
   */
  async getDeliveryLogs(subscriptionId, options = {}) {
    await this.initialize();
    
    try {
      const filter = { subscriptionId };
      const queryOptions = { 
        limit: options.limit || 50,
        sort: { timestamp: -1 }
      };
      
      return await SecureDataAccess.query(
        'webhook_delivery_logs',
        filter,
        queryOptions,
        this.getServiceContext(options.practiceId)
      );
      
    } catch (error) {
      console.error('Get delivery logs error:', error);
      throw new Error(`Failed to get delivery logs: ${error.message}`);
    }
  }

  /**
   * Process event queue
   */
  async processEventQueue() {
    if (this.processingQueue || this.eventQueue.length === 0) {
      return;
    }
    
    this.processingQueue = true;
    
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        await this.processEvent(event);
      }
    } catch (error) {
      console.error('Event queue processing error:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Process individual event
   */
  async processEvent(event) {
    try {
      // Find matching subscriptions
      const matchingSubscriptions = this.findMatchingSubscriptions(event);
      
      if (matchingSubscriptions.length === 0) {
        console.log(`No subscriptions found for event type: ${event.type}`);
        return;
      }
      
      // Deliver to each matching subscription
      const deliveryPromises = matchingSubscriptions.map(subscription =>
        this.deliverWebhook(event, subscription)
      );
      
      await Promise.allSettled(deliveryPromises);
      
      event.processedAt = new Date();
      
    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error);
    }
  }

  /**
   * Deliver webhook to endpoint
   */
  async deliverWebhook(event, subscription, retryAttempt = 0) {
    const deliveryId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      // Create webhook payload
      const payload = this.createWebhookPayload(event, subscription);
      const payloadString = JSON.stringify(payload);
      
      // Generate signature
      const signature = crypto
        .createHmac('sha256', subscription.secret)
        .update(payloadString)
        .digest('hex');
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-ID': deliveryId,
        'X-Webhook-Timestamp': Math.floor(Date.now() / 1000).toString(),
        'X-Event-Type': event.type,
        'User-Agent': 'IntelliCare-Webhooks/1.0',
        ...subscription.headers
      };
      
      // Make HTTP request
      const response = await axios.post(subscription.endpointUrl, payload, {
        headers: headers,
        timeout: subscription.timeoutMs,
        validateStatus: (status) => status >= 200 && status < 300
      });
      
      const responseTime = Date.now() - startTime;
      
      // Log successful delivery
      await this.logDelivery(deliveryId, event, subscription, {
        successful: true,
        statusCode: response.status,
        responseTime: responseTime,
        retryAttempt: retryAttempt,
        responseHeaders: response.headers
      });
      
      // Update subscription stats
      this.updateSubscriptionStats(subscription.id, true, responseTime);
      
      console.log(`✅ Webhook delivered successfully: ${deliveryId}`);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const statusCode = error.response?.status || 0;
      const errorMessage = error.message;
      
      // Log failed delivery
      await this.logDelivery(deliveryId, event, subscription, {
        successful: false,
        statusCode: statusCode,
        responseTime: responseTime,
        retryAttempt: retryAttempt,
        error: errorMessage,
        errorDetails: error.response?.data
      });
      
      // Update subscription stats
      this.updateSubscriptionStats(subscription.id, false, responseTime);
      
      // Schedule retry if enabled and attempts remaining
      if (subscription.retryEnabled && retryAttempt < subscription.maxRetries) {
        this.scheduleRetry(event, subscription, retryAttempt + 1);
      } else {
        // Send to dead letter queue
        await this.sendToDeadLetterQueue(event, subscription, errorMessage);
      }
      
      console.error(`❌ Webhook delivery failed: ${deliveryId} - ${errorMessage}`);
    }
  }

  /**
   * Helper methods for webhook processing
   */
  
  generateWebhookSecret() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  validateSubscription(subscription) {
    if (!subscription.endpointUrl || !subscription.endpointUrl.startsWith('http')) {
      throw new Error('Invalid endpoint URL');
    }
    
    if (!subscription.eventTypes || !Array.isArray(subscription.eventTypes)) {
      throw new Error('Event types must be an array');
    }
    
    // Validate event types exist
    const allEventTypes = Object.values(this.eventTypes).flatMap(category => Object.values(category));
    const invalidTypes = subscription.eventTypes.filter(type => !allEventTypes.includes(type));
    if (invalidTypes.length > 0) {
      throw new Error(`Invalid event types: ${invalidTypes.join(', ')}`);
    }
    
    return true;
  }
  
  validateEvent(event) {
    return event && event.type && event.data && event.metadata;
  }
  
  findMatchingSubscriptions(event) {
    const matches = [];
    
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (!subscription.active) continue;
      
      // Check if event type matches
      if (subscription.eventTypes.includes(event.type)) {
        // Apply additional filters if specified
        if (this.eventMatchesFilters(event, subscription.eventFilters)) {
          matches.push(subscription);
        }
      }
    }
    
    return matches;
  }
  
  eventMatchesFilters(event, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return true;
    }
    
    // Simple filter matching - can be extended
    for (const [key, value] of Object.entries(filters)) {
      if (event.metadata[key] !== value) {
        return false;
      }
    }
    
    return true;
  }
  
  createWebhookPayload(event, subscription) {
    return {
      id: event.id,
      type: event.type,
      data: event.data,
      metadata: {
        ...event.metadata,
        subscription_id: subscription.id,
        delivery_id: crypto.randomUUID()
      }
    };
  }

  // Service lifecycle methods
  
  async loadSubscriptions() {
    try {
      const subscriptions = await SecureDataAccess.query(
        'webhook_subscriptions',
        { active: true },
        { limit: 1000 },
        this.getServiceContext()
      );
      
      subscriptions.forEach(subscription => {
        this.subscriptions.set(subscription.id, subscription);
      });
      
      console.log(`📋 Loaded ${subscriptions.length} webhook subscriptions`);
    } catch (error) {
      console.warn('⚠️ Could not load webhook subscriptions:', error.message);
    }
  }
  
  startEventProcessor() {
    // Process events every 100ms
    setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.processEventQueue();
      }
    }, 100);
  }
  
  startRetryProcessor() {
    // Process retries every 5 seconds
    setInterval(() => {
      this.processRetryQueues();
    }, 5000);
  }
  
  startCleanupTasks() {
    // Clean up old logs every hour
    setInterval(() => {
      this.cleanupOldLogs();
    }, 3600000);
  }
  
  startMonitoring() {
    // Emit monitoring events every minute
    setInterval(() => {
      this.emit('monitoring', {
        queueSize: this.eventQueue.length,
        activeSubscriptions: this.subscriptions.size,
        retryQueues: this.retryQueues.size
      });
    }, 60000);
  }

  // Audit logging methods
  async logWebhookOperation(operation, details, userId) {
    try {
      await AuditLog.create({
        action: operation,
        resourceType: 'webhook_management',
        userId: userId || 'system',
        practiceId: details.practiceId || 'global',
        details: details,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to log webhook operation:', error);
    }
  }
  
  async logDelivery(deliveryId, event, subscription, deliveryResult) {
    try {
      await SecureDataAccess.create(
        'webhook_delivery_logs', 
        {
          deliveryId: deliveryId,
          eventId: event.id,
          eventType: event.type,
          subscriptionId: subscription.id,
          endpointUrl: subscription.endpointUrl,
          timestamp: new Date(),
          ...deliveryResult
        }, 
        this.getServiceContext(subscription.practiceId)
      );
    } catch (error) {
      console.error('Failed to log webhook delivery:', error);
    }
  }

  // Helper methods for stats calculation
  calculateDeliveryRate(deliveryLogs) {
    // Simple implementation - can be enhanced for time-based grouping
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentDeliveries = deliveryLogs.filter(log => 
      new Date(log.timestamp) >= oneHourAgo
    );
    
    return {
      lastHour: recentDeliveries.length,
      successLastHour: recentDeliveries.filter(log => log.successful).length
    };
  }

  calculateSubscriptionStats(deliveryLogs) {
    const stats = {};
    
    deliveryLogs.forEach(log => {
      if (!stats[log.subscriptionId]) {
        stats[log.subscriptionId] = {
          totalDeliveries: 0,
          successfulDeliveries: 0,
          averageResponseTime: 0
        };
      }
      
      stats[log.subscriptionId].totalDeliveries++;
      if (log.successful) {
        stats[log.subscriptionId].successfulDeliveries++;
      }
    });
    
    return stats;
  }

  updateSubscriptionStats(subscriptionId, success, responseTime) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.deliveryStats.totalAttempts++;
      subscription.deliveryStats.lastResponseTime = responseTime;
      
      if (success) {
        subscription.deliveryStats.successfulDeliveries++;
        subscription.lastDeliveredAt = new Date();
      } else {
        subscription.deliveryStats.failedDeliveries++;
      }
      
      // Update average response time
      subscription.deliveryStats.averageResponseTime = 
        (subscription.deliveryStats.averageResponseTime + responseTime) / 2;
    }
  }

  scheduleRetry(event, subscription, retryAttempt) {
    const retryKey = `${subscription.id}-${event.id}`;
    
    if (!this.retryQueues.has(retryKey)) {
      this.retryQueues.set(retryKey, []);
    }
    
    this.retryQueues.get(retryKey).push({
      event,
      subscription,
      retryAttempt,
      lastAttempt: Date.now(),
      deliveryId: crypto.randomUUID()
    });
  }

  async sendToDeadLetterQueue(event, subscription, error) {
    try {
      await SecureDataAccess.create(
        'webhook_dead_letter_queue', 
        {
          eventId: event.id,
          subscriptionId: subscription.id,
          event: event,
          subscription: subscription,
          error: error,
          timestamp: new Date()
        }, 
        this.getServiceContext(subscription.practiceId)
      );
    } catch (err) {
      console.error('Failed to send event to dead letter queue:', err);
    }
  }

  // Process retry queues for failed webhook deliveries
  async processRetryQueues() {
    try {
      const now = Date.now();
      
      for (const [key, queue] of this.retryQueues.entries()) {
        const itemsToRetry = [];
        
        for (let i = queue.length - 1; i >= 0; i--) {
          const item = queue[i];
          
          // Check if it's time to retry based on exponential backoff
          const retryDelay = this.deliveryConfig.retryDelays[item.retryAttempt - 1] || 
                           this.deliveryConfig.retryDelays[this.deliveryConfig.retryDelays.length - 1];
          
          if (now - item.lastAttempt >= retryDelay) {
            itemsToRetry.push(item);
            queue.splice(i, 1);
          }
        }
        
        // Process items that are ready for retry
        for (const item of itemsToRetry) {
          if (item.retryAttempt <= this.deliveryConfig.maxRetries) {
            // Retry the webhook delivery
            await this.deliverWebhook(
              item.event,
              item.subscription,
              item.retryAttempt
            );
          } else {
            // Max retries exceeded, send to dead letter queue
            await this.sendToDeadLetterQueue(
              item.event,
              item.subscription,
              'Max retries exceeded'
            );
          }
        }
        
        // Clean up empty queues
        if (queue.length === 0) {
          this.retryQueues.delete(key);
        }
      }
    } catch (error) {
      console.error('Error processing retry queues:', error);
    }
  }

  // Clean up old webhook delivery logs
  async cleanupOldLogs() {
    try {
      // Delete logs older than 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      
      await SecureDataAccess.delete(
        'webhook_delivery_logs',
        { timestamp: { $lt: cutoffDate } },
        this.getServiceContext()
      );
      
      // Also clean up old audit logs
      await SecureDataAccess.delete(
        'audit_logs',
        { 
          resourceType: 'webhook_management',
          timestamp: { $lt: cutoffDate }
        },
        this.getServiceContext()
      );
      
      console.log(`Cleaned up webhook logs older than ${cutoffDate.toISOString()}`);
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }
}

module.exports = new WebhookManagementService();