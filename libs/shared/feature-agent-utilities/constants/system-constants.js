// System Constants
// Provides system constants for AgentServiceV4

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/shared/feature-agent-utilities/ files (4 levels deep)
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class SystemConstants {
    constructor() {
        this.serviceToken = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('system-constants');
        this.initialized = true;
    }

    // HTTP Status Codes
    getHttpStatusCodes() {
        return {
            // 2xx Success
            OK: 200,
            CREATED: 201,
            ACCEPTED: 202,
            NO_CONTENT: 204,
            
            // 3xx Redirection
            MOVED_PERMANENTLY: 301,
            FOUND: 302,
            NOT_MODIFIED: 304,
            
            // 4xx Client Error
            BAD_REQUEST: 400,
            UNAUTHORIZED: 401,
            FORBIDDEN: 403,
            NOT_FOUND: 404,
            METHOD_NOT_ALLOWED: 405,
            CONFLICT: 409,
            UNPROCESSABLE_ENTITY: 422,
            TOO_MANY_REQUESTS: 429,
            
            // 5xx Server Error
            INTERNAL_SERVER_ERROR: 500,
            NOT_IMPLEMENTED: 501,
            BAD_GATEWAY: 502,
            SERVICE_UNAVAILABLE: 503,
            GATEWAY_TIMEOUT: 504
        };
    }

    // API Response Codes
    getApiResponseCodes() {
        return {
            SUCCESS: 'SUCCESS',
            ERROR: 'ERROR',
            WARNING: 'WARNING',
            INFO: 'INFO',
            VALIDATION_ERROR: 'VALIDATION_ERROR',
            AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
            AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
            NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
            RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
            SYSTEM_ERROR: 'SYSTEM_ERROR'
        };
    }

    // File Size Limits
    getFileSizeLimits() {
        return {
            DOCUMENT_UPLOAD_MAX: 10 * 1024 * 1024, // 10MB
            IMAGE_UPLOAD_MAX: 5 * 1024 * 1024, // 5MB
            AVATAR_UPLOAD_MAX: 1 * 1024 * 1024, // 1MB
            BULK_IMPORT_MAX: 50 * 1024 * 1024, // 50MB
            LOG_FILE_MAX: 100 * 1024 * 1024 // 100MB
        };
    }

    // Supported File Types
    getSupportedFileTypes() {
        return {
            DOCUMENTS: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
            IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
            MEDICAL: ['.dcm', '.hl7', '.cda', '.fhir'],
            SPREADSHEETS: ['.xlsx', '.xls', '.csv'],
            ARCHIVES: ['.zip', '.rar', '.tar', '.gz']
        };
    }

    // MIME Types
    getMimeTypes() {
        return {
            // Documents
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'rtf': 'application/rtf',
            
            // Images
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'webp': 'image/webp',
            
            // Spreadsheets
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
            'csv': 'text/csv',
            
            // Archives
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed',
            'tar': 'application/x-tar',
            'gz': 'application/gzip'
        };
    }

    // System Limits
    getSystemLimits() {
        return {
            MAX_USERS_PER_CLINIC: 1000,
            MAX_PATIENTS_PER_CLINIC: 100000,
            MAX_APPOINTMENTS_PER_DAY: 1000,
            MAX_DOCUMENTS_PER_PATIENT: 500,
            MAX_MEDICATIONS_PER_PATIENT: 100,
            MAX_ALLERGIES_PER_PATIENT: 50,
            MAX_DIAGNOSES_PER_PATIENT: 100,
            MAX_SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
            MAX_REQUEST_TIMEOUT: 30 * 1000, // 30 seconds
            MAX_CONCURRENT_REQUESTS: 1000,
            MAX_UPLOAD_RETRIES: 3,
            MAX_API_CALLS_PER_MINUTE: 1000
        };
    }

    // Cache Durations (in seconds)
    getCacheDurations() {
        return {
            USER_SESSION: 3600, // 1 hour
            API_RESPONSE: 300, // 5 minutes
            STATIC_CONTENT: 86400, // 24 hours
            DATABASE_QUERY: 60, // 1 minute
            FILE_METADATA: 1800, // 30 minutes
            CONFIGURATION: 900, // 15 minutes
            EXTERNAL_API: 600, // 10 minutes
            REPORT_DATA: 1200 // 20 minutes
        };
    }

    // Default Pagination Settings
    getPaginationDefaults() {
        return {
            DEFAULT_PAGE_SIZE: 20,
            MAX_PAGE_SIZE: 100,
            MIN_PAGE_SIZE: 5,
            DEFAULT_PAGE: 1
        };
    }

    // Rate Limiting Rules
    getRateLimitRules() {
        return {
            API_REQUESTS: {
                window: 60 * 1000, // 1 minute
                limit: 1000
            },
            LOGIN_ATTEMPTS: {
                window: 15 * 60 * 1000, // 15 minutes
                limit: 5
            },
            PASSWORD_RESET: {
                window: 60 * 60 * 1000, // 1 hour
                limit: 3
            },
            FILE_UPLOADS: {
                window: 60 * 1000, // 1 minute
                limit: 10
            },
            SEARCH_REQUESTS: {
                window: 60 * 1000, // 1 minute
                limit: 100
            }
        };
    }

    // Regular Expressions
    getRegexPatterns() {
        return {
            EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            PHONE_US: /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
            PHONE_INTERNATIONAL: /^\+?[1-9]\d{1,14}$/,
            ZIPCODE_US: /^\d{5}(-\d{4})?$/,
            SSN: /^\d{3}-\d{2}-\d{4}$/,
            CREDIT_CARD: /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/,
            IP_ADDRESS: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
            UUID: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/,
            STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
        };
    }

    // Error Messages
    getErrorMessages() {
        return {
            VALIDATION_REQUIRED: 'This field is required',
            VALIDATION_EMAIL: 'Please enter a valid email address',
            VALIDATION_PHONE: 'Please enter a valid phone number',
            VALIDATION_DATE: 'Please enter a valid date',
            VALIDATION_NUMBER: 'Please enter a valid number',
            VALIDATION_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
            
            AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
            AUTH_ACCOUNT_LOCKED: 'Account has been locked due to too many failed attempts',
            AUTH_SESSION_EXPIRED: 'Your session has expired. Please log in again',
            AUTH_UNAUTHORIZED: 'You are not authorized to perform this action',
            
            SYSTEM_MAINTENANCE: 'System is currently under maintenance. Please try again later',
            SYSTEM_OVERLOAD: 'System is currently overloaded. Please try again in a few minutes',
            SYSTEM_ERROR: 'An unexpected error occurred. Please try again',
            
            FILE_TOO_LARGE: 'File size exceeds maximum allowed limit',
            FILE_INVALID_TYPE: 'Invalid file type. Please upload a supported file format',
            FILE_UPLOAD_FAILED: 'File upload failed. Please try again'
        };
    }

    // Environment Configuration
    getEnvironmentDefaults() {
        return {
            DEVELOPMENT: {
                LOG_LEVEL: 'debug',
                CACHE_ENABLED: false,
                RATE_LIMITING: false,
                SSL_REQUIRED: false
            },
            STAGING: {
                LOG_LEVEL: 'info',
                CACHE_ENABLED: true,
                RATE_LIMITING: true,
                SSL_REQUIRED: true
            },
            PRODUCTION: {
                LOG_LEVEL: 'error',
                CACHE_ENABLED: true,
                RATE_LIMITING: true,
                SSL_REQUIRED: true
            }
        };
    }

    // Database Configuration
    getDatabaseDefaults() {
        return {
            CONNECTION_POOL_MIN: 5,
            CONNECTION_POOL_MAX: 50,
            CONNECTION_TIMEOUT: 30000,
            QUERY_TIMEOUT: 60000,
            IDLE_TIMEOUT: 300000,
            MAX_RETRIES: 3,
            RETRY_DELAY: 1000
        };
    }
}

// Create singleton instance
const systemConstants = new SystemConstants();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('systemConstants', () => systemConstants);
}

module.exports = systemConstants;