// Configuration Constants
// Provides configuration constants for AgentServiceV4

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/shared/feature-agent-utilities/ files (4 levels deep)
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class ConfigurationConstants {
    constructor() {
        this.serviceToken = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('configuration-constants');
        this.initialized = true;
    }

    // Application Configuration
    getApplicationDefaults() {
        return {
            APP_NAME: 'IntelliCare',
            APP_VERSION: '1.0.0',
            APP_DESCRIPTION: 'Medical AI Platform for Healthcare Professionals',
            DEFAULT_LANGUAGE: 'en',
            SUPPORTED_LANGUAGES: ['en', 'he'],
            DEFAULT_TIMEZONE: 'UTC',
            DATE_FORMAT: 'YYYY-MM-DD',
            TIME_FORMAT: 'HH:mm',
            DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss'
        };
    }

    // Environment-specific configurations
    getEnvironmentConfig() {
        return {
            DEVELOPMENT: {
                DEBUG: true,
                LOG_LEVEL: 'debug',
                API_TIMEOUT: 30000,
                CACHE_TTL: 300,
                RATE_LIMIT_ENABLED: false,
                SSL_REQUIRED: false,
                CORS_ENABLED: true,
                MOCK_EXTERNAL_APIS: true
            },
            STAGING: {
                DEBUG: false,
                LOG_LEVEL: 'info',
                API_TIMEOUT: 15000,
                CACHE_TTL: 600,
                RATE_LIMIT_ENABLED: true,
                SSL_REQUIRED: true,
                CORS_ENABLED: true,
                MOCK_EXTERNAL_APIS: false
            },
            PRODUCTION: {
                DEBUG: false,
                LOG_LEVEL: 'error',
                API_TIMEOUT: 10000,
                CACHE_TTL: 3600,
                RATE_LIMIT_ENABLED: true,
                SSL_REQUIRED: true,
                CORS_ENABLED: false,
                MOCK_EXTERNAL_APIS: false
            }
        };
    }

    // Security Configuration
    getSecurityDefaults() {
        return {
            SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
            PASSWORD_MIN_LENGTH: 8,
            PASSWORD_REQUIRE_UPPERCASE: true,
            PASSWORD_REQUIRE_LOWERCASE: true,
            PASSWORD_REQUIRE_NUMBERS: true,
            PASSWORD_REQUIRE_SYMBOLS: true,
            MAX_LOGIN_ATTEMPTS: 5,
            ACCOUNT_LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
            JWT_EXPIRES_IN: '24h',
            ENCRYPTION_ALGORITHM: 'AES-256-GCM',
            HASH_ROUNDS: 12
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
            RECONNECT_ATTEMPTS: 3,
            RECONNECT_DELAY: 1000,
            ENABLE_QUERY_LOGGING: false,
            ENABLE_SLOW_QUERY_LOGGING: true,
            SLOW_QUERY_THRESHOLD: 1000
        };
    }

    // API Configuration
    getApiDefaults() {
        return {
            DEFAULT_PAGE_SIZE: 20,
            MAX_PAGE_SIZE: 100,
            API_VERSION: 'v1',
            REQUEST_TIMEOUT: 30000,
            RETRY_ATTEMPTS: 3,
            RETRY_DELAY: 1000,
            COMPRESSION_ENABLED: true,
            CORS_MAX_AGE: 3600,
            RESPONSE_HEADERS: {
                'X-Frame-Options': 'DENY',
                'X-Content-Type-Options': 'nosniff',
                'X-XSS-Protection': '1; mode=block',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            }
        };
    }

    // Caching Configuration
    getCacheDefaults() {
        return {
            DEFAULT_TTL: 3600, // 1 hour
            MAX_KEYS: 10000,
            MEMORY_LIMIT: '100mb',
            EVICTION_POLICY: 'lru',
            COMPRESSION: true,
            PERSISTENCE: false,
            REDIS_URL: 'redis://localhost:6379',
            REDIS_DB: 0,
            REDIS_KEY_PREFIX: 'intellicare:'
        };
    }

    // Logging Configuration
    getLoggingDefaults() {
        return {
            LOG_LEVEL: 'info',
            LOG_FORMAT: 'json',
            LOG_TIMESTAMP: true,
            LOG_COLORIZE: false,
            MAX_LOG_FILE_SIZE: '10mb',
            MAX_LOG_FILES: 5,
            LOG_RETENTION_DAYS: 30,
            AUDIT_LOG_ENABLED: true,
            ERROR_LOG_ENABLED: true,
            ACCESS_LOG_ENABLED: true,
            PERFORMANCE_LOG_ENABLED: false
        };
    }

    // Email Configuration
    getEmailDefaults() {
        return {
            SMTP_HOST: 'smtp.sendgrid.net',
            SMTP_PORT: 587,
            SMTP_SECURE: false,
            FROM_EMAIL: 'noreply@intellicare.health',
            FROM_NAME: 'IntelliCare Support',
            TEMPLATE_ENGINE: 'handlebars',
            EMAIL_QUEUE_ENABLED: true,
            MAX_RECIPIENTS: 100,
            RETRY_ATTEMPTS: 3,
            BOUNCE_TRACKING: true
        };
    }

    // File Upload Configuration
    getFileUploadDefaults() {
        return {
            MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
            ALLOWED_TYPES: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
            STORAGE_TYPE: 'local', // 'local', 's3', 'azure'
            UPLOAD_PATH: './uploads',
            VIRUS_SCAN_ENABLED: true,
            GENERATE_THUMBNAILS: true,
            THUMBNAIL_SIZES: [150, 300, 500],
            COMPRESSION_ENABLED: true,
            ENCRYPTION_ENABLED: true
        };
    }

    // Backup Configuration
    getBackupDefaults() {
        return {
            BACKUP_SCHEDULE: '0 2 * * *', // Daily at 2 AM
            BACKUP_RETENTION_DAYS: 30,
            BACKUP_COMPRESSION: true,
            BACKUP_ENCRYPTION: true,
            BACKUP_VERIFICATION: true,
            BACKUP_STORAGE: 'local',
            BACKUP_PATH: './backups',
            INCREMENTAL_BACKUPS: true,
            FULL_BACKUP_FREQUENCY: 7 // Every 7 days
        };
    }

    // Monitoring Configuration
    getMonitoringDefaults() {
        return {
            HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
            METRICS_COLLECTION_ENABLED: true,
            PERFORMANCE_MONITORING: true,
            ERROR_TRACKING: true,
            UPTIME_MONITORING: true,
            RESOURCE_MONITORING: true,
            ALERT_EMAIL: 'admin@intellicare.health',
            ALERT_THRESHOLDS: {
                CPU_USAGE: 80,
                MEMORY_USAGE: 85,
                DISK_USAGE: 90,
                ERROR_RATE: 5,
                RESPONSE_TIME: 2000
            }
        };
    }

    // Localization Configuration
    getLocalizationDefaults() {
        return {
            DEFAULT_LOCALE: 'en-US',
            SUPPORTED_LOCALES: [
                'en-US',
                'he-IL'
            ],
            FALLBACK_LOCALE: 'en-US',
            TRANSLATION_PATH: './locales',
            AUTO_DETECT_LOCALE: true,
            CURRENCY_SYMBOLS: {
                'USD': '$',
                'ILS': '₪',
                'EUR': '€'
            },
            DATE_FORMATS: {
                'en-US': 'MM/DD/YYYY',
                'he-IL': 'DD/MM/YYYY'
            }
        };
    }

    // Feature Flags Configuration
    getFeatureFlagsDefaults() {
        return {
            FEATURE_FLAGS_ENABLED: true,
            DEFAULT_FLAG_VALUE: false,
            FLAG_REFRESH_INTERVAL: 60000, // 1 minute
            FLAGS_CACHE_TTL: 300, // 5 minutes
            FLAGS_STORAGE: 'memory', // 'memory', 'redis', 'database'
            FEATURE_FLAGS: {
                NEW_UI: false,
                ADVANCED_ANALYTICS: true,
                BETA_FEATURES: false,
                MOBILE_APP: true,
                TELEMEDICINE: true,
                AI_DIAGNOSTICS: false
            }
        };
    }

    // Get configuration by environment
    getConfigByEnvironment(environment = 'development') {
        const baseConfig = {
            ...this.getApplicationDefaults(),
            ...this.getSecurityDefaults(),
            ...this.getApiDefaults(),
            ...this.getCacheDefaults(),
            ...this.getLoggingDefaults(),
            ...this.getEmailDefaults(),
            ...this.getFileUploadDefaults(),
            ...this.getMonitoringDefaults(),
            ...this.getLocalizationDefaults(),
            ...this.getFeatureFlagsDefaults()
        };
        
        const environmentConfig = this.getEnvironmentConfig()[environment.toUpperCase()] || {};
        
        return { ...baseConfig, ...environmentConfig };
    }
}

// Create singleton instance
const configurationConstants = new ConfigurationConstants();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('configurationConstants', () => configurationConstants);
}

module.exports = configurationConstants;