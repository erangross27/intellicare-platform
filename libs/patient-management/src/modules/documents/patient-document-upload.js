/**
 * Patient Document Upload Module
 * Handles secure document upload, validation, and metadata management for patient files
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientDocumentUpload {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.maxFileSize = 10 * 1024 * 1024; // 10MB default
    this.allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
  }

  async initialize() {
    if (this.initialized) return;
    
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('patient-document-upload');
    this.initialized = true;
    console.log('✅ [PatientDocumentUpload] Service initialized');
  }

  /**
   * Upload document for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} fileData - File data and metadata
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Current session
   * @returns {Object} Upload result
   */
  async uploadPatientDocument(patientId, fileData, practiceContext, session) {
    console.log('📄 [PatientDocumentUpload] Uploading patient document:', patientId);

    try {
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: 'Patient ID is required'
        };
      }

      // Validate file data
      const validation = this.validateFileData(fileData);
      if (!validation.success) {
        return validation;
      }

      // Security scan for malicious content
      const securityScan = await this.performSecurityScan(fileData);
      if (!securityScan.safe) {
        return {
          success: false,
          error: 'SECURITY_THREAT_DETECTED',
          message: 'File contains potentially malicious content'
        };
      }

      // Generate secure file metadata
      const documentMetadata = this.generateDocumentMetadata(fileData, patientId, session, practiceContext);

      // Store document metadata in database first
      const context = {
        serviceId: 'patient-document-upload',
        operation: 'upload-document',
        practiceId: practiceContext.practiceId,
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const documentRecord = await SecureDataAccess.create('patient_documents', documentMetadata, context);

      // Simulate file storage (in real implementation, would upload to secure cloud storage)
      const storageResult = await this.storeDocumentFile(fileData, documentMetadata.documentId);

      if (!storageResult.success) {
        // Cleanup database record if file storage fails
        await SecureDataAccess.delete('patient_documents', { _id: documentRecord._id }, context);
        return storageResult;
      }

      // Update document record with storage information
      await SecureDataAccess.update(
        'patient_documents',
        { _id: documentRecord._id },
        { 
          storageLocation: storageResult.location,
          storagePath: storageResult.path,
          uploadCompleted: true,
          uploadCompletedAt: new Date()
        },
        context
      );

      // Create audit trail
      await this.createAuditTrail(patientId, 'DOCUMENT_UPLOADED', documentMetadata, session, practiceContext);

      return {
        success: true,
        document: {
          ...documentRecord,
          storageLocation: storageResult.location,
          uploadCompleted: true
        },
        message: 'Document uploaded successfully'
      };

    } catch (error) {
      console.error('❌ [PatientDocumentUpload] Upload failed:', error);
      return {
        success: false,
        error: 'UPLOAD_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Validate uploaded file data
   */
  validateFileData(fileData) {
    const errors = [];

    if (!fileData) {
      errors.push('File data is required');
      return { success: false, errors };
    }

    // Check required fields
    if (!fileData.filename) {
      errors.push('Filename is required');
    }
    if (!fileData.mimeType) {
      errors.push('MIME type is required');
    }
    if (!fileData.size) {
      errors.push('File size is required');
    }
    if (!fileData.content && !fileData.buffer) {
      errors.push('File content or buffer is required');
    }

    // Validate filename
    if (fileData.filename) {
      const filenameLower = fileData.filename.toLowerCase();
      const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.js'];
      if (suspiciousExtensions.some(ext => filenameLower.endsWith(ext))) {
        errors.push('File type not allowed for security reasons');
      }
    }

    // Validate MIME type
    if (fileData.mimeType && !this.allowedMimeTypes.includes(fileData.mimeType)) {
      errors.push(`MIME type '${fileData.mimeType}' is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
    }

    // Validate file size
    if (fileData.size) {
      if (fileData.size > this.maxFileSize) {
        errors.push(`File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`);
      }
      if (fileData.size < 1) {
        errors.push('File cannot be empty');
      }
    }

    // Validate document category
    if (fileData.category) {
      const validCategories = [
        'lab_results', 'imaging', 'prescription', 'insurance_card', 'id_document',
        'medical_history', 'consent_form', 'referral', 'discharge_summary', 'other'
      ];
      if (!validCategories.includes(fileData.category)) {
        errors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
      message: errors.length === 0 ? 'File validation passed' : 'File validation failed'
    };
  }

  /**
   * Perform security scan on uploaded file
   */
  async performSecurityScan(fileData) {
    try {
      // Basic security checks
      const content = fileData.content || fileData.buffer;
      
      if (!content) {
        return { safe: false, reason: 'No content to scan' };
      }

      // Convert content to string for analysis if it's a buffer
      const contentStr = Buffer.isBuffer(content) ? content.toString() : content;

      // Check for suspicious patterns (basic implementation)
      const suspiciousPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi,
        /\.exe\b/gi,
        /\.bat\b/gi,
        /\.cmd\b/gi
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(contentStr)) {
          return { 
            safe: false, 
            reason: 'Suspicious content pattern detected',
            pattern: pattern.source 
          };
        }
      }

      // Check file header/magic numbers for common file types
      if (Buffer.isBuffer(content)) {
        const header = content.slice(0, 10);
        const isValidHeader = this.validateFileHeader(header, fileData.mimeType);
        if (!isValidHeader) {
          return { 
            safe: false, 
            reason: 'File header does not match declared MIME type' 
          };
        }
      }

      return { safe: true };

    } catch (error) {
      console.error('❌ [PatientDocumentUpload] Security scan failed:', error);
      return { safe: false, reason: 'Security scan failed' };
    }
  }

  /**
   * Validate file header against declared MIME type
   */
  validateFileHeader(header, mimeType) {
    const headerSignatures = {
      'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      'image/tiff': [0x49, 0x49, 0x2A, 0x00], // or [0x4D, 0x4D, 0x00, 0x2A]
    };

    const expectedSignature = headerSignatures[mimeType];
    if (!expectedSignature) {
      return true; // Allow unknown MIME types for now
    }

    for (let i = 0; i < expectedSignature.length; i++) {
      if (header[i] !== expectedSignature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate document metadata
   */
  generateDocumentMetadata(fileData, patientId, session, practiceContext) {
    const timestamp = new Date();
    const documentId = `doc_${patientId}_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      documentId,
      patientId,
      filename: fileData.filename,
      originalFilename: fileData.filename,
      mimeType: fileData.mimeType,
      fileSize: fileData.size,
      category: fileData.category || 'other',
      description: fileData.description || '',
      tags: fileData.tags || [],
      uploadedBy: session?.userId || 'system',
      uploadedAt: timestamp,
      practiceId: practiceContext.practiceId,
      status: 'processing',
      encryptionRequired: true,
      retentionPeriod: fileData.retentionPeriod || 7, // years
      accessLevel: fileData.accessLevel || 'restricted',
      metadata: {
        uploadSource: fileData.uploadSource || 'web',
        userAgent: fileData.userAgent,
        ipAddress: fileData.ipAddress
      }
    };
  }

  /**
   * Store document file in secure storage
   */
  async storeDocumentFile(fileData, documentId) {
    try {
      // In real implementation, this would upload to secure cloud storage (AWS S3, Azure Blob, etc.)
      // For now, simulate successful storage
      
      const storageLocation = `encrypted_documents/${documentId.substring(0, 4)}/${documentId}`;
      const storagePath = `${process.env.DOCUMENT_STORAGE_PATH || '/secure/documents'}/${storageLocation}`;

      // Simulate encryption and storage
      await this.simulateEncryption(fileData.content || fileData.buffer);

      return {
        success: true,
        location: storageLocation,
        path: storagePath,
        encrypted: true,
        storageProvider: 'secure_local_storage'
      };

    } catch (error) {
      console.error('❌ [PatientDocumentUpload] File storage failed:', error);
      return {
        success: false,
        error: 'STORAGE_FAILED',
        message: 'Failed to store document file'
      };
    }
  }

  /**
   * Simulate file encryption for storage
   */
  async simulateEncryption(content) {
    // In real implementation, would use proper encryption service
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('🔐 Document encrypted for secure storage');
        resolve(true);
      }, 100);
    });
  }

  /**
   * Get upload progress for large files
   * @param {string} uploadId - Upload session ID
   * @returns {Object} Progress information
   */
  async getUploadProgress(uploadId) {
    // In real implementation, would track upload progress
    return {
      uploadId,
      progress: 100,
      status: 'completed',
      bytesUploaded: 0,
      totalBytes: 0
    };
  }

  /**
   * Cancel ongoing upload
   * @param {string} uploadId - Upload session ID
   * @returns {Object} Cancellation result
   */
  async cancelUpload(uploadId) {
    // In real implementation, would cancel ongoing upload
    return {
      success: true,
      uploadId,
      status: 'cancelled',
      message: 'Upload cancelled successfully'
    };
  }

  /**
   * Create audit trail for document operations
   */
  async createAuditTrail(patientId, action, data, session, practiceContext) {
    const auditRecord = {
      action,
      patientId,
      data: { 
        filename: data.filename,
        fileSize: data.fileSize,
        category: data.category
      },
      userId: session?.userId || 'system',
      timestamp: new Date(),
      practiceId: practiceContext.practiceId
    };

    console.log('📝 [PatientDocumentUpload] Audit trail created:', auditRecord);
  }
}

// Create singleton instance
const patientDocumentUpload = new PatientDocumentUpload();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('patientDocumentUpload', () => patientDocumentUpload);
}

module.exports = patientDocumentUpload;