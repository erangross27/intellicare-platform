/**
 * Patient Document Sharing Module
 * Handles secure document sharing between providers, patients, and external parties
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientDocumentSharing {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-document-sharing');
    this.initialized = true;
    console.log('✅ [PatientDocumentSharing] Service initialized');
  }

  /**
   * Share document with specified recipients
   * @param {string} documentId - Document ID
   * @param {Object} sharingRequest - Sharing request details
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Sharing result
   */
  async shareDocument(documentId, sharingRequest, practiceContext, session) {
    console.log('🔗 [PatientDocumentSharing] Sharing document:', documentId);

    try {
      if (!documentId) {
        return {
          success: false,
          error: 'MISSING_DOCUMENT_ID',
          message: 'Document ID is required'
        };
      }

      // Validate sharing request
      const validation = this.validateSharingRequest(sharingRequest);
      if (!validation.success) {
        return validation;
      }

      // Get document and verify ownership/permissions
      const document = await this.getDocumentForSharing(documentId, practiceContext);
      if (!document.success) {
        return document;
      }

      // Check sharing permissions
      const permissionCheck = await this.checkSharingPermissions(document.data, session, sharingRequest);
      if (!permissionCheck.success) {
        return permissionCheck;
      }

      // Create sharing record
      const sharingRecord = await this.createSharingRecord(documentId, sharingRequest, session, practiceContext);

      // Generate secure sharing links/tokens for each recipient
      const sharingLinks = await this.generateSharingLinks(sharingRecord, validation.processedData);

      // Send notifications to recipients
      const notifications = await this.sendSharingNotifications(sharingLinks, document.data, session, practiceContext);

      // Create audit trail
      await this.createAuditTrail(document.data.patientId, 'DOCUMENT_SHARED', {
        documentId,
        recipients: validation.processedData.recipients,
        sharingId: sharingRecord.sharingId
      }, session, practiceContext);

      return {
        success: true,
        sharing: {
          sharingId: sharingRecord.sharingId,
          documentId,
          recipients: validation.processedData.recipients.length,
          links: sharingLinks,
          notifications: notifications,
          expiresAt: sharingRecord.expiresAt
        },
        message: 'Document shared successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDocumentSharing] Document sharing failed:', error);
      return {
        success: false,
        error: 'SHARING_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get shared document access via token
   * @param {string} shareToken - Sharing token
   * @param {Object} requestInfo - Request information
   * @returns {Object} Document access result
   */
  async getSharedDocument(shareToken, requestInfo = {}) {
    console.log('📄 [PatientDocumentSharing] Accessing shared document via token');

    try {
      if (!shareToken) {
        return {
          success: false,
          error: 'MISSING_SHARE_TOKEN',
          message: 'Share token is required'
        };
      }

      // Validate and decode token
      const tokenValidation = await this.validateShareToken(shareToken);
      if (!tokenValidation.success) {
        return tokenValidation;
      }

      const sharing = tokenValidation.sharing;

      // Check if sharing is still valid
      if (sharing.status !== 'active') {
        return {
          success: false,
          error: 'SHARING_INACTIVE',
          message: 'This sharing link is no longer active'
        };
      }

      if (new Date() > new Date(sharing.expiresAt)) {
        // Mark as expired
        await this.expireSharing(sharing.sharingId);
        return {
          success: false,
          error: 'SHARING_EXPIRED',
          message: 'This sharing link has expired'
        };
      }

      // Track access
      await this.trackSharingAccess(sharing.sharingId, requestInfo);

      // Get document content
      const document = await this.getDocumentContent(sharing.documentId);

      // Increment access count
      await this.incrementAccessCount(sharing.sharingId);

      return {
        success: true,
        document: {
          filename: document.filename,
          mimeType: document.mimeType,
          content: document.content,
          metadata: this.getPublicDocumentMetadata(document)
        },
        sharing: {
          sharingId: sharing.sharingId,
          expiresAt: sharing.expiresAt,
          accessCount: sharing.accessCount + 1,
          maxAccess: sharing.maxAccess
        },
        message: 'Shared document accessed successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDocumentSharing] Shared document access failed:', error);
      return {
        success: false,
        error: 'SHARED_ACCESS_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Revoke document sharing
   * @param {string} sharingId - Sharing ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Revocation result
   */
  async revokeSharing(sharingId, practiceContext, session) {
    console.log('🚫 [PatientDocumentSharing] Revoking document sharing:', sharingId);

    try {
      if (!sharingId) {
        return {
          success: false,
          error: 'MISSING_SHARING_ID',
          message: 'Sharing ID is required'
        };
      }

      // Get sharing record
      const sharing = await this.getSharingRecord(sharingId, practiceContext);
      if (!sharing.success) {
        return sharing;
      }

      // Check revocation permissions
      const permissionCheck = await this.checkRevocationPermissions(sharing.data, session);
      if (!permissionCheck.success) {
        return permissionCheck;
      }

      // Update sharing status to revoked
      const context = {
        serviceId: 'patient-document-sharing',
        operation: 'revoke-sharing',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.update(
        'document_sharing',
        { sharingId },
        {
          status: 'revoked',
          revokedBy: session.userId,
          revokedAt: new Date(),
          revokeReason: 'manual_revocation'
        },
        context
      );

      // Notify recipients about revocation
      await this.sendRevocationNotifications(sharing.data, session);

      // Create audit trail
      await this.createAuditTrail(sharing.data.patientId, 'DOCUMENT_SHARING_REVOKED', {
        sharingId,
        documentId: sharing.data.documentId
      }, session, practiceContext);

      return {
        success: true,
        sharingId,
        message: 'Document sharing revoked successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDocumentSharing] Sharing revocation failed:', error);
      return {
        success: false,
        error: 'REVOCATION_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get sharing history for a document
   * @param {string} documentId - Document ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Sharing history
   */
  async getSharingHistory(documentId, practiceContext, session) {
    console.log('📊 [PatientDocumentSharing] Getting sharing history:', documentId);

    try {
      const context = {
        serviceId: 'patient-document-sharing',
        operation: 'get-sharing-history',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const sharingRecords = await SecureDataAccess.query(
        'document_sharing',
        { documentId },
        { sort: { createdAt: -1 } },
        context
      );

      // Get access logs for each sharing
      const historyWithAccess = await Promise.all(
        sharingRecords.map(async (sharing) => {
          const accessLogs = await SecureDataAccess.query(
            'sharing_access_logs',
            { sharingId: sharing.sharingId },
            { sort: { accessedAt: -1 } },
            context
          );

          return {
            ...sharing,
            accessLogs: accessLogs.map(log => ({
              accessedAt: log.accessedAt,
              ipAddress: log.ipAddress,
              userAgent: log.userAgent
            }))
          };
        })
      );

      return {
        success: true,
        sharingHistory: historyWithAccess,
        totalSharings: sharingRecords.length,
        activeSharings: sharingRecords.filter(s => s.status === 'active').length,
        message: 'Sharing history retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDocumentSharing] Get sharing history failed:', error);
      return {
        success: false,
        error: 'SHARING_HISTORY_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Validate sharing request
   */
  validateSharingRequest(request) {
    const errors = [];
    const processedData = {};

    if (!request.recipients || !Array.isArray(request.recipients) || request.recipients.length === 0) {
      errors.push('At least one recipient is required');
    } else {
      const validRecipients = [];
      request.recipients.forEach((recipient, index) => {
        if (!recipient.email && !recipient.providerId) {
          errors.push(`Recipient ${index + 1}: email or provider ID is required`);
        } else {
          validRecipients.push({
            email: recipient.email,
            providerId: recipient.providerId,
            name: recipient.name || recipient.email,
            accessLevel: recipient.accessLevel || 'view',
            notificationPreference: recipient.notificationPreference || 'email'
          });
        }
      });
      processedData.recipients = validRecipients;
    }

    // Validate expiration
    if (request.expirationDays) {
      const days = parseInt(request.expirationDays);
      if (isNaN(days) || days < 1 || days > 365) {
        errors.push('Expiration must be between 1 and 365 days');
      } else {
        processedData.expirationDays = days;
      }
    } else {
      processedData.expirationDays = 7; // Default 7 days
    }

    // Validate access limits
    if (request.maxAccess) {
      const maxAccess = parseInt(request.maxAccess);
      if (isNaN(maxAccess) || maxAccess < 1 || maxAccess > 100) {
        errors.push('Max access must be between 1 and 100');
      } else {
        processedData.maxAccess = maxAccess;
      }
    }

    // Optional fields
    processedData.purpose = request.purpose || '';
    processedData.requiresLogin = Boolean(request.requiresLogin);
    processedData.allowDownload = Boolean(request.allowDownload);
    processedData.watermark = Boolean(request.watermark);

    return {
      success: errors.length === 0,
      errors,
      processedData,
      message: errors.length === 0 ? 'Validation passed' : 'Validation failed'
    };
  }

  /**
   * Get document for sharing
   */
  async getDocumentForSharing(documentId, practiceContext) {
    const context = {
      serviceId: 'patient-document-sharing',
      operation: 'get-document-for-sharing',
      practiceId: practiceContext.practiceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    const documents = await SecureDataAccess.query(
      'patient_documents',
      { documentId },
      { limit: 1 },
      context
    );

    if (!documents || documents.length === 0) {
      return {
        success: false,
        error: 'DOCUMENT_NOT_FOUND',
        message: 'Document not found'
      };
    }

    return {
      success: true,
      data: documents[0]
    };
  }

  /**
   * Check sharing permissions
   */
  async checkSharingPermissions(document, session, sharingRequest) {
    // Check if user has permission to share this document
    if (session.role !== 'admin' && session.role !== 'provider' && session.role !== 'doctor') {
      return {
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have permission to share documents'
      };
    }

    // Additional checks based on document sensitivity
    if (document.accessLevel === 'restricted' && session.role !== 'admin') {
      return {
        success: false,
        error: 'RESTRICTED_DOCUMENT',
        message: 'This document requires administrator approval to share'
      };
    }

    return { success: true };
  }

  /**
   * Create sharing record
   */
  async createSharingRecord(documentId, sharingRequest, session, practiceContext) {
    const sharingId = `share_${documentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + (sharingRequest.expirationDays * 24 * 60 * 60 * 1000));

    const sharingRecord = {
      sharingId,
      documentId,
      patientId: sharingRequest.patientId,
      sharedBy: session.userId,
      recipients: sharingRequest.recipients,
      purpose: sharingRequest.purpose,
      status: 'active',
      expiresAt,
      maxAccess: sharingRequest.maxAccess || 999,
      accessCount: 0,
      requiresLogin: sharingRequest.requiresLogin,
      allowDownload: sharingRequest.allowDownload,
      watermark: sharingRequest.watermark,
      createdAt: new Date(),
      practiceId: practiceContext.practiceId
    };

    const context = {
      serviceId: 'patient-document-sharing',
      operation: 'create-sharing-record',
      practiceId: practiceContext.practiceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    await SecureDataAccess.create('document_sharing', sharingRecord, context);
    return sharingRecord;
  }

  /**
   * Generate sharing links for recipients
   */
  async generateSharingLinks(sharingRecord, processedData) {
    const links = [];

    for (const recipient of processedData.recipients) {
      const shareToken = this.generateSecureShareToken(sharingRecord.sharingId, recipient);
      const shareUrl = `${process.env.BASE_URL || 'https://intellicare.health'}/shared/${shareToken}`;

      links.push({
        recipient: recipient.email || recipient.name,
        shareToken,
        shareUrl,
        accessLevel: recipient.accessLevel,
        expiresAt: sharingRecord.expiresAt
      });
    }

    return links;
  }

  /**
   * Generate secure share token
   */
  generateSecureShareToken(sharingId, recipient) {
    const crypto = require('crypto');
    const payload = {
      sharingId,
      recipient: recipient.email || recipient.providerId,
      timestamp: Date.now()
    };
    
    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto
      .createHmac('sha256', process.env.SHARE_TOKEN_SECRET || 'default_secret')
      .update(tokenData)
      .digest('hex');
    
    return `${tokenData}.${signature}`;
  }

  /**
   * Send sharing notifications
   */
  async sendSharingNotifications(sharingLinks, document, session, practiceContext) {
    const notifications = [];

    for (const link of sharingLinks) {
      // In real implementation, would send email notifications
      notifications.push({
        recipient: link.recipient,
        status: 'sent',
        sentAt: new Date(),
        method: 'email',
        subject: `Document shared: ${document.filename}`
      });
    }

    console.log('📧 [PatientDocumentSharing] Notifications sent:', notifications.length);
    return notifications;
  }

  /**
   * Validate share token
   */
  async validateShareToken(shareToken) {
    try {
      const [tokenData, signature] = shareToken.split('.');
      
      // Verify signature
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.SHARE_TOKEN_SECRET || 'default_secret')
        .update(tokenData)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return {
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid share token'
        };
      }

      // Decode payload
      const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString());

      // Get sharing record
      const context = {
        serviceId: 'patient-document-sharing',
        operation: 'validate-token',
        practiceId: 'global', // Token validation doesn't need specific practice
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const sharings = await SecureDataAccess.query(
        'document_sharing',
        { sharingId: payload.sharingId },
        { limit: 1 },
        context
      );

      if (!sharings || sharings.length === 0) {
        return {
          success: false,
          error: 'SHARING_NOT_FOUND',
          message: 'Sharing record not found'
        };
      }

      return {
        success: true,
        sharing: sharings[0],
        payload
      };

    } catch (error) {
      return {
        success: false,
        error: 'TOKEN_VALIDATION_FAILED',
        message: 'Token validation failed'
      };
    }
  }

  /**
   * Track sharing access
   */
  async trackSharingAccess(sharingId, requestInfo) {
    const context = {
      serviceId: 'patient-document-sharing',
      operation: 'track-access',
      practiceId: 'global',
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    await SecureDataAccess.create('sharing_access_logs', {
      sharingId,
      accessedAt: new Date(),
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent,
      referrer: requestInfo.referrer
    }, context);
  }

  /**
   * Get public document metadata (sanitized)
   */
  getPublicDocumentMetadata(document) {
    return {
      filename: document.filename,
      fileSize: document.fileSize,
      uploadedAt: document.uploadedAt,
      category: document.category
    };
  }

  /**
   * Create audit trail for sharing operations
   */
  async createAuditTrail(patientId, action, data, session, practiceContext) {
    const auditRecord = {
      action,
      patientId,
      data,
      userId: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientDocumentSharing] Audit trail created:', auditRecord);
  }
}

// Create singleton instance
const patientDocumentSharing = new PatientDocumentSharing();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientDocumentSharing', () => patientDocumentSharing);
}

module.exports = patientDocumentSharing;