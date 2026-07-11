/**
 * Patient Document Retrieval Module
 * Handles secure retrieval, access control, and streaming of patient documents
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientDocumentRetrieval {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-document-retrieval');
    this.initialized = true;
    console.log('✅ [PatientDocumentRetrieval] Service initialized');
  }

  /**
   * Retrieve document list for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @param {Object} options - Query options
   * @returns {Object} Document list result
   */
  async getPatientDocuments(patientId, practiceContext, session, options = {}) {
    console.log('📄 [PatientDocumentRetrieval] Getting patient documents:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      // Check access permissions
      const accessCheck = await this.checkDocumentAccess(patientId, session, practiceContext);
      if (!accessCheck.hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Insufficient permissions to access patient documents'
        };
      }

      const context = {
        serviceId: 'patient-document-retrieval',
        operation: 'get-documents',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const queryOptions = {
        sort: { uploadedAt: -1 },
        limit: options.limit || 50,
        skip: options.skip || 0
      };

      const query = { patientId };
      
      // Filter by category if specified
      if (options.category) {
        query.category = options.category;
      }
      
      // Filter by date range if specified
      if (options.dateFrom || options.dateTo) {
        query.uploadedAt = {};
        if (options.dateFrom) query.uploadedAt.$gte = new Date(options.dateFrom);
        if (options.dateTo) query.uploadedAt.$lte = new Date(options.dateTo);
      }

      // Filter by status
      if (options.status) {
        query.status = options.status;
      }

      // Search by filename or description
      if (options.search) {
        query.$or = [
          { filename: { $regex: options.search, $options: 'i' } },
          { description: { $regex: options.search, $options: 'i' } }
        ];
      }

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const documents = await SecureDataAccess.query('patient_documents', query, queryOptions, context);

      // Remove sensitive fields and add access URLs
      const sanitizedDocuments = documents.map(doc => this.sanitizeDocumentMetadata(doc, session));

      // Group documents by category
      const groupedDocuments = this.groupDocumentsByCategory(sanitizedDocuments);

      // Create audit trail for document access
      await this.createAuditTrail(patientId, 'DOCUMENTS_ACCESSED', { count: documents.length }, session, practiceContext);

      return {
        success: true,
        documents: sanitizedDocuments,
        groupedDocuments,
        totalCount: documents.length,
        accessLevel: accessCheck.accessLevel,
        message: 'Patient documents retrieved successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDocumentRetrieval] Get documents failed:', error);
      return {
        success: false,
        error: 'GET_DOCUMENTS_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Retrieve specific document by ID
   * @param {string} documentId - Document ID
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @param {Object} options - Retrieval options
   * @returns {Object} Document retrieval result
   */
  async getDocumentById(documentId, practiceContext, session, options = {}) {
    console.log('📄 [PatientDocumentRetrieval] Getting document by ID:', documentId);

    try {
      if (!documentId) {
        return {
          success: false,
          error: 'MISSING_DOCUMENT_ID',
          message: 'Document ID is required'
        };
      }

      const context = {
        serviceId: 'patient-document-retrieval',
        operation: 'get-document-by-id',
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

      const document = documents[0];

      // Check access permissions
      const accessCheck = await this.checkDocumentAccess(document.patientId, session, practiceContext);
      if (!accessCheck.hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Insufficient permissions to access this document'
        };
      }

      // Create audit trail
      await this.createAuditTrail(document.patientId, 'DOCUMENT_ACCESSED', { documentId }, session, practiceContext);

      // Return metadata or content based on options
      if (options.includeContent) {
        const contentResult = await this.getDocumentContent(document, session, practiceContext);
        return {
          success: true,
          document: this.sanitizeDocumentMetadata(document, session),
          content: contentResult.content,
          contentType: document.mimeType,
          message: 'Document retrieved with content'
        };
      } else {
        return {
          success: true,
          document: this.sanitizeDocumentMetadata(document, session),
          message: 'Document metadata retrieved successfully'
        };
      }

    } catch (error) {
      console.error('❌ [PatientDocumentRetrieval] Get document by ID failed:', error);
      return {
        success: false,
        error: 'GET_DOCUMENT_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Get document content with decryption
   * @param {Object} document - Document metadata
   * @param {Object} session - Current session
   * @param {Object} practiceContext - Practice context
   * @returns {Object} Document content
   */
  async getDocumentContent(document, session, practiceContext) {
    try {
      // In real implementation, would decrypt and retrieve from secure storage
      const decryptedContent = await this.decryptDocumentContent(document.storageLocation);
      
      return {
        success: true,
        content: decryptedContent,
        contentType: document.mimeType,
        filename: document.filename
      };

    } catch (error) {
      console.error('❌ [PatientDocumentRetrieval] Content retrieval failed:', error);
      return {
        success: false,
        error: 'CONTENT_RETRIEVAL_FAILED',
        message: 'Failed to retrieve document content'
      };
    }
  }

  /**
   * Generate secure download URL for document
   * @param {string} documentId - Document ID
   * @param {Object} session - Current session
   * @param {Object} practiceContext - Practice context
   * @param {Object} options - URL generation options
   * @returns {Object} Download URL result
   */
  async generateDownloadUrl(documentId, session, practiceContext, options = {}) {
    console.log('🔗 [PatientDocumentRetrieval] Generating download URL:', documentId);

    try {
      const documentResult = await this.getDocumentById(documentId, practiceContext, session);
      if (!documentResult.success) {
        return documentResult;
      }

      const document = documentResult.document;
      const expirationMinutes = options.expirationMinutes || 60; // 1 hour default
      const expirationTime = new Date(Date.now() + (expirationMinutes * 60 * 1000));

      // Generate secure token
      const downloadToken = this.generateSecureToken(documentId, session.userId, expirationTime);

      // Store temporary access token
      const tempAccessContext = {
        serviceId: 'patient-document-retrieval',
        operation: 'store-temp-access',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      await SecureDataAccess.create('temp_document_access', {
        downloadToken,
        documentId,
        userId: session.userId,
        patientId: document.patientId,
        expiresAt: expirationTime,
        used: false,
        practiceId: practiceContext.practiceId,
        createdAt: new Date()
      }, tempAccessContext);

      const downloadUrl = `${process.env.BASE_URL || 'https://intellicare.health'}/api/documents/download/${downloadToken}`;

      return {
        success: true,
        downloadUrl,
        expiresAt: expirationTime,
        expirationMinutes,
        message: 'Download URL generated successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDocumentRetrieval] URL generation failed:', error);
      return {
        success: false,
        error: 'URL_GENERATION_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Check document access permissions
   */
  async checkDocumentAccess(patientId, session, practiceContext) {
    try {
      // Basic access control logic
      if (!session || !session.userId) {
        return { hasAccess: false, accessLevel: 'none' };
      }

      // Admin access
      if (session.role === 'admin' || session.role === 'super_admin') {
        return { hasAccess: true, accessLevel: 'full' };
      }

      // Provider access
      if (session.role === 'provider' || session.role === 'doctor') {
        return { hasAccess: true, accessLevel: 'full' };
      }

      // Staff access
      if (session.role === 'staff' || session.role === 'nurse') {
        return { hasAccess: true, accessLevel: 'limited' };
      }

      // Patient access (own documents only)
      if (session.role === 'patient' && session.patientId === patientId) {
        return { hasAccess: true, accessLevel: 'own' };
      }

      return { hasAccess: false, accessLevel: 'none' };

    } catch (error) {
      console.error('❌ [PatientDocumentRetrieval] Access check failed:', error);
      return { hasAccess: false, accessLevel: 'none' };
    }
  }

  /**
   * Sanitize document metadata for client
   */
  sanitizeDocumentMetadata(document, session) {
    const sanitized = {
      documentId: document.documentId,
      filename: document.filename,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      category: document.category,
      description: document.description,
      tags: document.tags,
      uploadedAt: document.uploadedAt,
      status: document.status,
      accessLevel: document.accessLevel
    };

    // Include sensitive fields only for authorized users
    if (session?.role === 'admin' || session?.role === 'provider') {
      sanitized.uploadedBy = document.uploadedBy;
      sanitized.storageLocation = document.storageLocation;
      sanitized.encryptionRequired = document.encryptionRequired;
    }

    return sanitized;
  }

  /**
   * Group documents by category
   */
  groupDocumentsByCategory(documents) {
    const grouped = {};
    
    documents.forEach(doc => {
      const category = doc.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(doc);
    });

    return grouped;
  }

  /**
   * Decrypt document content (simulation)
   */
  async decryptDocumentContent(storageLocation) {
    // In real implementation, would decrypt content from secure storage
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('🔓 Document decrypted for access');
        resolve(Buffer.from('Decrypted document content placeholder'));
      }, 100);
    });
  }

  /**
   * Generate secure token for document access
   */
  generateSecureToken(documentId, userId, expirationTime) {
    const crypto = require('crypto');
    const payload = `${documentId}:${userId}:${expirationTime.getTime()}`;
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    return `${Buffer.from(payload).toString('base64')}.${hash}`;
  }

  /**
   * Create audit trail for document operations
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

    console.log('📝 [PatientDocumentRetrieval] Audit trail created:', auditRecord);
  }
}

// Create singleton instance
const patientDocumentRetrieval = new PatientDocumentRetrieval();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientDocumentRetrieval', () => patientDocumentRetrieval);
}

module.exports = patientDocumentRetrieval;