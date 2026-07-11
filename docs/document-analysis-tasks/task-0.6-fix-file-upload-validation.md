# Task 0.6: Fix File Upload Validation

## 🛡️ **SECURITY VALIDATION TASK**
**Phase:** 0 (Critical Security)  
**Time Estimate:** 20 minutes  
**Risk Level:** HIGH  
**Priority:** URGENT  

## 🎯 **Objective**
Implement comprehensive file upload validation to prevent malicious files and ensure only valid medical documents are processed.

## 🚨 **Security Risks**
**HIGH:** Current upload vulnerabilities:
- No file type validation
- Missing file size limits
- No malware scanning
- Executable files allowed
- No content verification
- Missing file extension validation

## 🔧 **Implementation**

### **Step 1: Create File Validation Service**
```javascript
// backend/services/fileValidationService.js
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const pdf = require('pdf-parse');

class FileValidationService {
  constructor() {
    this.allowedMimeTypes = {
      images: [
        'image/jpeg',
        'image/png', 
        'image/tiff',
        'image/bmp'
      ],
      documents: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ],
      medical: [
        'application/dicom', // Medical imaging
        'text/hl7' // HL7 medical data
      ]
    };
    
    this.maxFileSizes = {
      image: 50 * 1024 * 1024, // 50MB
      document: 100 * 1024 * 1024, // 100MB
      medical: 500 * 1024 * 1024 // 500MB for DICOM
    };
    
    this.dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.scr', '.vbs',
      '.js', '.jar', '.app', '.deb', '.pkg', '.dmg'
    ];
    
    this.maliciousSignatures = [
      'MZ', // Executable
      'PK', // ZIP-based formats (potential)
      '\x7fELF' // Linux executable
    ];
  }

  async validateFile(file, options = {}) {
    const validation = {
      isValid: false,
      errors: [],
      warnings: [],
      fileInfo: {
        originalName: file.originalname || file.name,
        size: file.size,
        mimeType: file.mimetype,
        extension: path.extname(file.originalname || file.name).toLowerCase()
      },
      securityFlags: {
        malwareDetected: false,
        suspiciousContent: false,
        executableContent: false
      }
    };

    try {
      // Step 1: Basic file checks
      await this.validateBasicFileProperties(file, validation);
      
      // Step 2: MIME type validation
      await this.validateMimeType(file, validation);
      
      // Step 3: File size validation
      await this.validateFileSize(file, validation);
      
      // Step 4: Content validation
      await this.validateFileContent(file, validation);
      
      // Step 5: Security scanning
      await this.performSecurityScan(file, validation);
      
      // Step 6: Medical document specific validation
      if (options.isMedical) {
        await this.validateMedicalDocument(file, validation);
      }
      
      // Determine overall validity
      validation.isValid = validation.errors.length === 0;
      
      return validation;
      
    } catch (error) {
      validation.errors.push(`Validation failed: ${error.message}`);
      validation.isValid = false;
      return validation;
    }
  }

  async validateBasicFileProperties(file, validation) {
    // Check file name
    if (!file.originalname || file.originalname.trim() === '') {
      validation.errors.push('File name is required');
    }
    
    // Check for dangerous file names
    const fileName = file.originalname.toLowerCase();
    if (fileName.includes('../') || fileName.includes('..\\')) {
      validation.errors.push('Invalid file path detected');
      validation.securityFlags.suspiciousContent = true;
    }
    
    // Check file extension
    const extension = validation.fileInfo.extension;
    if (this.dangerousExtensions.includes(extension)) {
      validation.errors.push(`Dangerous file extension: ${extension}`);
      validation.securityFlags.executableContent = true;
    }
    
    // Check for null bytes in filename
    if (file.originalname.includes('\0')) {
      validation.errors.push('Null bytes in filename detected');
      validation.securityFlags.suspiciousContent = true;
    }
  }

  async validateMimeType(file, validation) {
    const mimeType = file.mimetype;
    const allAllowedTypes = [
      ...this.allowedMimeTypes.images,
      ...this.allowedMimeTypes.documents,
      ...this.allowedMimeTypes.medical
    ];
    
    if (!allAllowedTypes.includes(mimeType)) {
      validation.errors.push(`Unsupported file type: ${mimeType}`);
    }
    
    // Verify MIME type matches file extension
    const extension = validation.fileInfo.extension;
    const expectedMimeTypes = this.getExpectedMimeTypes(extension);
    
    if (expectedMimeTypes.length > 0 && !expectedMimeTypes.includes(mimeType)) {
      validation.warnings.push(`MIME type ${mimeType} doesn't match extension ${extension}`);
      validation.securityFlags.suspiciousContent = true;
    }
  }

  async validateFileSize(file, validation) {
    const fileSize = file.size;
    const mimeType = file.mimetype;
    
    let maxSize;
    if (this.allowedMimeTypes.images.includes(mimeType)) {
      maxSize = this.maxFileSizes.image;
    } else if (this.allowedMimeTypes.medical.includes(mimeType)) {
      maxSize = this.maxFileSizes.medical;
    } else {
      maxSize = this.maxFileSizes.document;
    }
    
    if (fileSize > maxSize) {
      validation.errors.push(`File too large: ${fileSize} bytes (max: ${maxSize} bytes)`);
    }
    
    if (fileSize === 0) {
      validation.errors.push('Empty file detected');
    }
  }

  async validateFileContent(file, validation) {
    const buffer = file.buffer;
    const mimeType = file.mimetype;
    
    try {
      // Validate file headers match declared type
      const actualType = await this.detectFileType(buffer);
      
      if (actualType && actualType !== mimeType) {
        validation.warnings.push(
          `File header indicates ${actualType} but MIME type is ${mimeType}`
        );
        validation.securityFlags.suspiciousContent = true;
      }
      
      // Content-specific validation
      if (mimeType.startsWith('image/')) {
        await this.validateImageContent(buffer, validation);
      } else if (mimeType === 'application/pdf') {
        await this.validatePdfContent(buffer, validation);
      }
      
    } catch (error) {
      validation.warnings.push(`Content validation failed: ${error.message}`);
    }
  }

  async validateImageContent(buffer, validation) {
    try {
      const metadata = await sharp(buffer).metadata();
      
      // Check image dimensions
      if (metadata.width > 10000 || metadata.height > 10000) {
        validation.warnings.push('Extremely large image dimensions detected');
      }
      
      // Check for unusual formats that might be malicious
      if (!['jpeg', 'png', 'tiff', 'webp'].includes(metadata.format)) {
        validation.warnings.push(`Unusual image format: ${metadata.format}`);
        validation.securityFlags.suspiciousContent = true;
      }
      
    } catch (error) {
      validation.errors.push('Invalid or corrupted image file');
    }
  }

  async validatePdfContent(buffer, validation) {
    try {
      const pdfData = await pdf(buffer);
      
      // Check PDF properties
      if (pdfData.numpages > 1000) {
        validation.warnings.push('PDF has unusually high page count');
      }
      
      // Check for suspicious content in PDF metadata
      const text = pdfData.text.toLowerCase();
      if (text.includes('javascript') || text.includes('<script>')) {
        validation.errors.push('PDF contains potentially malicious JavaScript');
        validation.securityFlags.malwareDetected = true;
      }
      
    } catch (error) {
      validation.errors.push('Invalid or corrupted PDF file');
    }
  }

  async performSecurityScan(file, validation) {
    const buffer = file.buffer;
    
    // Check for executable signatures
    const header = buffer.slice(0, 10).toString('hex');
    
    for (const signature of this.maliciousSignatures) {
      if (header.startsWith(signature)) {
        validation.errors.push('Executable file signature detected');
        validation.securityFlags.executableContent = true;
      }
    }
    
    // Check for embedded executables
    const content = buffer.toString('binary');
    if (content.includes('MZ') && content.includes('This program')) {
      validation.warnings.push('Possible embedded executable detected');
      validation.securityFlags.suspiciousContent = true;
    }
    
    // Calculate file hash for malware database lookup
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    validation.fileInfo.sha256 = hash;
    
    // TODO: Integrate with malware database/API
    // const isMalware = await this.checkMalwareDatabase(hash);
    // if (isMalware) {
    //   validation.errors.push('File matches known malware signature');
    //   validation.securityFlags.malwareDetected = true;
    // }
  }

  async validateMedicalDocument(file, validation) {
    // Additional validation for medical documents
    const buffer = file.buffer;
    const text = buffer.toString('utf8', 0, Math.min(1000, buffer.length));
    
    // Check for medical document indicators
    const medicalIndicators = [
      'patient', 'diagnosis', 'prescription', 'lab', 'result',
      'medical', 'doctor', 'hospital', 'practice'
    ];
    
    const hasmedicalContent = medicalIndicators.some(indicator => 
      text.toLowerCase().includes(indicator)
    );
    
    if (!hasmedicalContent && file.mimetype === 'text/plain') {
      validation.warnings.push('Document may not contain medical content');
    }
    
    // Check file age (medical documents shouldn't be too old)
    const currentYear = new Date().getFullYear();
    const yearRegex = /(19|20)\d{2}/g;
    const years = text.match(yearRegex);
    
    if (years) {
      const documentYears = years.map(y => parseInt(y));
      const oldestYear = Math.min(...documentYears);
      
      if (currentYear - oldestYear > 50) {
        validation.warnings.push('Document appears to be very old');
      }
    }
  }

  detectFileType(buffer) {
    // Detect actual file type from header
    const header = buffer.slice(0, 12);
    
    if (header[0] === 0xFF && header[1] === 0xD8) return 'image/jpeg';
    if (header[0] === 0x89 && header.slice(1, 4).toString() === 'PNG') return 'image/png';
    if (header.slice(0, 4).toString() === '%PDF') return 'application/pdf';
    if (header[0] === 0x50 && header[1] === 0x4B) return 'application/zip';
    
    return null;
  }

  getExpectedMimeTypes(extension) {
    const extensionMap = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.pdf': ['application/pdf'],
      '.tiff': ['image/tiff'],
      '.txt': ['text/plain'],
      '.doc': ['application/msword'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    };
    
    return extensionMap[extension] || [];
  }

  generateValidationReport(validation) {
    return {
      valid: validation.isValid,
      summary: {
        fileName: validation.fileInfo.originalName,
        size: validation.fileInfo.size,
        type: validation.fileInfo.mimeType,
        secure: !validation.securityFlags.malwareDetected && 
                !validation.securityFlags.executableContent
      },
      issues: {
        errors: validation.errors,
        warnings: validation.warnings,
        securityFlags: validation.securityFlags
      },
      recommendations: this.generateRecommendations(validation)
    };
  }

  generateRecommendations(validation) {
    const recommendations = [];
    
    if (validation.securityFlags.suspiciousContent) {
      recommendations.push('Manual review recommended due to suspicious content');
    }
    
    if (validation.warnings.length > 0) {
      recommendations.push('Review warnings before processing');
    }
    
    if (validation.fileInfo.size > 10 * 1024 * 1024) {
      recommendations.push('Large file - consider compression or splitting');
    }
    
    return recommendations;
  }
}

module.exports = FileValidationService;
```

### **Step 2: Apply to Upload Routes**
```javascript
// In backend/routes/documents.js
const FileValidationService = require('../services/fileValidationService');
const fileValidationService = new FileValidationService();

// Update upload middleware
router.post('/upload/:patientId', upload.single('document'), async (req, res) => {
  try {
    // Validate uploaded file
    const validation = await fileValidationService.validateFile(req.file, {
      isMedical: true
    });
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'File validation failed',
        validation: fileValidationService.generateValidationReport(validation)
      });
    }
    
    // Log security warnings
    if (validation.warnings.length > 0) {
      console.warn('File upload warnings:', {
        file: req.file.originalname,
        warnings: validation.warnings,
        user: req.user._id
      });
    }
    
    // Continue with normal upload process
    // ... rest of upload logic
    
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});
```

## ✅ **Success Criteria**
- [ ] All file types validated
- [ ] Malicious files blocked
- [ ] File size limits enforced
- [ ] Content verification working
- [ ] Security scanning implemented
- [ ] Medical document validation functional

## 🔄 **Next Task**
Proceed to: **Task 0.7:** Implement Virus Scanning