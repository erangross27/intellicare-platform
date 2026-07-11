/**
 * Patient Notifications Module
 * Handles automated notifications, alerts, and system-generated communications to patients
 */

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientNotifications {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.notificationTypes = this.initializeNotificationTypes();
    this.deliveryMethods = this.initializeDeliveryMethods();
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-notifications');
    this.initialized = true;
    console.log('✅ [PatientNotifications] Service initialized');
  }

  /**
   * Send notification to patient
   * @param {Object} notificationData - Notification data
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Send result
   */
  async sendPatientNotification(notificationData, practiceContext, session) {
    console.log('🔔 [PatientNotifications] Sending notification to patient:', notificationData.patientId);

    try {
      const validation = this.validateNotificationData(notificationData);
      if (!validation.success) {
        return validation;
      }

      // Check patient notification preferences
      const preferences = await this.getPatientNotificationPreferences(notificationData.patientId, practiceContext);
      if (!this.shouldSendNotification(validation.processedData, preferences)) {
        return {
          success: false,
          error: 'NOTIFICATION_BLOCKED',
          message: 'Notification blocked by patient preferences'
        };
      }

      // Create notification record
      const notificationRecord = {
        notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patientId: notificationData.patientId,
        type: validation.processedData.type,
        category: validation.processedData.category,
        title: validation.processedData.title,
        message: validation.processedData.message,
        priority: validation.processedData.priority || 'normal',
        deliveryMethod: validation.processedData.deliveryMethod || 'email',
        scheduledFor: validation.processedData.scheduledFor || new Date(),
        status: 'pending',
        attempts: 0,
        maxAttempts: validation.processedData.maxAttempts || 3,
        metadata: validation.processedData.metadata || {},
        createdAt: new Date(),
        practiceId: practiceContext.practiceId,
        createdBy: session?.userId || 'system'
      };

      const context = {
        serviceId: 'patient-notifications',
        operation: 'send-notification',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.create('patient_notifications', notificationRecord, context);

      // Schedule immediate or delayed delivery
      const deliveryResult = await this.scheduleNotificationDelivery(notificationRecord, practiceContext);

      // Create audit trail
      await this.createAuditTrail(notificationData.patientId, 'NOTIFICATION_SENT', notificationRecord, session, practiceContext);

      return {
        success: true,
        notification: result,
        deliveryScheduled: deliveryResult.success,
        message: 'Notification created and scheduled successfully'
      };

    } catch (error) {
      console.error('❌ [PatientNotifications] Send notification failed:', error);
      return {
        success: false,
        error: 'SEND_NOTIFICATION_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get patient notifications
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - Query options
   * @returns {Object} Notifications result
   */
  async getPatientNotifications(patientId, practiceContext, options = {}) {
    console.log('🔔 [PatientNotifications] Getting patient notifications:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      const context = {
        serviceId: 'patient-notifications',
        operation: 'get-notifications',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const queryOptions = {
        sort: { createdAt: -1 },
        limit: options.limit || 50,
        skip: options.skip || 0
      };

      const query = { patientId };

      // Filter by status if specified
      if (options.status) {
        query.status = options.status;
      }

      // Filter by type if specified
      if (options.type) {
        query.type = options.type;
      }

      // Filter by category if specified
      if (options.category) {
        query.category = options.category;
      }

      // Filter by priority if specified
      if (options.priority) {
        query.priority = options.priority;
      }

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const notifications = await SecureDataAccess.query('patient_notifications', query, queryOptions, context);

      // Get unread count
      const unreadCount = notifications.filter(notif => notif.status === 'delivered' && !notif.readAt).length;

      // Group by category for better organization
      const groupedNotifications = this.groupNotificationsByCategory(notifications);

      return {
        success: true,
        notifications,
        groupedNotifications,
        unreadCount,
        totalCount: notifications.length,
        message: 'Patient notifications retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientNotifications] Get notifications failed:', error);
      return {
        success: false,
        error: 'GET_NOTIFICATIONS_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Mark read result
   */
  async markNotificationAsRead(notificationId, practiceContext, session) {
    console.log('👁️ [PatientNotifications] Marking notification as read:', notificationId);

    try {
      const context = {
        serviceId: 'patient-notifications',
        operation: 'mark-read',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.update(
        'patient_notifications',
        { notificationId },
        {
          readAt: new Date(),
          readBy: session?.userId
        },
        context
      );

      return {
        success: result.matchedCount > 0,
        notificationId,
        readAt: new Date(),
        message: result.matchedCount > 0 ? 'Notification marked as read' : 'Notification not found'
      };

    } catch (error) {
      console.error('❌ [PatientNotifications] Mark as read failed:', error);
      return {
        success: false,
        error: 'MARK_READ_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Process notification delivery queue
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Processing result
   */
  async processNotificationQueue(practiceContext) {
    console.log('⚙️ [PatientNotifications] Processing notification delivery queue');

    try {
      const context = {
        serviceId: 'patient-notifications',
        operation: 'process-queue',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      // Get pending notifications ready for delivery
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const pendingNotifications = await SecureDataAccess.query(
        'patient_notifications',
        {
          status: 'pending',
          scheduledFor: { $lte: new Date() },
          attempts: { $lt: 3 }
        },
        { limit: 100, sort: { scheduledFor: 1 } },
        context
      );

      const deliveryResults = [];

      for (const notification of pendingNotifications) {
        try {
          const deliveryResult = await this.deliverNotification(notification, practiceContext);
          deliveryResults.push({
            notificationId: notification.notificationId,
            success: deliveryResult.success,
            deliveryMethod: notification.deliveryMethod,
            attempts: notification.attempts + 1
          });

          // Update notification status
          await SecureDataAccess.update(
            'patient_notifications',
            { notificationId: notification.notificationId },
            {
              status: deliveryResult.success ? 'delivered' : 'failed',
              attempts: notification.attempts + 1,
              lastAttemptAt: new Date(),
              deliveryError: deliveryResult.success ? null : deliveryResult.error
            },
            context
          );

        } catch (error) {
          console.error(`❌ Notification delivery failed: ${notification.notificationId}`, error);
          deliveryResults.push({
            notificationId: notification.notificationId,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        processedCount: pendingNotifications.length,
        deliveryResults,
        successCount: deliveryResults.filter(r => r.success).length,
        failureCount: deliveryResults.filter(r => !r.success).length,
        message: 'Notification queue processed successfully'
      };

    } catch (error) {
      console.error('❌ [PatientNotifications] Process queue failed:', error);
      return {
        success: false,
        error: 'PROCESS_QUEUE_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Validate notification data
   */
  validateNotificationData(data) {
    const errors = [];
    const processedData = {};

    if (!data.patientId) {
      errors.push('Patient ID is required');
    } else {
      processedData.patientId = data.patientId;
    }

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Notification title is required');
    } else {
      processedData.title = data.title.trim();
    }

    if (!data.message || data.message.trim().length === 0) {
      errors.push('Notification message is required');
    } else {
      processedData.message = data.message.trim();
    }

    // Validate type
    if (data.type) {
      const validTypes = Object.keys(this.notificationTypes);
      if (validTypes.includes(data.type)) {
        processedData.type = data.type;
        processedData.category = this.notificationTypes[data.type].category;
      } else {
        errors.push(`Invalid notification type. Must be one of: ${validTypes.join(', ')}`);
      }
    } else {
      processedData.type = 'general';
      processedData.category = 'general';
    }

    // Validate priority
    if (data.priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (validPriorities.includes(data.priority)) {
        processedData.priority = data.priority;
      } else {
        errors.push(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
      }
    }

    // Validate delivery method
    if (data.deliveryMethod) {
      const validMethods = Object.keys(this.deliveryMethods);
      if (validMethods.includes(data.deliveryMethod)) {
        processedData.deliveryMethod = data.deliveryMethod;
      } else {
        errors.push(`Invalid delivery method. Must be one of: ${validMethods.join(', ')}`);
      }
    }

    // Validate scheduled delivery time
    if (data.scheduledFor) {
      const scheduledDate = new Date(data.scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        errors.push('Invalid scheduled delivery time format');
      } else {
        processedData.scheduledFor = scheduledDate;
      }
    }

    // Optional fields
    if (data.metadata) {
      processedData.metadata = data.metadata;
    }

    if (data.maxAttempts && Number.isInteger(data.maxAttempts) && data.maxAttempts > 0) {
      processedData.maxAttempts = data.maxAttempts;
    }

    return {
      success: errors.length === 0,
      errors,
      processedData,
      message: errors.length === 0 ? 'Validation passed' : 'Validation failed'
    };
  }

  /**
   * Get patient notification preferences
   */
  async getPatientNotificationPreferences(patientId, practiceContext) {
    try {
      const context = {
        serviceId: 'patient-notifications',
        operation: 'get-preferences',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const preferences = await SecureDataAccess.query(
        'patient_notification_preferences',
        { patientId },
        { limit: 1 },
        context
      );

      return preferences && preferences.length > 0 ? preferences[0] : this.getDefaultPreferences();
    } catch (error) {
      console.warn('⚠️ Failed to get patient preferences, using defaults:', error.message);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Check if notification should be sent based on preferences
   */
  shouldSendNotification(notificationData, preferences) {
    // Check global notifications enabled
    if (!preferences.notificationsEnabled) {
      return false;
    }

    // Check category-specific preferences
    const categoryPref = preferences.categories && preferences.categories[notificationData.category];
    if (categoryPref === false) {
      return false;
    }

    // Check delivery method preferences
    const methodPref = preferences.deliveryMethods && preferences.deliveryMethods[notificationData.deliveryMethod];
    if (methodPref === false) {
      return false;
    }

    // Check quiet hours
    if (preferences.quietHours && this.isInQuietHours(new Date(), preferences.quietHours)) {
      return notificationData.priority === 'urgent';
    }

    return true;
  }

  /**
   * Schedule notification delivery
   */
  async scheduleNotificationDelivery(notification, practiceContext) {
    try {
      // For immediate delivery
      if (notification.scheduledFor <= new Date()) {
        return await this.deliverNotification(notification, practiceContext);
      }

      // For scheduled delivery, just return success (will be processed by queue)
      return { success: true, scheduled: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Deliver notification via specified method
   */
  async deliverNotification(notification, practiceContext) {
    try {
      const deliveryMethod = this.deliveryMethods[notification.deliveryMethod];
      if (!deliveryMethod) {
        throw new Error(`Unsupported delivery method: ${notification.deliveryMethod}`);
      }

      // Simulate delivery (in real implementation, would use actual services)
      console.log(`📧 Delivering notification via ${notification.deliveryMethod}: ${notification.title}`);

      return {
        success: true,
        deliveryMethod: notification.deliveryMethod,
        deliveredAt: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        deliveryMethod: notification.deliveryMethod
      };
    }
  }

  /**
   * Initialize notification types
   */
  initializeNotificationTypes() {
    return {
      'appointment_reminder': { category: 'appointments', priority: 'normal' },
      'appointment_confirmation': { category: 'appointments', priority: 'normal' },
      'appointment_cancellation': { category: 'appointments', priority: 'high' },
      'test_results': { category: 'medical', priority: 'high' },
      'prescription_ready': { category: 'pharmacy', priority: 'normal' },
      'prescription_refill': { category: 'pharmacy', priority: 'normal' },
      'billing_statement': { category: 'billing', priority: 'normal' },
      'payment_due': { category: 'billing', priority: 'high' },
      'insurance_update': { category: 'insurance', priority: 'normal' },
      'health_campaign': { category: 'wellness', priority: 'low' },
      'emergency_alert': { category: 'emergency', priority: 'urgent' },
      'general': { category: 'general', priority: 'normal' }
    };
  }

  /**
   * Initialize delivery methods
   */
  initializeDeliveryMethods() {
    return {
      'email': { enabled: true, description: 'Email notification' },
      'sms': { enabled: true, description: 'SMS text message' },
      'push': { enabled: true, description: 'Push notification' },
      'portal': { enabled: true, description: 'Patient portal notification' },
      'phone': { enabled: false, description: 'Phone call' }
    };
  }

  /**
   * Get default notification preferences
   */
  getDefaultPreferences() {
    return {
      notificationsEnabled: true,
      categories: {
        appointments: true,
        medical: true,
        pharmacy: true,
        billing: true,
        insurance: true,
        wellness: false,
        emergency: true,
        general: true
      },
      deliveryMethods: {
        email: true,
        sms: false,
        push: true,
        portal: true,
        phone: false
      },
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00'
      }
    };
  }

  /**
   * Group notifications by category
   */
  groupNotificationsByCategory(notifications) {
    const grouped = {};
    
    notifications.forEach(notification => {
      const category = notification.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(notification);
    });

    return grouped;
  }

  /**
   * Check if current time is in quiet hours
   */
  isInQuietHours(currentTime, quietHours) {
    if (!quietHours.enabled) return false;

    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const startParts = quietHours.start.split(':');
    const startTimeInMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);

    const endParts = quietHours.end.split(':');
    const endTimeInMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

    // Handle overnight quiet hours
    if (startTimeInMinutes > endTimeInMinutes) {
      return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
    } else {
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    }
  }

  /**
   * Create audit trail for notification operations
   */
  async createAuditTrail(patientId, action, data, session, practiceContext) {
    const auditRecord = {
      action,
      patientId,
      data: {
        notificationId: data.notificationId,
        type: data.type,
        deliveryMethod: data.deliveryMethod
      },
      userId: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientNotifications] Audit trail created:', auditRecord);
  }
}

// Create and export singleton
const patientNotifications = new PatientNotifications();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('patientNotifications', () => patientNotifications);
}

module.exports = patientNotifications;