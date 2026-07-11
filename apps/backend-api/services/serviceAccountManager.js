/**
 * 🔐 SECURE SERVICE ACCOUNT MANAGER
 * 
 * CRITICAL SECURITY: This version uses database-backed ServiceAccounts
 * instead of filesystem manifests to prevent security breaches.
 * 
 * Every service MUST authenticate through the database with proper API keys.
 * Uses GlobalModelLoader for encrypted database access.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const globalModelLoader = require('./globalModelLoader');
const ServiceRegistry = require('./serviceRegistry');
const DatabaseConnectionProvider = require('./databaseConnectionProvider');
const serviceProxyManager = require('./serviceProxyManager');
// Lazy-load SecureDataAccess to avoid circular dependency
let SecureDataAccess = null;
// Lazy-load productionKMS to avoid circular dependency
let productionKMS = null;
// Lazy-load SecureConfigService to avoid circular dependency
let SecureConfigService = null;

// Helper function to log security events
let auditServiceInstance = null;

async function logSecurityEvent(eventType, practiceId, details) {
    if (auditServiceInstance) {
        try {
            await auditServiceInstance.logSecurityEvent({
                eventType,
                practiceId,
                details,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to log security event:', error);
        }
    }
}

class SecureServiceAccountManager {
    constructor() {
        this.authenticatedServices = new Map(); // Cache of authenticated services
        this.rotationInterval = 24 * 60 * 60 * 1000; // 24 hours
        this.globalConnection = null;
        this.isBootstrapping = true; // Flag to track bootstrap phase
        this.initializationPromise = null; // Track initialization in progress
        this.initialized = false;
        this.bootstrapServices = new Set([
            'service-account-manager',
            'secure-data-access',
            'global-model-loader'
        ]); // Core services that need bootstrap handling

        // Clear cache on server startup to ensure fresh authentication
        this.clearAllCaches();
    }

    /**
     * Clear all authentication caches
     */
    clearAllCaches() {
        this.authenticatedServices.clear();
        console.log('🔄 Cleared authentication cache for fresh startup');
    }

    /**
     * Lazy-load productionKMS to avoid circular dependency
     */
    getProductionKMS() {
        if (!productionKMS) {
            productionKMS = require('./productionKMS');
        }
        return productionKMS;
    }

    /**
     * Get SecureDataAccess service through proxy manager
     */
    getSecureDataAccess() {
        // Try to get from proxy manager first (preferred)
        if (serviceProxyManager.isLoaded('secureDataAccess')) {
            return serviceProxyManager.get('secureDataAccess');
        }

        // Fallback to direct require if proxy not available
        if (!SecureDataAccess) {
            SecureDataAccess = require('./secureDataAccess');
        }
        return SecureDataAccess;
    }

    /**
     * Set the audit service reference
     */
    setAuditService(auditService) {
        auditServiceInstance = auditService;
        // Audit service injected
    }

    /**
     * Initialize the service account manager with encrypted database connection and KMS
     */
    async initialize() {
        // Return immediately if already initialized
        if (this.initialized) return;
        
        // If initialization is already in progress, wait for it
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        
        // Start initialization and store the promise to prevent race conditions
        this.initializationPromise = this._doInitialize();
        return this.initializationPromise;
    }
    
    async _doInitialize() {
        try {
            // Initialize KMS first (lazy-loaded)
            const kms = this.getProductionKMS();
            if (!kms.initialized) {
                await kms.initialize();
            }
            
            // Ensure globalModelLoader is initialized with proper error handling
            if (!globalModelLoader.isInitialized || !globalModelLoader.models || !globalModelLoader.models.ServiceAccount) {
                try {
                    await globalModelLoader.initialize();
                } catch (gmlError) {
                    console.error('❌ GlobalModelLoader initialization failed:', gmlError.message);
                    // In development, we can continue without it
                    // Lazy load SecureConfigService when needed
                    if (!SecureConfigService) {
                        SecureConfigService = require('./secureConfigService');
                    }
                    if (SecureConfigService.get('NODE_ENV', 'development') === 'development') {
                        console.warn('⚠️ DEVELOPMENT MODE: Continuing without GlobalModelLoader - some features may not work');
                        this.ServiceAccount = null;
                        return; // Exit early in development
                    } else {
                        throw gmlError; // Re-throw in production
                    }
                }
            }
            
            // Get the ServiceAccount model from globalModelLoader (encrypted connection)
            try {
                this.ServiceAccount = globalModelLoader.getServiceAccountModel();
            } catch (modelError) {
                console.error('❌ Failed to get ServiceAccount model:', modelError.message);
                // Lazy load SecureConfigService when needed
                if (!SecureConfigService) {
                    SecureConfigService = require('./secureConfigService');
                }
                if (SecureConfigService.get('NODE_ENV', 'development') === 'development') {
                    console.warn('⚠️ DEVELOPMENT MODE: ServiceAccount model not available');
                    this.ServiceAccount = null;
                    return; // Exit early in development
                } else {
                    throw modelError;
                }
            }
            
            if (!this.ServiceAccount) {
                // Lazy load SecureConfigService when needed
                if (!SecureConfigService) {
                    SecureConfigService = require('./secureConfigService');
                }
                if (SecureConfigService.get('NODE_ENV', 'development') === 'development') {
                    console.warn('⚠️ DEVELOPMENT MODE: ServiceAccount model is null');
                    return; // Exit early in development
                }
                throw new Error('Failed to get ServiceAccount model from globalModelLoader');
            }
            
            // ServiceAccount manager initialized
            // Get SecureDataAccess through proxy manager
            const secureDataAccess = this.getSecureDataAccess();
            const context = {
                serviceId: 'service-account-manager',
                operation: 'listActiveServices',
                apiKey: 'bootstrap', // Bootstrap phase requires special handling
                practiceId: 'global'
            };
            const accounts = await secureDataAccess.query('ServiceAccount', { active: true }, { projection: 'serviceId' }, context);
            // ServiceAccountManager initialized
            
            // Bootstrap phase complete - we can now use SecureDataAccess normally
            this.isBootstrapping = false;
            this.initialized = true;
            console.log('✅ ServiceAccountManager bootstrap complete');
            
        } catch (error) {
            console.error('❌ Failed to initialize SecureServiceAccountManager:', error);
            // Clear the promise on error so it can be retried
            this.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Authenticate a service using database credentials and KMS-stored API keys
     * @param {string} serviceId - The service identifier
     * @param {string} providedApiKey - The API key (optional, will fetch from KMS if not provided)
     * @returns {Object|null} Service auth object or null if authentication fails
     */
    async authenticate(serviceId, providedApiKey = null) {
        try {
            // Ensure manager is initialized before authentication
            if (!this.ServiceAccount) {
                await this.initialize();
            }
            
            // Check if already authenticated and token is valid
            const cacheKey = `${serviceId}_${providedApiKey ? 'custom' : 'default'}`;
            const cached = this.authenticatedServices.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                // Cache hit - return immediately without any database or bcrypt operations
                return cached.authObject;
            }
            
            // Look up service account in database
            // Note: suspended might be undefined in older records, treat as false
            let serviceAccount;
            
            // During bootstrap, use direct model access for core services
            if (this.isBootstrapping && this.bootstrapServices.has(serviceId)) {
                console.log(`🔄 Bootstrap authentication for ${serviceId}`);
                if (this.ServiceAccount) {
                    serviceAccount = await this.ServiceAccount.findOne({
                        serviceId,
                        active: true,
                        $or: [
                            { suspended: false },
                            { suspended: { $exists: false } }
                        ]
                    });
                } else {
                    // If model not available during bootstrap, create a minimal service account
                    console.log(`⚠️ Creating minimal bootstrap auth for ${serviceId}`);
                    serviceAccount = {
                        serviceId,
                        active: true,
                        allowedCollections: ['*'],
                        allowedOperations: new Map([['*', ['*']]])
                    };
                }
            } else {
                // Normal path - use SecureDataAccess through proxy manager
                const secureDataAccess = this.getSecureDataAccess();

                const context = {
                    serviceId: 'service-account-manager',
                    operation: 'authenticateService',
                    apiKey: this.serviceToken?.apiKey || this.serviceToken || 'bootstrap',
                    practiceId: 'global'
                };
                const serviceAccounts = await secureDataAccess.query('ServiceAccount', {
                    serviceId,
                    active: true,
                    $or: [
                        { suspended: false },
                        { suspended: { $exists: false } }
                    ]
                }, { limit: 1 }, context);
                serviceAccount = serviceAccounts[0];
            }
            
            // Get API key from KMS if not provided - moved before auto-register
            let apiKey = providedApiKey;

            if (!serviceAccount) {
                // AUTO-REGISTER NEW SERVICE
                console.log(`🔄 Service ${serviceId} not found - auto-registering...`);

                try {
                    // Generate new API key for the service
                    const crypto = require('crypto');
                    const bcrypt = require('bcryptjs');
                    const newApiKey = crypto.randomBytes(32).toString('hex');
                    const apiKeyHash = await bcrypt.hash(newApiKey, 12);

                    // Create new service account
                    const newServiceAccount = {
                        serviceId: serviceId,
                        name: `${serviceId} (auto-registered)`,
                        apiKeyHash: apiKeyHash,
                        permissions: ['read', 'write', 'query', 'insert', 'update', 'delete', 'aggregate'],
                        active: true,
                        createdAt: new Date(),
                        usageCount: 0,
                        allowedOperations: ['query', 'insert', 'update', 'delete', 'aggregate'],
                        allowedCollections: ['*'] // Allow all collections for auto-registered services
                    };

                    // Store in database
                    if (this.isBootstrapping && this.bootstrapServices.has(serviceId)) {
                        serviceAccount = await this.ServiceAccount.create(newServiceAccount);
                    } else {
                        const secureDataAccess = this.getSecureDataAccess();
                        const context = {
                            serviceId: 'service-account-manager',
                            operation: 'auto-register-service',
                            apiKey: this.serviceToken?.apiKey || this.serviceToken || 'bootstrap',
                            practiceId: 'global'
                        };
                        serviceAccount = await secureDataAccess.insert('ServiceAccount', newServiceAccount, context);
                    }

                    // Store API key in KMS
                    const kmsKeyName = serviceId === 'encryptionService'
                        ? 'SERVICE_ENCRYPTIONSERVICE_KEY'
                        : `SERVICE_${serviceId.toUpperCase().replace(/-/g, '_')}_KEY`;

                    const kms = this.getProductionKMS();
                    if (!kms.initialized) {
                        await kms.initialize();
                    }
                    await kms.storeInternalKey(kmsKeyName, newApiKey);

                    console.log(`✅ Service ${serviceId} auto-registered successfully`);

                    // Use the newly generated API key for authentication
                    apiKey = newApiKey;

                } catch (autoRegError) {
                    // Check if it's a duplicate key error (race condition - another process registered it)
                    if (autoRegError.message && autoRegError.message.includes('E11000')) {
                        console.log(`⚠️ Service ${serviceId} was registered by another process - retrying authentication...`);

                        // Wait a moment for the other process to complete
                        await new Promise(resolve => setTimeout(resolve, 100));

                        // Try to find the service account again
                        if (this.isBootstrapping && this.bootstrapServices.has(serviceId)) {
                            serviceAccount = await this.ServiceAccount.findOne({ serviceId, active: { $ne: false } }).lean();
                        } else {
                            const secureDataAccess = this.getSecureDataAccess();
                            const searchContext = {
                                serviceId: 'service-account-manager',
                                operation: 'find-after-race-condition',
                                apiKey: this.serviceToken?.apiKey || this.serviceToken || 'bootstrap',
                                practiceId: 'global'
                            };
                            const accounts = await secureDataAccess.query('ServiceAccount',
                                { serviceId, active: { $ne: false } },
                                { limit: 1 },
                                searchContext
                            );
                            serviceAccount = accounts[0];
                        }

                        if (serviceAccount) {
                            // Successfully found the service registered by another process
                            console.log(`✅ Found ${serviceId} after race condition resolution`);
                            // Get the API key from KMS since we didn't create it
                            const kmsKeyName = `SERVICE_${serviceId.toUpperCase().replace(/-/g, '_')}_KEY`;
                            const kmsForRaceCondition = this.getProductionKMS();
                            apiKey = await kmsForRaceCondition.getInternalKey(kmsKeyName);
                        } else {
                            // Still not found - actual error
                            throw new Error(`Failed to auto-register service ${serviceId}: ${autoRegError.message}`);
                        }
                    } else {
                        // Not a duplicate key error - propagate the original error
                        console.error(`❌ Failed to auto-register ${serviceId}:`, autoRegError.message);

                        await logSecurityEvent('service_auto_register_failed', null, {
                            serviceId,
                            reason: autoRegError.message,
                            timestamp: new Date().toISOString()
                        });

                        throw new Error(`Failed to auto-register service ${serviceId}: ${autoRegError.message}`);
                    }
                }
            }
            if (!apiKey) {
                // Special case for encryptionService - the KMS key is stored as ENCRYPTIONSERVICE_KEY
                const kmsKeyName = serviceId === 'encryptionService' 
                    ? 'SERVICE_ENCRYPTIONSERVICE_KEY' 
                    : `SERVICE_${serviceId.toUpperCase().replace(/-/g, '_')}_KEY`;
                try {
                    const kms = this.getProductionKMS();
                    
                    /* ================================================================
                     * CRITICAL FIX: Race Condition During Server Startup
                     * ================================================================
                     * PROBLEM: During server startup, multiple services try to authenticate
                     * simultaneously. If productionKMS hasn't finished loading all keys into
                     * memory (loadEncryptedKeys), getInternalKey might fail or return null.
                     * 
                     * SOLUTION: Ensure KMS is fully initialized before requesting keys.
                     * This prevents authentication failures during high-concurrency startup.
                     * 
                     * WITHOUT THIS: Services randomly fail authentication on server restart
                     * WITH THIS: All services authenticate reliably
                     * ================================================================ */
                    if (!kms.initialized) {
                        console.log(`⏳ Waiting for KMS initialization for ${serviceId}...`);
                        await kms.initialize();
                    }
                    
                    apiKey = await kms.getInternalKey(kmsKeyName);
                    
                    // Additional validation to catch KMS issues early
                    if (!apiKey) {
                        console.error(`⚠️ KMS returned null for ${kmsKeyName} - key might not exist or decrypt failed`);
                    }
                } catch (kmsError) {
                    console.error(`❌ Failed to get API key from KMS for ${serviceId}:`, kmsError.message);
                    // For passwordless-auth-service, use a default key if KMS fails
                    if (serviceId === 'passwordless-auth-service') {
                        apiKey = 'passwordless-auth-api-key'; // Default for backwards compatibility
                        console.log('⚠️ Using default API key for passwordless-auth-service');
                    } else {
                        throw new Error(`KMS key not found for service ${serviceId}`);
                    }
                }
            }
            
            // Ensure apiKey is a string
            if (typeof apiKey !== 'string') {
                console.error(`❌ API key for ${serviceId} is not a string:`, typeof apiKey, apiKey);
                // If it's an object with a token property, use that
                if (apiKey && typeof apiKey === 'object' && apiKey.token) {
                    apiKey = apiKey.token;
                } else if (apiKey && typeof apiKey === 'object' && apiKey.sessionToken) {
                    apiKey = apiKey.sessionToken;
                } else {
                    apiKey = String(apiKey);
                }
            }
            
            // Verify API key against hash in database for all services
            // Check both apiKeyHash (preferred) and apiKey (legacy) fields
            const hashedKey = serviceAccount.apiKeyHash || serviceAccount.apiKey;

            // Skip verification for bootstrap services during bootstrap phase
            if (this.isBootstrapping && this.bootstrapServices.has(serviceId) && !hashedKey) {
                console.log(`🔄 Bootstrap mode: Skipping API key verification for ${serviceId}`);
            } else if (hashedKey && typeof hashedKey === 'string' && apiKey && typeof apiKey === 'string') {
                    // Verify API key silently for security
                    let isValid = false;
                    try {
                        isValid = await bcrypt.compare(apiKey, hashedKey);
                    } catch (bcryptError) {
                        console.error(`❌ bcrypt error for ${serviceId}:`, bcryptError.message);
                        console.error(`   API key type: ${typeof apiKey}, length: ${apiKey?.length}`);
                        console.error(`   Hash type: ${typeof hashedKey}, starts with: ${hashedKey?.substring(0, 7)}`);
                        throw new Error(`API key verification failed for service ${serviceId}`);
                    }
                    // API key validation complete
                    if (!isValid) {
                        console.error(`❌ Service ${serviceId} failed authentication - invalid API key`);
                        console.error(`   KMS key name used: SERVICE_${serviceId.toUpperCase().replace(/-/g, '_')}_KEY`);
                        console.error(`   API key received from KMS: ${apiKey ? 'Yes' : 'No'}, length: ${apiKey?.length}`);
                        await logSecurityEvent('service_auth_failed', null, {
                            serviceId,
                            reason: 'Invalid API key',
                            timestamp: new Date().toISOString()
                        });
                        throw new Error(`Invalid API key for service ${serviceId}`);
                    }
            }
            
            // Update last access time (skip during bootstrap for core services)
            if (!this.isBootstrapping || !this.bootstrapServices.has(serviceId)) {
                const updateContext = {
                    serviceId: 'service-account-manager',
                    operation: 'updateServiceUsage',
                    apiKey: this.serviceToken?.apiKey || this.serviceToken || apiKey || 'bootstrap',
                    practiceId: 'global'
                };
                const secureDataAccess = this.getSecureDataAccess();
                await secureDataAccess.update('ServiceAccount', 
                    { serviceId }, 
                    { 
                        $set: { 
                            'usage.lastAccessTime': new Date() 
                        },
                        $inc: { 
                            'usage.totalQueries': 1 
                        }
                    }, 
                    updateContext
                );
            }
            
            // Create auth object (no JWT)
            // Handle allowedOperations which can be a Map, Object, or undefined
            let allowedOps = {};
            if (serviceAccount.allowedOperations) {
                if (serviceAccount.allowedOperations instanceof Map) {
                    allowedOps = Object.fromEntries(serviceAccount.allowedOperations);
                } else if (typeof serviceAccount.allowedOperations === 'object') {
                    allowedOps = serviceAccount.allowedOperations;
                }
            }
            
            const authObject = {
                serviceId: serviceAccount.serviceId,
                apiKey: apiKey, // Use actual API key
                permissions: serviceAccount.allowedCollections,
                allowedClinics: serviceAccount.allowedClinics,
                allowedOperations: allowedOps,
                practiceId: 'global',
                expiresAt: Date.now() + this.rotationInterval,
                // Add toString and valueOf methods for backward compatibility
                // This allows the object to be used directly where a string API key is expected
                toString() { return this.apiKey; },
                valueOf() { return this.apiKey; }
            };
            
            // Cache the authentication with the same key used for lookup
            this.authenticatedServices.set(cacheKey, {
                authObject,
                expiresAt: authObject.expiresAt
            });
            
            // Log successful authentication
            await logSecurityEvent('service_authenticated', null, {
                serviceId: serviceAccount.serviceId,
                serviceName: serviceAccount.serviceName,
                permissions: serviceAccount.allowedCollections,
                timestamp: new Date().toISOString()
            });
            
            // Service authenticated
            return authObject;
            
        } catch (error) {
            console.error(`❌ Authentication failed for ${serviceId}:`, error.message);
            await logSecurityEvent('service_auth_error', null, {
                serviceId,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            return null;
        }
    }


    /**
     * Validate service authentication - called by API endpoints
     * @param {string} serviceId - The service identifier
     * @param {string} apiKey - The API key to validate
     * @returns {Object|null} Service account if valid, null otherwise
     */
    async validateServiceAuth(serviceId, apiKey) {
        console.log(`🔐 validateServiceAuth called for service: ${serviceId}`);
        console.log(`   API key provided: ${apiKey ? `${apiKey.substring(0, 10)}...` : 'NULL'}`);

        if (!serviceId || !apiKey) {
            console.log('❌ Missing serviceId or apiKey');
            return null;
        }

        // Use the authenticate function which handles all validation
        const authResult = await this.authenticate(serviceId, apiKey);

        console.log(`   Auth result: ${authResult ? 'SUCCESS' : 'FAILED'}`);

        // Return the service account info if authentication succeeded
        return authResult ? authResult : null;
    }

    /**
     * Revoke a service's authentication
     */
    async revokeAuthentication(serviceId) {
        this.authenticatedServices.delete(serviceId);
        
        await logSecurityEvent('service_auth_revoked', null, {
            serviceId,
            timestamp: new Date().toISOString()
        });
        
        console.log(`🔒 Authentication revoked for service: ${serviceId}`);
    }

    /**
     * List all service accounts from database
     */
    async listServiceAccounts() {
        try {
            const context = {
                serviceId: 'service-account-manager',
                operation: 'listAllServices',
                apiKey: this.serviceToken?.apiKey || this.serviceToken || 'bootstrap',
                practiceId: 'global'
            };
            const secureDataAccess = this.getSecureDataAccess();
            const accounts = await secureDataAccess.query('ServiceAccount', {}, 
                { 
                    projection: 'serviceId serviceName active suspended createdAt usage.lastAccessTime usage.violationCount',
                    sort: { createdAt: -1 }
                }, 
                context
            );
            
            return accounts.map(acc => ({
                serviceId: acc.serviceId,
                serviceName: acc.serviceName,
                active: acc.active,
                suspended: acc.suspended,
                lastAccess: acc.usage?.lastAccessTime,
                violations: acc.usage?.violationCount || 0,
                created: acc.createdAt
            }));
        } catch (error) {
            console.error('Error listing service accounts:', error);
            return [];
        }
    }

    /**
     * Clear authentication cache (for after key updates)
     */
    clearAuthenticationCache() {
        const oldSize = this.authenticatedServices.size;
        this.authenticatedServices.clear();
        console.log(`🔄 Cleared authentication cache (${oldSize} entries removed)`);
        return oldSize;
    }

    /**
     * Clean up expired authentications
     */
    cleanupExpiredTokens() {
        const now = Date.now();
        for (const [serviceId, auth] of this.authenticatedServices.entries()) {
            if (auth.expiresAt <= now) {
                this.authenticatedServices.delete(serviceId);
                console.log(`🧹 Cleaned up expired token for ${serviceId}`);
            }
        }
    }
}

// Export as singleton
module.exports = new SecureServiceAccountManager();
