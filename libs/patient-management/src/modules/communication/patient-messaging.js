/**
 * Patient Messaging Module
 * Handles secure messaging between healthcare providers and patients with HIPAA compliance
 */

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientMessaging {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-messaging');
    this.initialized = true;
    console.log('✅ [PatientMessaging] Service initialized');
  }

  /**
   * Send message to patient
   * @param {Object} messageData - Message data
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Send result
   */
  async sendMessageToPatient(messageData, practiceContext, session) {
    console.log('💬 [PatientMessaging] Sending message to patient:', messageData.patientId);

    try {
      const validation = this.validateMessageData(messageData);
      if (!validation.success) {
        return validation;
      }

      // Check permissions to message this patient
      const permissionCheck = await this.checkMessagingPermissions(messageData.patientId, session, practiceContext);
      if (!permissionCheck.success) {
        return permissionCheck;
      }

      // Create message thread if it doesn't exist
      const thread = await this.getOrCreateMessageThread(messageData.patientId, session, practiceContext);

      // Create message record
      const messageRecord = {
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        threadId: thread.threadId,
        patientId: messageData.patientId,
        senderId: session.userId,
        senderType: 'provider',
        recipientId: messageData.patientId,
        recipientType: 'patient',
        subject: messageData.subject || 'Message from your healthcare provider',
        content: validation.processedData.content,
        messageType: messageData.messageType || 'general',
        priority: messageData.priority || 'normal',
        status: 'sent',
        readStatus: 'unread',
        attachments: messageData.attachments || [],
        sentAt: new Date(),
        practiceId: practiceContext.practiceId,
        encrypted: true
      };

      const context = {
        serviceId: 'patient-messaging',
        operation: 'send-message',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.create('patient_messages', messageRecord, context);

      // Update thread with last message info
      await this.updateMessageThread(thread.threadId, messageRecord, practiceContext);

      // Send notification to patient
      await this.sendMessageNotification(messageRecord, 'patient', practiceContext);

      // Create audit trail
      await this.createAuditTrail(messageData.patientId, 'MESSAGE_SENT', messageRecord, session, practiceContext);

      return {
        success: true,
        message: result,
        threadId: thread.threadId,
        message: 'Message sent successfully'
      };

    } catch (error) {
      console.error('❌ [PatientMessaging] Send message failed:', error);
      return {
        success: false,
        error: 'SEND_MESSAGE_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Send message to provider
   * @param {Object} messageData - Message data
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Send result
   */
  async sendMessageToProvider(messageData, practiceContext, session) {
    console.log('💬 [PatientMessaging] Sending message to provider:', messageData.providerId);

    try {
      const validation = this.validateMessageData(messageData);
      if (!validation.success) {
        return validation;
      }

      // Verify patient can message this provider
      const permissionCheck = await this.checkPatientMessagingPermissions(messageData.providerId, session, practiceContext);
      if (!permissionCheck.success) {
        return permissionCheck;
      }

      // Create or get message thread
      const thread = await this.getOrCreateMessageThread(session.patientId, session, practiceContext);

      const messageRecord = {
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        threadId: thread.threadId,
        patientId: session.patientId,
        senderId: session.userId,
        senderType: 'patient',
        recipientId: messageData.providerId,
        recipientType: 'provider',
        subject: messageData.subject || 'Message from patient',
        content: validation.processedData.content,
        messageType: messageData.messageType || 'general',
        priority: messageData.priority || 'normal',
        status: 'sent',
        readStatus: 'unread',
        attachments: messageData.attachments || [],
        sentAt: new Date(),
        practiceId: practiceContext.practiceId,
        encrypted: true
      };

      const context = {
        serviceId: 'patient-messaging',
        operation: 'send-message',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.create('patient_messages', messageRecord, context);

      // Update thread
      await this.updateMessageThread(thread.threadId, messageRecord, practiceContext);

      // Send notification to provider
      await this.sendMessageNotification(messageRecord, 'provider', practiceContext);

      // Create audit trail
      await this.createAuditTrail(session.patientId, 'MESSAGE_SENT_TO_PROVIDER', messageRecord, session, practiceContext);

      return {
        success: true,
        message: result,
        threadId: thread.threadId,
        message: 'Message sent successfully'
      };

    } catch (error) {
      console.error('❌ [PatientMessaging] Send message to provider failed:', error);
      return {
        success: false,
        error: 'SEND_MESSAGE_TO_PROVIDER_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get messages for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @param {Object} options - Query options
   * @returns {Object} Messages result
   */
  async getPatientMessages(patientId, practiceContext, session, options = {}) {
    console.log('💬 [PatientMessaging] Getting patient messages:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      // Check access permissions
      const permissionCheck = await this.checkMessageAccessPermissions(patientId, session);
      if (!permissionCheck.success) {
        return permissionCheck;
      }

      const context = {
        serviceId: 'patient-messaging',
        operation: 'get-messages',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const queryOptions = {
        sort: { sentAt: -1 },
        limit: options.limit || 50,
        skip: options.skip || 0
      };

      const query = { patientId };

      // Filter by thread if specified
      if (options.threadId) {
        query.threadId = options.threadId;
      }

      // Filter by status if specified
      if (options.status) {
        query.status = options.status;
      }

      // Filter by read status
      if (options.readStatus) {
        query.readStatus = options.readStatus;
      }

      // Filter by message type
      if (options.messageType) {
        query.messageType = options.messageType;
      }

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const messages = await SecureDataAccess.query('patient_messages', query, queryOptions, context);

      // Group messages by thread
      const threads = this.groupMessagesByThread(messages);

      // Get unread count
      const unreadCount = messages.filter(msg => msg.readStatus === 'unread' && msg.recipientId === session.userId).length;

      return {
        success: true,
        messages,
        threads,
        unreadCount,
        totalCount: messages.length,
        message: 'Patient messages retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientMessaging] Get patient messages failed:', error);
      return {
        success: false,
        error: 'GET_MESSAGES_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Mark message as read
   * @param {string} messageId - Message ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Mark read result
   */
  async markMessageAsRead(messageId, practiceContext, session) {
    console.log('👁️ [PatientMessaging] Marking message as read:', messageId);

    try {
      if (!messageId) {
        return {
          success: false,
          error: 'MISSING_MESSAGE_ID',
          message: 'Message ID is required'
        };
      }

      const context = {
        serviceId: 'patient-messaging',
        operation: 'mark-read',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      // Get message first to verify permissions
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const messages = await SecureDataAccess.query(
        'patient_messages',
        { messageId },
        { limit: 1 },
        context
      );

      if (!messages || messages.length === 0) {
        return {
          success: false,
          error: 'MESSAGE_NOT_FOUND',
          message: 'Message not found'
        };
      }

      const message = messages[0];

      // Verify user is the recipient
      if (message.recipientId !== session.userId) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You can only mark your own messages as read'
        };
      }

      // Update message status
      const result = await SecureDataAccess.update(
        'patient_messages',
        { messageId },
        {
          readStatus: 'read',
          readAt: new Date()
        },
        context
      );

      return {
        success: true,
        messageId,
        readAt: new Date(),
        message: 'Message marked as read'
      };

    } catch (error) {
      console.error('❌ [PatientMessaging] Mark message as read failed:', error);
      return {
        success: false,
        error: 'MARK_READ_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get or create message thread
   */
  async getOrCreateMessageThread(patientId, session, practiceContext) {
    const context = {
      serviceId: 'patient-messaging',
      operation: 'get-or-create-thread',
      practiceId: practiceContext.practiceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    // Check if thread exists
    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    const existingThreads = await SecureDataAccess.query(
      'message_threads',
      { patientId },
      { limit: 1, sort: { createdAt: -1 } },
      context
    );

    if (existingThreads && existingThreads.length > 0) {
      return existingThreads[0];
    }

    // Create new thread
    const thread = {
      threadId: `thread_${patientId}_${Date.now()}`,
      patientId,
      participants: [patientId, session.userId],
      status: 'active',
      lastMessageAt: new Date(),
      messageCount: 0,
      createdAt: new Date(),
      practiceId: practiceContext.practiceId
    };

    await SecureDataAccess.create('message_threads', thread, context);
    return thread;
  }

  /**
   * Update message thread
   */
  async updateMessageThread(threadId, messageRecord, practiceContext) {
    const context = {
      serviceId: 'patient-messaging',
      operation: 'update-thread',
      practiceId: practiceContext.practiceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    await SecureDataAccess.update(
      'message_threads',
      { threadId },
      {
        lastMessageAt: messageRecord.sentAt,
        lastMessageContent: messageRecord.content.substring(0, 100),
        lastMessageSender: messageRecord.senderId,
        $inc: { messageCount: 1 }
      },
      context
    );
  }

  /**
   * Validate message data
   */
  validateMessageData(data) {
    const errors = [];
    const processedData = {};

    if (!data.content || data.content.trim().length === 0) {
      errors.push('Message content is required');
    } else {
      processedData.content = data.content.trim();
      
      // Check content length
      if (processedData.content.length > 5000) {
        errors.push('Message content cannot exceed 5000 characters');
      }
    }

    // Validate message type
    if (data.messageType) {
      const validTypes = ['general', 'appointment', 'prescription', 'test_results', 'urgent', 'billing'];
      if (!validTypes.includes(data.messageType)) {
        errors.push(`Invalid message type. Must be one of: ${validTypes.join(', ')}`);
      }
    }

    // Validate priority
    if (data.priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(data.priority)) {
        errors.push(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
      }
    }

    // Validate subject
    if (data.subject && data.subject.length > 200) {
      errors.push('Subject cannot exceed 200 characters');
    }

    return {
      success: errors.length === 0,
      errors,
      processedData,
      message: errors.length === 0 ? 'Validation passed' : 'Validation failed'
    };
  }

  /**
   * Check messaging permissions
   */
  async checkMessagingPermissions(patientId, session, practiceContext) {
    if (!session || !session.userId) {
      return {
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      };
    }

    // Providers can message their patients
    if (session.role === 'provider' || session.role === 'doctor' || session.role === 'nurse') {
      return { success: true };
    }

    // Admins can message anyone
    if (session.role === 'admin') {
      return { success: true };
    }

    return {
      success: false,
      error: 'INSUFFICIENT_PERMISSIONS',
      message: 'You do not have permission to send messages to patients'
    };
  }

  /**
   * Check patient messaging permissions
   */
  async checkPatientMessagingPermissions(providerId, session, practiceContext) {
    if (!session || !session.patientId) {
      return {
        success: false,
        error: 'PATIENT_AUTHENTICATION_REQUIRED',
        message: 'Patient authentication required'
      };
    }

    // In real implementation, would verify patient-provider relationship
    return { success: true };
  }

  /**
   * Check message access permissions
   */
  async checkMessageAccessPermissions(patientId, session) {
    if (!session || !session.userId) {
      return {
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      };
    }

    // Providers can access patient messages
    if (session.role === 'provider' || session.role === 'doctor' || session.role === 'nurse' || session.role === 'admin') {
      return { success: true };
    }

    // Patients can access their own messages
    if (session.role === 'patient' && session.patientId === patientId) {
      return { success: true };
    }

    return {
      success: false,
      error: 'ACCESS_DENIED',
      message: 'Access denied to patient messages'
    };
  }

  /**
   * Group messages by thread
   */
  groupMessagesByThread(messages) {
    const threads = {};
    
    messages.forEach(message => {
      const threadId = message.threadId;
      if (!threads[threadId]) {
        threads[threadId] = {
          threadId,
          messages: [],
          participantCount: new Set(),
          lastMessage: null,
          unreadCount: 0
        };
      }
      
      threads[threadId].messages.push(message);
      threads[threadId].participantCount.add(message.senderId);
      threads[threadId].participantCount.add(message.recipientId);
      
      if (!threads[threadId].lastMessage || message.sentAt > threads[threadId].lastMessage.sentAt) {
        threads[threadId].lastMessage = message;
      }
      
      if (message.readStatus === 'unread') {
        threads[threadId].unreadCount++;
      }
    });

    // Convert participant count Set to number
    Object.values(threads).forEach(thread => {
      thread.participantCount = thread.participantCount.size;
    });

    return threads;
  }

  /**
   * Send message notification
   */
  async sendMessageNotification(messageRecord, recipientType, practiceContext) {
    // In real implementation, would send email/SMS notifications
    console.log(`📧 [PatientMessaging] Notification sent to ${recipientType} for message:`, messageRecord.messageId);
    
    return {
      notificationId: `notif_${Date.now()}`,
      recipientType,
      method: 'email',
      status: 'sent',
      sentAt: new Date()
    };
  }

  /**
   * Create audit trail for messaging operations
   */
  async createAuditTrail(patientId, action, data, session, practiceContext) {
    const auditRecord = {
      action,
      patientId,
      data: {
        messageId: data.messageId,
        messageType: data.messageType,
        recipientType: data.recipientType
      },
      userId: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientMessaging] Audit trail created:', auditRecord);
  }
}

// Create and export singleton
const patientMessaging = new PatientMessaging();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('patientMessaging', () => patientMessaging);
}

module.exports = patientMessaging;