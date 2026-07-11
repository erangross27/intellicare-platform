// Error Constants
// Provides error constants for AgentServiceV4

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/shared/feature-agent-utilities/ files (4 levels deep)
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ErrorConstants {
    constructor() {
        this.serviceToken = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('error-constants');
        this.initialized = true;
    }

    // Error Codes
    getErrorCodes() {
        return {
            // General Errors
            UNKNOWN_ERROR: 'E_UNKNOWN_ERROR',
            SYSTEM_ERROR: 'E_SYSTEM_ERROR',
            NETWORK_ERROR: 'E_NETWORK_ERROR',
            TIMEOUT_ERROR: 'E_TIMEOUT_ERROR',
            
            // Validation Errors
            VALIDATION_ERROR: 'E_VALIDATION_ERROR',
            REQUIRED_FIELD: 'E_REQUIRED_FIELD',
            INVALID_FORMAT: 'E_INVALID_FORMAT',
            INVALID_VALUE: 'E_INVALID_VALUE',
            OUT_OF_RANGE: 'E_OUT_OF_RANGE',
            
            // Authentication Errors
            AUTH_REQUIRED: 'E_AUTH_REQUIRED',
            AUTH_INVALID: 'E_AUTH_INVALID',
            AUTH_EXPIRED: 'E_AUTH_EXPIRED',
            AUTH_INSUFFICIENT: 'E_AUTH_INSUFFICIENT',
            
            // Authorization Errors
            ACCESS_DENIED: 'E_ACCESS_DENIED',
            PERMISSION_DENIED: 'E_PERMISSION_DENIED',
            ROLE_REQUIRED: 'E_ROLE_REQUIRED',
            
            // Resource Errors
            RESOURCE_NOT_FOUND: 'E_RESOURCE_NOT_FOUND',
            RESOURCE_EXISTS: 'E_RESOURCE_EXISTS',
            RESOURCE_LOCKED: 'E_RESOURCE_LOCKED',
            RESOURCE_UNAVAILABLE: 'E_RESOURCE_UNAVAILABLE',
            
            // Database Errors
            DATABASE_ERROR: 'E_DATABASE_ERROR',
            DATABASE_CONNECTION: 'E_DATABASE_CONNECTION',
            DATABASE_TIMEOUT: 'E_DATABASE_TIMEOUT',
            DATABASE_CONSTRAINT: 'E_DATABASE_CONSTRAINT',
            
            // File Errors
            FILE_NOT_FOUND: 'E_FILE_NOT_FOUND',
            FILE_TOO_LARGE: 'E_FILE_TOO_LARGE',
            FILE_INVALID_TYPE: 'E_FILE_INVALID_TYPE',
            FILE_UPLOAD_FAILED: 'E_FILE_UPLOAD_FAILED',
            FILE_PROCESSING_FAILED: 'E_FILE_PROCESSING_FAILED',
            
            // Rate Limiting
            RATE_LIMIT_EXCEEDED: 'E_RATE_LIMIT_EXCEEDED',
            QUOTA_EXCEEDED: 'E_QUOTA_EXCEEDED',
            
            // Medical Errors
            PATIENT_NOT_FOUND: 'E_PATIENT_NOT_FOUND',
            APPOINTMENT_NOT_AVAILABLE: 'E_APPOINTMENT_NOT_AVAILABLE',
            MEDICATION_CONFLICT: 'E_MEDICATION_CONFLICT',
            ALLERGY_WARNING: 'E_ALLERGY_WARNING',
            VITAL_SIGNS_INVALID: 'E_VITAL_SIGNS_INVALID',
            
            // Business Logic Errors
            BUSINESS_RULE_VIOLATION: 'E_BUSINESS_RULE_VIOLATION',
            WORKFLOW_ERROR: 'E_WORKFLOW_ERROR',
            STATE_TRANSITION_INVALID: 'E_STATE_TRANSITION_INVALID',
            
            // Integration Errors
            EXTERNAL_API_ERROR: 'E_EXTERNAL_API_ERROR',
            SERVICE_UNAVAILABLE: 'E_SERVICE_UNAVAILABLE',
            INTEGRATION_TIMEOUT: 'E_INTEGRATION_TIMEOUT'
        };
    }

    // Error Messages
    getErrorMessages() {
        return {
            // General Errors
            E_UNKNOWN_ERROR: 'An unknown error occurred',
            E_SYSTEM_ERROR: 'A system error occurred',
            E_NETWORK_ERROR: 'Network connection failed',
            E_TIMEOUT_ERROR: 'Operation timed out',
            
            // Validation Errors
            E_VALIDATION_ERROR: 'Validation failed',
            E_REQUIRED_FIELD: 'This field is required',
            E_INVALID_FORMAT: 'Invalid format',
            E_INVALID_VALUE: 'Invalid value provided',
            E_OUT_OF_RANGE: 'Value is out of acceptable range',
            
            // Authentication Errors
            E_AUTH_REQUIRED: 'Authentication required',
            E_AUTH_INVALID: 'Invalid credentials',
            E_AUTH_EXPIRED: 'Authentication has expired',
            E_AUTH_INSUFFICIENT: 'Insufficient authentication',
            
            // Authorization Errors
            E_ACCESS_DENIED: 'Access denied',
            E_PERMISSION_DENIED: 'Permission denied',
            E_ROLE_REQUIRED: 'Required role not assigned',
            
            // Resource Errors
            E_RESOURCE_NOT_FOUND: 'Resource not found',
            E_RESOURCE_EXISTS: 'Resource already exists',
            E_RESOURCE_LOCKED: 'Resource is locked',
            E_RESOURCE_UNAVAILABLE: 'Resource is unavailable',
            
            // Database Errors
            E_DATABASE_ERROR: 'Database operation failed',
            E_DATABASE_CONNECTION: 'Database connection failed',
            E_DATABASE_TIMEOUT: 'Database operation timed out',
            E_DATABASE_CONSTRAINT: 'Database constraint violation',
            
            // File Errors
            E_FILE_NOT_FOUND: 'File not found',
            E_FILE_TOO_LARGE: 'File size exceeds limit',
            E_FILE_INVALID_TYPE: 'Invalid file type',
            E_FILE_UPLOAD_FAILED: 'File upload failed',
            E_FILE_PROCESSING_FAILED: 'File processing failed',
            
            // Rate Limiting
            E_RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
            E_QUOTA_EXCEEDED: 'Quota exceeded',
            
            // Medical Errors
            E_PATIENT_NOT_FOUND: 'Patient not found',
            E_APPOINTMENT_NOT_AVAILABLE: 'Appointment slot not available',
            E_MEDICATION_CONFLICT: 'Medication conflict detected',
            E_ALLERGY_WARNING: 'Allergy warning',
            E_VITAL_SIGNS_INVALID: 'Invalid vital signs',
            
            // Business Logic Errors
            E_BUSINESS_RULE_VIOLATION: 'Business rule violation',
            E_WORKFLOW_ERROR: 'Workflow error',
            E_STATE_TRANSITION_INVALID: 'Invalid state transition',
            
            // Integration Errors
            E_EXTERNAL_API_ERROR: 'External API error',
            E_SERVICE_UNAVAILABLE: 'Service unavailable',
            E_INTEGRATION_TIMEOUT: 'Integration timeout'
        };
    }

    // Error Severity Levels
    getErrorSeverityLevels() {
        return {
            CRITICAL: 'critical',
            HIGH: 'high',
            MEDIUM: 'medium',
            LOW: 'low',
            INFO: 'info'
        };
    }

    // Error Categories
    getErrorCategories() {
        return {
            SYSTEM: 'system',
            USER: 'user',
            BUSINESS: 'business',
            SECURITY: 'security',
            INTEGRATION: 'integration',
            DATA: 'data',
            NETWORK: 'network'
        };
    }

    // Create standardized error object
    createError(code, message = null, details = null, severity = 'medium') {
        const errorCodes = this.getErrorCodes();
        const errorMessages = this.getErrorMessages();
        
        return {
            code: errorCodes[code] || code,
            message: message || errorMessages[code] || 'Unknown error',
            details: details,
            severity: severity,
            timestamp: new Date().toISOString(),
            category: this._getErrorCategory(code)
        };
    }

    // Get error category based on code
    _getErrorCategory(code) {
        const categories = this.getErrorCategories();
        
        if (code.includes('AUTH') || code.includes('PERMISSION')) {
            return categories.SECURITY;
        } else if (code.includes('VALIDATION') || code.includes('REQUIRED')) {
            return categories.USER;
        } else if (code.includes('DATABASE') || code.includes('RESOURCE')) {
            return categories.DATA;
        } else if (code.includes('NETWORK') || code.includes('TIMEOUT')) {
            return categories.NETWORK;
        } else if (code.includes('EXTERNAL') || code.includes('INTEGRATION')) {
            return categories.INTEGRATION;
        } else if (code.includes('BUSINESS') || code.includes('WORKFLOW')) {
            return categories.BUSINESS;
        } else {
            return categories.SYSTEM;
        }
    }

    // Medical specific error codes
    getMedicalErrorCodes() {
        return {
            VITAL_SIGNS_OUT_OF_RANGE: 'E_VITAL_SIGNS_OUT_OF_RANGE',
            MEDICATION_DOSAGE_INVALID: 'E_MEDICATION_DOSAGE_INVALID',
            LAB_RESULT_CRITICAL: 'E_LAB_RESULT_CRITICAL',
            ALLERGY_CROSS_REACTION: 'E_ALLERGY_CROSS_REACTION',
            DIAGNOSIS_REQUIRED: 'E_DIAGNOSIS_REQUIRED',
            APPOINTMENT_CONFLICT: 'E_APPOINTMENT_CONFLICT',
            PROVIDER_UNAVAILABLE: 'E_PROVIDER_UNAVAILABLE',
            INSURANCE_EXPIRED: 'E_INSURANCE_EXPIRED',
            MEDICAL_RECORD_INCOMPLETE: 'E_MEDICAL_RECORD_INCOMPLETE'
        };
    }

    // Bilingual error messages (Hebrew/English)
    getBilingualErrorMessages() {
        return {
            E_PATIENT_NOT_FOUND: {
                en: 'Patient not found',
                he: 'מטופל לא נמצא'
            },
            E_APPOINTMENT_NOT_AVAILABLE: {
                en: 'Appointment slot not available',
                he: 'תור לא זמין'
            },
            E_MEDICATION_CONFLICT: {
                en: 'Medication conflict detected',
                he: 'זוהה קונפליקט בתרופות'
            },
            E_ALLERGY_WARNING: {
                en: 'Allergy warning',
                he: 'אזהרת אלרגיה'
            },
            E_VALIDATION_ERROR: {
                en: 'Validation failed',
                he: 'אימות נכשל'
            },
            E_AUTH_REQUIRED: {
                en: 'Authentication required',
                he: 'נדרש זיהוי'
            },
            E_ACCESS_DENIED: {
                en: 'Access denied',
                he: 'גישה נדחתה'
            },
            E_SYSTEM_ERROR: {
                en: 'System error occurred',
                he: 'אירעה שגיאת מערכת'
            }
        };
    }

    // Get localized error message
    getLocalizedMessage(errorCode, language = 'en') {
        const bilingualMessages = this.getBilingualErrorMessages();
        const messages = this.getErrorMessages();
        
        if (bilingualMessages[errorCode] && bilingualMessages[errorCode][language]) {
            return bilingualMessages[errorCode][language];
        }
        
        return messages[errorCode] || 'Unknown error';
    }
}

// Create singleton instance
const errorConstants = new ErrorConstants();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('errorConstants', () => errorConstants);
}

module.exports = errorConstants;