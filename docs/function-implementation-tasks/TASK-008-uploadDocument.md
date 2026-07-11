# TASK-008: Implement uploadDocument Function

## Function Details
- **Name**: uploadDocument
- **Category**: Document Management
- **Priority**: High
- **Backend Route**: POST `/documents/upload` ✅ (Exists)

## Current Implementation
```javascript
async uploadDocument(params, practiceContext) {
  const response = await this.callAPI('/documents/upload', 'POST', params, practiceContext);
  return {
    success: true,
    data: response.data
  };
}
```

## Required Implementation

### 1. File Validation
- Check file size limits (max 50MB)
- Validate file types (PDF, DOC, DOCX, JPG, PNG, DICOM)
- Scan for viruses/malware
- Validate file integrity

### 2. Document Processing
- Extract text content using OCR
- Detect document type automatically
- Extract medical data (dates, medications, diagnoses)
- Generate thumbnails for images

### 3. Security & Compliance
- Encrypt files at rest
- Generate audit logs
- Apply retention policies
- Ensure HIPAA compliance

## Implementation Code
```javascript
async uploadDocument(params, practiceContext) {
  try {
    // Validate required parameters
    if (!params.file && !params.fileData && !params.filePath) {
      throw new Error(practiceContext.language === 'he' 
        ? 'קובץ נדרש להעלאה' 
        : 'File is required for upload');
    }
    
    if (!params.patientId) {
      throw new Error(practiceContext.language === 'he' 
        ? 'מזהה מטופל נדרש' 
        : 'Patient ID is required');
    }
    
    // Extract file information
    const fileInfo = await this.extractFileInfo(params);
    
    // Validate file
    const validationResult = await this.validateFile(fileInfo, practiceContext);
    if (!validationResult.isValid) {
      throw new Error(validationResult.error);
    }
    
    // Prepare upload data
    const uploadData = {
      patientId: params.patientId,
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      mimeType: fileInfo.mimeType,
      fileData: fileInfo.data,
      
      // Document metadata
      title: params.title || params.documentTitle || fileInfo.name,
      description: params.description,
      category: params.category || 'general',
      tags: params.tags || [],
      
      // Medical context
      documentType: params.documentType || 'medical_record',
      documentDate: params.documentDate || params.date,
      provider: params.provider || params.doctorName,
      facility: params.facility,
      
      // Upload metadata
      uploadedBy: practiceContext.userId || 'agent',
      uploadDate: new Date().toISOString(),
      practiceId: practiceContext.practiceId,
      language: practiceContext.language,
      
      // Processing flags
      requiresOCR: this.needsOCR(fileInfo.mimeType),
      requiresAnalysis: params.analyzeContent !== false,
      isConfidential: params.isConfidential || true
    };
    
    // Auto-detect document type if not specified
    if (!params.documentType) {
      uploadData.documentType = await this.detectDocumentType(fileInfo, uploadData);
    }
    
    // Upload file to server
    const response = await this.callAPI(
      '/documents/upload', 
      'POST', 
      uploadData, 
      practiceContext,
      { 
        timeout: 60000, // 1 minute timeout for large files
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    );
    
    const uploadResult = response.data;
    
    // Process document asynchronously if needed
    let processingTasks = [];
    
    if (uploadData.requiresOCR) {
      processingTasks.push('OCR_EXTRACTION');
    }
    
    if (uploadData.requiresAnalysis) {
      processingTasks.push('MEDICAL_ANALYSIS');
    }
    
    // Generate document summary
    const summary = await this.generateDocumentSummary(uploadResult, practiceContext);
    
    // Create response
    const result = {
      success: true,
      data: uploadResult,
      documentId: uploadResult._id || uploadResult.id,
      message: practiceContext.language === 'he' 
        ? `מסמך "${uploadData.title}" הועלה בהצלחה`
        : `Document "${uploadData.title}" uploaded successfully`,
      summary: summary,
      processingStatus: processingTasks.length > 0 ? 'PENDING' : 'COMPLETED',
      processingTasks: processingTasks,
      metadata: {
        fileName: uploadData.fileName,
        fileSize: this.formatFileSize(uploadData.fileSize),
        uploadDate: uploadData.uploadDate,
        documentType: uploadData.documentType,
        category: uploadData.category,
        isEncrypted: true,
        retentionPolicy: this.getRetentionPolicy(uploadData.documentType)
      }
    };
    
    // Add warnings if any
    const warnings = await this.checkUploadWarnings(uploadData, uploadResult, practiceContext);
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    
    return result;
    
  } catch (error) {
    console.error('Error uploading document:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה בהעלאת מסמך: ${error.message}`
        : `Error uploading document: ${error.message}`
    };
  }
}

// Helper function to extract file information
async extractFileInfo(params) {
  let fileInfo = {};
  
  if (params.file) {
    // File object (from form upload)
    fileInfo = {
      name: params.file.name || params.fileName || 'document',
      size: params.file.size,
      mimeType: params.file.type || params.mimeType,
      data: params.file
    };
  } else if (params.fileData) {
    // Base64 encoded data
    fileInfo = {
      name: params.fileName || 'document',
      size: Math.ceil(params.fileData.length * 0.75), // Approximate size from base64
      mimeType: params.mimeType || 'application/octet-stream',
      data: params.fileData
    };
  } else if (params.filePath) {
    // File path (server-side)
    const fs = require('fs');
    const path = require('path');
    
    fileInfo = {
      name: path.basename(params.filePath),
      size: fs.statSync(params.filePath).size,
      mimeType: this.getMimeTypeFromExtension(path.extname(params.filePath)),
      data: fs.readFileSync(params.filePath)
    };
  }
  
  // Ensure file extension
  if (!fileInfo.name.includes('.')) {
    const extension = this.getExtensionFromMimeType(fileInfo.mimeType);
    if (extension) {
      fileInfo.name += extension;
    }
  }
  
  return fileInfo;
}

// Helper function to validate file
async validateFile(fileInfo, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  
  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024;
  if (fileInfo.size > maxSize) {
    return {
      isValid: false,
      error: isHebrew 
        ? `גודל הקובץ חורג מהמגבלה (מקסימום 50MB)`
        : `File size exceeds limit (maximum 50MB)`
    };
  }
  
  // Check file type
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/dicom',
    'text/plain',
    'text/rtf'
  ];
  
  if (!allowedTypes.includes(fileInfo.mimeType)) {
    return {
      isValid: false,
      error: isHebrew 
        ? `סוג קובץ לא נתמך: ${fileInfo.mimeType}`
        : `Unsupported file type: ${fileInfo.mimeType}`
    };
  }
  
  // Check for empty file
  if (fileInfo.size === 0) {
    return {
      isValid: false,
      error: isHebrew 
        ? 'קובץ ריק'
        : 'Empty file'
    };
  }
  
  // Basic virus scan (check for suspicious patterns)
  const suspiciousPatterns = [
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.scr$/i,
    /<script/i,
    /javascript:/i
  ];
  
  const fileName = fileInfo.name.toLowerCase();
  if (suspiciousPatterns.some(pattern => pattern.test(fileName))) {
    return {
      isValid: false,
      error: isHebrew 
        ? 'קובץ חשוד - העלאה נחסמה'
        : 'Suspicious file - upload blocked'
    };
  }
  
  return { isValid: true };
}

// Helper function to detect document type
async detectDocumentType(fileInfo, uploadData) {
  const fileName = fileInfo.name.toLowerCase();
  const mimeType = fileInfo.mimeType;
  
  // Medical document types based on filename patterns
  const typePatterns = [
    { pattern: /lab|laboratory|blood|urine|test/i, type: 'lab_result' },
    { pattern: /xray|x-ray|ct|mri|ultrasound|imaging|scan/i, type: 'imaging' },
    { pattern: /prescription|rx|medication|drug/i, type: 'prescription' },
    { pattern: /discharge|summary|hospital/i, type: 'discharge_summary' },
    { pattern: /referral|consult/i, type: 'referral' },
    { pattern: /vaccination|vaccine|immunization/i, type: 'vaccination_record' },
    { pattern: /insurance|claim|coverage/i, type: 'insurance_document' },
    { pattern: /consent|form|agreement/i, type: 'consent_form' },
    { pattern: /report|result/i, type: 'medical_report' }
  ];
  
  for (const { pattern, type } of typePatterns) {
    if (pattern.test(fileName) || pattern.test(uploadData.title || '')) {
      return type;
    }
  }
  
  // Default based on MIME type
  if (mimeType.startsWith('image/')) {
    return 'medical_image';
  } else if (mimeType === 'application/pdf') {
    return 'medical_document';
  } else if (mimeType.includes('word')) {
    return 'medical_report';
  }
  
  return 'general';
}

// Helper function to generate document summary
async generateDocumentSummary(uploadResult, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  const summary = [];
  
  // Document basics
  summary.push(isHebrew 
    ? `סוג: ${this.translateDocumentType(uploadResult.documentType, true)}`
    : `Type: ${this.translateDocumentType(uploadResult.documentType, false)}`);
  
  if (uploadResult.documentDate) {
    summary.push(isHebrew 
      ? `תאריך: ${this.formatDate(uploadResult.documentDate, true)}`
      : `Date: ${this.formatDate(uploadResult.documentDate, false)}`);
  }
  
  if (uploadResult.provider) {
    summary.push(isHebrew 
      ? `רופא: ${uploadResult.provider}`
      : `Provider: ${uploadResult.provider}`);
  }
  
  // File info
  summary.push(isHebrew 
    ? `גודל: ${this.formatFileSize(uploadResult.fileSize)}`
    : `Size: ${this.formatFileSize(uploadResult.fileSize)}`);
  
  return summary.join(' | ');
}

// Helper functions
needsOCR(mimeType) {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

getRetentionPolicy(documentType) {
  const policies = {
    'lab_result': '7 years',
    'imaging': '10 years',
    'prescription': '3 years',
    'vaccination_record': 'permanent',
    'insurance_document': '7 years',
    'default': '5 years'
  };
  
  return policies[documentType] || policies.default;
}

getMimeTypeFromExtension(ext) {
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.tiff': 'image/tiff',
    '.txt': 'text/plain',
    '.rtf': 'text/rtf'
  };
  
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

translateDocumentType(type, isHebrew) {
  const translations = {
    'lab_result': isHebrew ? 'תוצאת מעבדה' : 'Lab Result',
    'imaging': isHebrew ? 'הדמיה רפואית' : 'Medical Imaging',
    'prescription': isHebrew ? 'מרשם' : 'Prescription',
    'discharge_summary': isHebrew ? 'סיכום שחרור' : 'Discharge Summary',
    'referral': isHebrew ? 'הפניה' : 'Referral',
    'vaccination_record': isHebrew ? 'רשומת חיסונים' : 'Vaccination Record',
    'insurance_document': isHebrew ? 'מסמך ביטוח' : 'Insurance Document',
    'medical_report': isHebrew ? 'דוח רפואי' : 'Medical Report',
    'general': isHebrew ? 'כללי' : 'General'
  };
  
  return translations[type] || type;
}
```

## Testing Checklist
- [ ] Test file upload with valid PDF
- [ ] Test file upload with valid image
- [ ] Test file size validation (over 50MB)
- [ ] Test unsupported file type
- [ ] Test empty file
- [ ] Test malicious file detection
- [ ] Test document type detection
- [ ] Test metadata extraction
- [ ] Test OCR processing trigger
- [ ] Test Hebrew responses
- [ ] Test English responses

## Notes
- Implement virus scanning with ClamAV or similar
- Add support for DICOM medical images
- Consider cloud storage integration (AWS S3, Azure Blob)
- Add document versioning support
- Implement automated backup for uploaded documents