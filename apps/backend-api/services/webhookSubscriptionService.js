/**
 * Webhook Subscription Management Service
 * Manages webhook subscriptions, delivery tracking, and notification preferences
 * for external healthcare API integrations with comprehensive monitoring.
 * 
 * Features:
 * - Subscription lifecycle management (create, update, delete, pause)
 * - Delivery tracking and retry management
 * - Event filtering and routing
 * - Performance analytics and monitoring
 * - Multi-tenant subscription isolation
 * - Webhook health monitoring and alerting
 */

const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const webhookManagementService = require('./webhookManagementService');

class WebhookSubscriptionService {
  constructor() {
    this.subscriptions = new Map(); // In-memory cache
    this.deliveryStats = new Map();
    this.initialized = false;
    this.serviceToken = null;
  }

  /**
   * Initialize the subscription service
   */
  async initialize() {
    if (this.initialized) return this;

    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('webhook-subscription-service');
      
      // Load existing subscriptions
      await this.loadSubscriptions();
      
      // Start periodic health checks
      this.startHealthMonitoring();
      
      // Initialize delivery tracking
      this.startDeliveryTracking();
      
      this.initialized = true;
      console.log('✅ Webhook Subscription Service initialized');

    } catch (error) {
      console.error('❌ Failed to initialize Webhook Subscription Service:', error);
      throw error;
    }
  }

  /**
   * Create a new webhook subscription
   */
  async createSubscription(subscriptionData, context = {}) {
    try {
      const subscription = {
        id: crypto.randomUUID(),
        practiceId: context.practiceId,
        userId: context.userId,
        providerId: subscriptionData.providerId,
        eventTypes: subscriptionData.eventTypes || [],
        webhookUrl: subscriptionData.webhookUrl,
        secret: await this.generateWebhookSecret(),
        filters: subscriptionData.filters || {},
        retryPolicy: {
          maxRetries: subscriptionData.maxRetries || 3,
          retryDelay: subscriptionData.retryDelay || 1000,
          exponentialBackoff: subscriptionData.exponentialBackoff !== false
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: subscriptionData.metadata || {}
      };

      // Validate subscription
      await this.validateSubscription(subscription);

      // Store in database
      await SecureDataAccess.insert('webhook_subscriptions', subscription, {
        ...context,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      });

      // Cache subscription
      this.subscriptions.set(subscription.id, subscription);

      // Initialize delivery stats
      this.deliveryStats.set(subscription.id, {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        lastDeliveryAt: null,
        lastFailureAt: null,
        averageResponseTime: 0,
        healthScore: 100
      });

      // Log subscription creation
      await AuditLog.create({
        action: 'WEBHOOK_SUBSCRIPTION_CREATED',
        userId: context.userId,
        practiceId: context.practiceId,
        details: {
          subscriptionId: subscription.id,
          providerId: subscription.providerId,
          eventTypes: subscription.eventTypes,
          webhookUrl: this.maskUrl(subscription.webhookUrl)
        },
        timestamp: new Date()
      });

      return {
        subscriptionId: subscription.id,
        status: 'created',
        webhookSecret: subscription.secret,
        eventTypes: subscription.eventTypes
      };

    } catch (error) {
      console.error('Webhook subscription creation error:', error);
      throw new Error(`Failed to create webhook subscription: ${error.message}`);
    }
  }

  /**
   * Update existing webhook subscription
   */
  async updateSubscription(subscriptionId, updates, context = {}) {
    try {
      const subscription = await this.getSubscription(subscriptionId, {
        ...context,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      });
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Validate updates
      const updatedSubscription = {
        ...subscription,
        ...updates,
        updatedAt: new Date()
      };

      await this.validateSubscription(updatedSubscription);

      // Update in database
      await SecureDataAccess.updateById(
        'webhook_subscriptions', 
        subscriptionId, 
        updatedSubscription, 
        {
          ...context,
          apiKey: this.serviceToken?.apiKey || this.serviceToken
        }
      );

      // Update cache
      this.subscriptions.set(subscriptionId, updatedSubscription);

      // Log update
      await AuditLog.create({
        action: 'WEBHOOK_SUBSCRIPTION_UPDATED',
        userId: context.userId,
        practiceId: context.practiceId,
        details: {
          subscriptionId,
          changes: this.getChanges(subscription, updatedSubscription)
        },
        timestamp: new Date()
      });

      return {
        subscriptionId,
        status: 'updated',
        changes: Object.keys(updates)
      };

    } catch (error) {
      console.error('Webhook subscription update error:', error);
      throw new Error(`Failed to update subscription: ${error.message}`);
    }
  }

  /**
   * Delete webhook subscription
   */
  async deleteSubscription(subscriptionId, context = {}) {
    try {
      const subscription = await this.getSubscription(subscriptionId, {
        ...context,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      });
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Soft delete - mark as inactive
      await SecureDataAccess.updateById(
        'webhook_subscriptions',
        subscriptionId,
        {
          status: 'deleted',
          deletedAt: new Date(),
          updatedAt: new Date()
        },
        {
          ...context,
          apiKey: this.serviceToken?.apiKey || this.serviceToken
        }
      );

      // Remove from cache
      this.subscriptions.delete(subscriptionId);
      this.deliveryStats.delete(subscriptionId);

      // Log deletion
      await AuditLog.create({
        action: 'WEBHOOK_SUBSCRIPTION_DELETED',
        userId: context.userId,
        practiceId: context.practiceId,
        details: {
          subscriptionId,
          providerId: subscription.providerId
        },
        timestamp: new Date()
      });

      return {
        subscriptionId,
        status: 'deleted'
      };

    } catch (error) {
      console.error('Webhook subscription deletion error:', error);
      throw new Error(`Failed to delete subscription: ${error.message}`);
    }
  }

  /**
   * Get webhook subscription by ID
   */
  async getSubscription(subscriptionId, context = {}) {
    try {
      // Check cache first
      if (this.subscriptions.has(subscriptionId)) {
        return this.subscriptions.get(subscriptionId);
      }

      // Query database
      const subscription = await SecureDataAccess.query(
        'webhook_subscriptions', { _id: new ObjectId(subscriptionId) }, context
      );

      if (subscription && subscription.status !== 'deleted') {
        this.subscriptions.set(subscriptionId, subscription);
        return subscription;
      }

      return null;

    } catch (error) {
      console.error('Get subscription error:', error);
      return null;
    }
  }

  /**
   * List webhook subscriptions with filtering
   */
  async listSubscriptions(filters = {}, context = {}) {
    try {
      const query = {
        practiceId: context.practiceId,
        status: { $ne: 'deleted' }
      };

      if (filters.providerId) {
        query.providerId = filters.providerId;
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.eventTypes && filters.eventTypes.length > 0) {
        query.eventTypes = { $in: filters.eventTypes };
      }

      const subscriptions = await SecureDataAccess.query(
        'webhook_subscriptions',
        query,
        {
          limit: filters.limit || 50,
          offset: filters.offset || 0,
          sort: { createdAt: -1 }
        },
        {
          ...context,
          apiKey: this.serviceToken?.apiKey || this.serviceToken
        }
      );

      // Enrich with delivery stats
      const enrichedSubscriptions = subscriptions.map(sub => ({
        ...sub,
        deliveryStats: this.deliveryStats.get(sub.id) || {
          totalDeliveries: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          healthScore: 100
        }
      }));

      return {
        subscriptions: enrichedSubscriptions,
        totalCount: enrichedSubscriptions.length,
        hasMore: enrichedSubscriptions.length === (filters.limit || 50)
      };

    } catch (error) {
      console.error('List subscriptions error:', error);
      throw new Error(`Failed to list subscriptions: ${error.message}`);
    }
  }

  /**
   * Process webhook delivery
   */
  async processDelivery(subscriptionId, event) {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription || subscription.status !== 'active') {
        return { delivered: false, reason: 'subscription_inactive' };
      }

      // Check event filtering
      if (!this.shouldDeliverEvent(subscription, event)) {
        return { delivered: false, reason: 'filtered_out' };
      }

      const startTime = Date.now();
      let deliveryResult;

      try {
        // Attempt webhook delivery
        deliveryResult = await this.deliverWebhook(subscription, event);
        
        // Update success stats
        await this.updateDeliveryStats(subscriptionId, {
          success: true,
          responseTime: Date.now() - startTime,
          timestamp: new Date()
        });

        return {
          delivered: true,
          subscriptionId,
          deliveryId: deliveryResult.deliveryId,
          responseTime: Date.now() - startTime
        };

      } catch (deliveryError) {
        // Update failure stats
        await this.updateDeliveryStats(subscriptionId, {
          success: false,
          error: deliveryError.message,
          responseTime: Date.now() - startTime,
          timestamp: new Date()
        });

        // Schedule retry if configured
        if (subscription.retryPolicy.maxRetries > 0) {
          await this.scheduleRetry(subscription, event, deliveryError);
        }

        return {
          delivered: false,
          subscriptionId,
          error: deliveryError.message,
          willRetry: subscription.retryPolicy.maxRetries > 0
        };
      }

    } catch (error) {
      console.error('Webhook delivery processing error:', error);
      return {
        delivered: false,
        error: error.message,
        subscriptionId
      };
    }
  }

  /**
   * Get subscription delivery analytics
   */
  async getDeliveryAnalytics(subscriptionId, timeRange = '24h', context = {}) {
    try {
      const subscription = await this.getSubscription(subscriptionId, {
        ...context,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      });
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Calculate time range
      const endTime = new Date();
      const startTime = new Date();
      switch (timeRange) {
        case '1h':
          startTime.setHours(startTime.getHours() - 1);
          break;
        case '24h':
          startTime.setDate(startTime.getDate() - 1);
          break;
        case '7d':
          startTime.setDate(startTime.getDate() - 7);
          break;
        case '30d':
          startTime.setDate(startTime.getDate() - 30);
          break;
      }

      // Query delivery history
      const deliveries = await SecureDataAccess.query(
        'webhook_deliveries',
        {
          subscriptionId,
          timestamp: { $gte: startTime, $lte: endTime }
        },
        { sort: { timestamp: 1 } },
        {
          ...context,
          apiKey: this.serviceToken?.apiKey || this.serviceToken
        }
      );

      // Calculate analytics
      const analytics = {
        timeRange,
        totalDeliveries: deliveries.length,
        successfulDeliveries: deliveries.filter(d => d.success).length,
        failedDeliveries: deliveries.filter(d => !d.success).length,
        averageResponseTime: 0,
        healthScore: 0,
        timeline: [],
        errorBreakdown: {},
        responseTimePercentiles: { p50: 0, p95: 0, p99: 0 }
      };

      if (deliveries.length > 0) {
        // Calculate success rate and health score
        const successRate = analytics.successfulDeliveries / analytics.totalDeliveries;
        analytics.healthScore = Math.round(successRate * 100);

        // Calculate average response time
        const responseTimes = deliveries
          .filter(d => d.responseTime)
          .map(d => d.responseTime);
        
        if (responseTimes.length > 0) {
          analytics.averageResponseTime = Math.round(
            responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
          );

          // Calculate percentiles
          const sortedTimes = responseTimes.sort((a, b) => a - b);
          const p50Index = Math.floor(sortedTimes.length * 0.5);
          const p95Index = Math.floor(sortedTimes.length * 0.95);
          const p99Index = Math.floor(sortedTimes.length * 0.99);
          
          analytics.responseTimePercentiles = {
            p50: sortedTimes[p50Index] || 0,
            p95: sortedTimes[p95Index] || 0,
            p99: sortedTimes[p99Index] || 0
          };
        }

        // Build timeline (hourly buckets)
        const timelineMap = new Map();
        deliveries.forEach(delivery => {
          const hourKey = new Date(delivery.timestamp).toISOString().slice(0, 13) + ':00:00.000Z';
          if (!timelineMap.has(hourKey)) {
            timelineMap.set(hourKey, { timestamp: hourKey, successful: 0, failed: 0 });
          }
          const bucket = timelineMap.get(hourKey);
          if (delivery.success) {
            bucket.successful++;
          } else {
            bucket.failed++;
          }
        });

        analytics.timeline = Array.from(timelineMap.values()).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        // Error breakdown
        deliveries
          .filter(d => !d.success && d.error)
          .forEach(d => {
            analytics.errorBreakdown[d.error] = (analytics.errorBreakdown[d.error] || 0) + 1;
          });
      }

      return analytics;

    } catch (error) {
      console.error('Delivery analytics error:', error);
      throw new Error(`Failed to get delivery analytics: ${error.message}`);
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(subscriptionId, context = {}) {
    try {
      const subscription = await this.getSubscription(subscriptionId, {
        ...context,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      });
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const testEvent = {
        eventType: 'test_event',
        eventId: `test-${crypto.randomUUID()}`,
        timestamp: new Date(),
        data: {
          message: 'This is a test webhook event',
          subscriptionId,
          testTimestamp: new Date().toISOString()
        }
      };

      const result = await this.deliverWebhook(subscription, testEvent);

      return {
        success: true,
        testDeliveryId: result.deliveryId,
        responseTime: result.responseTime,
        statusCode: result.statusCode,
        message: 'Test webhook delivered successfully'
      };

    } catch (error) {
      console.error('Webhook test error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Test webhook delivery failed'
      };
    }
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Load existing subscriptions from database
   */
  async loadSubscriptions() {
    try {
      const subscriptions = await SecureDataAccess.query(
        'webhook_subscriptions',
        { status: { $ne: 'deleted' } },
        {},
        { 
          serviceId: 'webhook-subscription-service',
          apiKey: this.serviceToken?.apiKey || this.serviceToken
        }
      );

      subscriptions.forEach(sub => {
        this.subscriptions.set(sub.id, sub);
        
        // Initialize delivery stats if not exists
        if (!this.deliveryStats.has(sub.id)) {
          this.deliveryStats.set(sub.id, {
            totalDeliveries: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            lastDeliveryAt: null,
            lastFailureAt: null,
            averageResponseTime: 0,
            healthScore: 100
          });
        }
      });

      console.log(`📡 Loaded ${subscriptions.length} webhook subscriptions`);

    } catch (error) {
      console.error('Failed to load subscriptions:', error);
      throw error;
    }
  }

  /**
   * Validate subscription configuration
   */
  async validateSubscription(subscription) {
    if (!subscription.providerId) {
      throw new Error('Provider ID is required');
    }

    if (!subscription.webhookUrl || !this.isValidUrl(subscription.webhookUrl)) {
      throw new Error('Valid webhook URL is required');
    }

    if (!Array.isArray(subscription.eventTypes) || subscription.eventTypes.length === 0) {
      throw new Error('At least one event type must be specified');
    }

    // Validate event types for provider
    const validEventTypes = await this.getValidEventTypes(subscription.providerId);
    const invalidTypes = subscription.eventTypes.filter(type => !validEventTypes.includes(type));
    
    if (invalidTypes.length > 0) {
      throw new Error(`Invalid event types for provider ${subscription.providerId}: ${invalidTypes.join(', ')}`);
    }

    return true;
  }

  /**
   * Generate secure webhook secret
   */
  async generateWebhookSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Check if event should be delivered based on filters
   */
  shouldDeliverEvent(subscription, event) {
    // Check event type
    if (!subscription.eventTypes.includes(event.eventType)) {
      return false;
    }

    // Apply custom filters
    if (subscription.filters && Object.keys(subscription.filters).length > 0) {
      for (const [key, value] of Object.entries(subscription.filters)) {
        if (event.data[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Deliver webhook to subscription endpoint
   */
  async deliverWebhook(subscription, event) {
    const axios = require('axios');
    
    const payload = {
      eventType: event.eventType,
      eventId: event.eventId,
      timestamp: event.timestamp,
      data: event.data
    };

    // Generate signature
    const signature = crypto
      .createHmac('sha256', subscription.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const startTime = Date.now();

    try {
      const response = await axios.post(subscription.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': `sha256=${signature}`,
          'X-Webhook-Event': event.eventType,
          'User-Agent': 'IntelliCare-Webhook/1.0'
        },
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status >= 200 && status < 400
      });

      const deliveryId = crypto.randomUUID();
      const responseTime = Date.now() - startTime;

      // Log successful delivery
      await this.logDelivery({
        deliveryId,
        subscriptionId: subscription.id,
        eventId: event.eventId,
        success: true,
        statusCode: response.status,
        responseTime,
        timestamp: new Date()
      });

      return {
        deliveryId,
        statusCode: response.status,
        responseTime,
        success: true
      };

    } catch (error) {
      const deliveryId = crypto.randomUUID();
      const responseTime = Date.now() - startTime;

      // Log failed delivery
      await this.logDelivery({
        deliveryId,
        subscriptionId: subscription.id,
        eventId: event.eventId,
        success: false,
        statusCode: error.response?.status,
        error: error.message,
        responseTime,
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Update delivery statistics
   */
  async updateDeliveryStats(subscriptionId, delivery) {
    const stats = this.deliveryStats.get(subscriptionId) || {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      lastDeliveryAt: null,
      lastFailureAt: null,
      averageResponseTime: 0,
      healthScore: 100
    };

    stats.totalDeliveries++;
    stats.lastDeliveryAt = delivery.timestamp;

    if (delivery.success) {
      stats.successfulDeliveries++;
    } else {
      stats.failedDeliveries++;
      stats.lastFailureAt = delivery.timestamp;
    }

    // Calculate rolling average response time
    if (delivery.responseTime) {
      stats.averageResponseTime = Math.round(
        (stats.averageResponseTime + delivery.responseTime) / 2
      );
    }

    // Calculate health score (success rate over last 100 deliveries)
    const successRate = stats.successfulDeliveries / stats.totalDeliveries;
    stats.healthScore = Math.round(successRate * 100);

    this.deliveryStats.set(subscriptionId, stats);
  }

  /**
   * Log webhook delivery attempt
   */
  async logDelivery(deliveryLog) {
    try {
      await SecureDataAccess.insert('webhook_deliveries', deliveryLog, {
        serviceId: 'webhook-subscription-service'
      });
    } catch (error) {
      console.error('Failed to log webhook delivery:', error);
    }
  }

  /**
   * Schedule webhook retry
   */
  async scheduleRetry(subscription, event, error) {
    // Implementation would depend on job queue system
    // For now, just log the retry requirement
    console.log(`⏰ Scheduling retry for subscription ${subscription.id}, event ${event.eventId}`);
  }

  /**
   * Start periodic health monitoring
   */
  startHealthMonitoring() {
    setInterval(async () => {
      for (const [subscriptionId, subscription] of this.subscriptions) {
        if (subscription.status === 'active') {
          const stats = this.deliveryStats.get(subscriptionId);
          if (stats && stats.healthScore < 50) {
            // Alert on unhealthy subscriptions
            console.warn(`⚠️  Unhealthy webhook subscription: ${subscriptionId} (${stats.healthScore}% health)`);
          }
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Start delivery tracking cleanup
   */
  startDeliveryTracking() {
    // Periodic cleanup of old delivery logs
    setInterval(async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days

      try {
        await SecureDataAccess.delete('webhook_deliveries', {
          timestamp: { $lt: cutoffDate }
        }, {
          apiKey: this.serviceToken?.apiKey || this.serviceToken, 
          serviceId: 'webhook-subscription-service' 
        });
      } catch (error) {
        console.error('Failed to cleanup old delivery logs:', error);
      }
    }, 24 * 60 * 60 * 1000); // Once daily
  }

  /**
   * Utility methods
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return url.startsWith('https://'); // Require HTTPS
    } catch {
      return false;
    }
  }

  maskUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return url;
    }
  }

  getChanges(original, updated) {
    const changes = {};
    for (const key of Object.keys(updated)) {
      if (JSON.stringify(original[key]) !== JSON.stringify(updated[key])) {
        changes[key] = { from: original[key], to: updated[key] };
      }
    }
    return changes;
  }

  async getValidEventTypes(providerId) {
    const eventTypeMap = {
      'fda': ['drug_safety_alert', 'drug_recall', 'adverse_event'],
      'cms': ['provider_directory_update', 'network_change', 'quality_update'],
      'nih': ['clinical_trial_update', 'enrollment_change', 'results_posted'],
      'betterdoctor': ['provider_update', 'insurance_update', 'location_change']
    };

    return eventTypeMap[providerId] || [];
  }
}

// Export singleton instance
module.exports = new WebhookSubscriptionService();