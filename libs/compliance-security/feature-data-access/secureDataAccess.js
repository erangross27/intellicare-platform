/**
 * 🔒 SECURITY CRITICAL - DO NOT BYPASS THIS SERVICE
 *
 * This is the ONLY authorized way to access practice databases.
 * Direct mongoose/MongoDB access is PROHIBITED and will be blocked.
 *
 * Any AI agent or developer MUST use this service for data access.
 * Bypassing this service is a SECURITY VIOLATION.
 *
 * If you need to access data, use:
 * const SecureDataAccess = require('./services/secureDataAccess');
 * const data = await SecureDataAccess.query(collection, filter, options);
 *
 * For internal system-generated queries only:
 * const data = await SecureDataAccess.internalQuery(collection, filter, options, context);
 * ⚠️  WARNING: internalQuery() ONLY for pre-validated queries, NEVER for user input!
 *
 * NEVER use:
 * - mongoose.connection.db
 * - databaseFactory.getClinicDatabase() directly
 * - Any direct MongoDB operations
 */

const crypto = require('crypto');
const { detectSqlInjection, detectNoSqlInjection, validateInput } = require('../../../backend/utils/securityUtils');

// Add service proxy getter
let simpleServiceProxy = null;
function getServiceProxy() {
    if (!simpleServiceProxy) {
        simpleServiceProxy = require('../../../backend/services/simpleServiceProxy');
    }
    return simpleServiceProxy;
}

class SecureDataAccess {
  constructor() {
    this.accessCache = new Map();
    this.policyCache = new Map();
    this.activeTransactions = new Map();
    this.queryHistory = [];
    this.suspiciousPatterns = new Set();
    
    // Track direct access attempts for blocking
    this.directAccessAttempts = new Map();
    this.blockedServices = new Set();
    
    // Connection cache with timestamp
    this.connectionCache = new Map();
    this.connectionCacheTTL = 3600000; // 1 hour cache - connections are pooled and managed by MongoDB driver
    
    // Service account validation cache for performance (5 min TTL)
    this.serviceAccountCache = new Map();
    this.serviceAccountCacheTTL = 300000; // 5 minutes
    
    // Track which practices we've logged initial connection for
    this.loggedConnections = new Set();
    
    // Read-only mode for emergencies
    this.readOnlyMode = false;
    
    // Initialize monitoring
    this.initializeMonitoring();
  }

  async initialize() {
    const proxy = getServiceProxy();
    const serviceAccountManager = proxy.getService('serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('secure-data-access');
    console.log('✅ [SecureDataAccess] Service initialized with security enforcement enabled');
    return this;
  }

  /**
   * Initialize real-time monitoring of database access patterns
   */
  initializeMonitoring() {
    setInterval(() => {
      this.analyzeAccessPatterns();
      this.detectAnomalies();
      this.enforceRateLimits();
    }, 5000);
  }

  /**
   * Main query method - ALL database access must go through here
   */
  async query(collection, filter = {}, options = {}, context = {}) {
    const startTime = Date.now();
    const queryId = crypto.randomBytes(16).toString('hex');
    
    try {
      // Check if in read-only mode
      if (this.readOnlyMode && options.operation !== 'read') {
        throw new Error('SECURITY: System in read-only mode - write operations blocked');
      }
      
      // 1. Validate service credentials
      const serviceAccount = await this.validateServiceAccount(context);
      if (!serviceAccount) {
        throw new Error('SECURITY: Unauthorized service access attempt');
      }

      // 2. Check if service is blocked
      if (this.blockedServices.has(serviceAccount.serviceId)) {
        throw new Error(`SECURITY: Service ${serviceAccount.serviceId} is blocked`);
      }

      // 3. Check collection access permissions
      if (!this.isCollectionAllowed(serviceAccount, collection)) {
        await this.logSecurityViolation('COLLECTION_ACCESS_DENIED', {
          service: serviceAccount.serviceId,
          collection,
          filter
        });
        throw new Error(`SECURITY: Service ${serviceAccount.serviceId} not authorized for collection ${collection}`);
      }

      // 4. CRITICAL: Detect and reject Mongoose objects (MEDICAL PLATFORM SECURITY)
      this.validateNotMongooseObject(filter, 'filter');
      this.validateNotMongooseObject(options, 'options');
      
      // 5. Sanitize filter to ensure only plain objects reach MongoDB
      filter = this.sanitizeToPlainObject(filter);
      options = this.sanitizeToPlainObject(options);
      
      // 6. Validate no prototype pollution
      this.validateNoPrototypePollution(filter);
      
      // 7. Validate aggregation pipeline if present
      if (options.aggregate) {
        this.validateAggregationPipeline(options.aggregate);
      }

      // 8. SQL/NoSQL Injection prevention (skip for system services and internal queries)
      if (context.queryType !== 'INTERNAL_SERVICE' && !serviceAccount.isSystemService) {
        if (detectSqlInjection(JSON.stringify(filter)) || detectNoSqlInjection(filter)) {
          await this.logSecurityViolation('INJECTION_DETECTED', {
            service: serviceAccount.serviceId,
            collection,
            filter
          });
          throw new Error('SECURITY: Potential injection attack detected');
        }
      }

      // 9. Apply data access policies
      const policy = await this.getAccessPolicy(serviceAccount, collection);
      filter = this.applyRowLevelSecurity(filter, policy, context, collection);
      
      // 10. CRITICAL: Final sanitization after all modifications
      // This ensures NO Mongoose properties reach MongoDB even if they were added by policy
      filter = this.sanitizeToPlainObject(filter);
      options = this.sanitizeToPlainObject(options);

      // 5. Field-level security
      const allowedFields = this.getAllowedFields(policy, serviceAccount);
      if (options.projection) {
        options.projection = this.filterProjection(options.projection, allowedFields);
      }

      // 6. Rate limiting per service
      await this.enforceServiceRateLimit(serviceAccount.serviceId, collection);

      // 7. Get practice database with security context
      // CRITICAL: Use practiceSubdomain if available to prevent ObjectId usage
      const dbIdentifier = context.practiceSubdomain || context.practiceId;
      const practiceDb = await this.getSecureDatabase(dbIdentifier, context.serviceId);
      
      // 8. Execute query with monitoring
      const result = await this.executeSecureQuery(practiceDb, collection, filter, options);

      // 9. Apply field masking
      const maskedResult = this.applyFieldMasking(result, policy);

      // 10. Audit log the access (async - don't wait)
      this.auditDataAccess({
        queryId,
        serviceId: serviceAccount.serviceId,
        collection,
        operation: 'query',
        filter: this.sanitizeForAudit(filter),
        recordCount: Array.isArray(maskedResult) ? maskedResult.length : 1,
        duration: Date.now() - startTime,
        practiceId: context.practiceId
      });

      return maskedResult;

    } catch (error) {
      await this.handleSecurityError(error, {
        queryId,
        collection,
        filter,
        context
      });
      throw error;
    }
  }

  /**
   * Internal query method for pre-validated system queries
   * 
   * ⚠️  WARNING: ONLY use for system-generated queries, NEVER for user input!
   * 
   * This method is designed for internal services that generate queries programmatically
   * and have already validated the input. It skips injection detection but maintains
   * all other security measures including authentication, authorization, and audit logging.
   * 
   * @param {string} collection - Collection name
   * @param {Object} filter - Query filter (must be pre-validated)
   * @param {Object} options - Query options
   * @param {Object} context - Security context
   * @returns {Promise} Query results
   */
  async internalQuery(collection, filter = {}, options = {}, context = {}) {
    // Mark as internal query for audit logging
    context.queryType = 'INTERNAL_SERVICE';
    
    // Use the regular query method but with internal flag
    return this.query(collection, filter, options, context);
  }

  /**
   * Multi-practice query method for monitoring services
   * 
   * This method allows services to query multiple practices in a single operation,
   * avoiding the need to create separate connections for each practice.
   * 
   * @param {string} collection - Collection name to query
   * @param {Array<string>} practiceIds - Array of practice IDs to query
   * @param {Object} filter - Query filter
   * @param {Object} options - Query options
   * @param {Object} context - Security context
   * @returns {Promise<Object>} Results grouped by practice ID
   */
  async multiClinicQuery(collection, practiceIds, filter = {}, options = {}, context = {}) {
    const startTime = Date.now();
    const queryId = crypto.randomUUID();
    
    try {
      // 1. Validate service credentials
      const serviceAccount = await this.validateServiceAccount(context);
      if (!serviceAccount) {
        throw new Error('SECURITY: Unauthorized service access attempt');
      }

      // 2. Check if collection access is allowed
      if (!this.isCollectionAllowed(serviceAccount, collection)) {
        throw new Error(`SECURITY: Service ${serviceAccount.serviceId} not authorized for collection ${collection}`);
      }

      // 3. Check if operation is allowed
      const operation = options.operation || 'read';
      if (!this.isOperationAllowed(serviceAccount, collection, operation)) {
        throw new Error(`SECURITY: Operation ${operation} not allowed for service ${serviceAccount.serviceId}`);
      }

      const results = {};
      const errors = {};
      
      // Use Promise.allSettled for parallel execution but handle errors gracefully
      const queries = practiceIds.map(async (practiceId) => {
        try {
          // Get a connection for this practice - reuse existing connections
          const practiceDb = await this.getSecureDatabase(practiceId, context.serviceId);
          
          // Execute query for this practice
          const practiceResults = await this.executeSecureQuery(practiceDb, collection, filter, options);
          
          return { practiceId, results: practiceResults };
        } catch (error) {
          // Don't throw - collect errors per practice
          return { practiceId, error: error.message };
        }
      });
      
      const settledResults = await Promise.allSettled(queries);
      
      // Process results
      for (const result of settledResults) {
        if (result.status === 'fulfilled') {
          const { practiceId, results: practiceResults, error } = result.value;
          if (error) {
            errors[practiceId] = error;
          } else {
            results[practiceId] = practiceResults;
          }
        } else {
          // Should not happen with our error handling, but just in case
          console.error('Unexpected error in multi-practice query:', result.reason);
        }
      }
      
      // Audit log the multi-practice access
      this.auditDataAccess({
        queryId,
        serviceId: serviceAccount.serviceId,
        collection,
        operation: 'multi-practice-query',
        practiceCount: practiceIds.length,
        successCount: Object.keys(results).length,
        errorCount: Object.keys(errors).length,
        duration: Date.now() - startTime
      });
      
      return {
        results,
        errors,
        summary: {
          totalClinics: practiceIds.length,
          successful: Object.keys(results).length,
          failed: Object.keys(errors).length,
          duration: Date.now() - startTime
        }
      };
      
    } catch (error) {
      await this.handleSecurityError(error, {
        queryId,
        collection,
        filter,
        context,
        practiceIds
      });
      throw error;
    }
  }

  /**
   * Secure insert operation
   */
  async insert(collection, document, context = {}) {
    // Validate context structure first
    if (!context || typeof context !== 'object') {
      throw new Error('SECURITY: Invalid or missing context');
    }
    
    if (!context.serviceId) {
      throw new Error(`SECURITY: Missing serviceId in context`);
    }
    
    // Validate service account
    const serviceAccount = await this.validateServiceAccount(context);
    
    // CRITICAL NULL CHECK - No fallback
    if (!serviceAccount) {
      throw new Error(`SECURITY: Service ${context.serviceId} authentication failed - no valid account`);
    }
    
    // Now safe to access properties
    if (!this.isOperationAllowed(serviceAccount, collection, 'insert')) {
      throw new Error(`SECURITY: Insert operation not allowed for service ${serviceAccount.serviceId}`);
    }

    // Validate required fields
    const policy = await this.getAccessPolicy(serviceAccount, collection);
    this.validateRequiredFields(document, policy);

    // Add security metadata
    document._securityMetadata = {
      createdBy: serviceAccount.serviceId,
      createdAt: new Date(),
      encryptionVersion: 'v2',
      accessLevel: policy.defaultAccessLevel || 'restricted'
    };

    // Encrypt sensitive fields
    document = await this.encryptSensitiveFields(document, policy);

    const practiceDb = await this.getSecureDatabase(context.practiceId, context.serviceId);
    // Handle both Mongoose and native MongoDB connections
    const nativeDb = practiceDb.db ? practiceDb.db : practiceDb;
    const result = await nativeDb.collection(collection).insertOne(document);

    this.auditDataAccess({
      serviceId: serviceAccount.serviceId,
      collection,
      operation: 'insert',
      documentId: result.insertedId,
      practiceId: context.practiceId
    });

    // Return the inserted document with its _id
    if (result.insertedId) {
      document._id = result.insertedId;
      return document;
    }
    return result;
  }

  /**
   * Secure update operation
   */
  async update(collection, filter, update, context = {}) {
    const serviceAccount = await this.validateServiceAccount(context);
    
    if (!this.isOperationAllowed(serviceAccount, collection, 'update')) {
      throw new Error(`SECURITY: Update operation not allowed for service ${serviceAccount.serviceId}`);
    }

    // Ensure update uses MongoDB operators
    if (!update.$set && !update.$unset && !update.$inc && !update.$push && !update.$pull && !update.$addToSet) {
      // If no operators present, wrap entire update in $set
      update = { $set: update };
    }

    // Prevent updating security metadata
    if (update.$set && update.$set._securityMetadata) {
      delete update.$set._securityMetadata;
    }

    // Add update tracking
    if (!update.$set) update.$set = {};
    update.$set._lastModifiedBy = serviceAccount.serviceId;
    update.$set._lastModifiedAt = new Date();

    const practiceDb = await this.getSecureDatabase(context.practiceId, context.serviceId);
    // Handle both Mongoose and native MongoDB connections
    const nativeDb = practiceDb.db ? practiceDb.db : practiceDb;
    const result = await nativeDb.collection(collection).updateMany(filter, update);

    this.auditDataAccess({
      serviceId: serviceAccount.serviceId,
      collection,
      operation: 'update',
      filter: this.sanitizeForAudit(filter),
      modifiedCount: result.modifiedCount,
      practiceId: context.practiceId
    });

    return result;
  }

  /**
   * Secure delete operation
   * @param {boolean} options.hardDelete - If true, permanently removes the document (use with caution)
   */
  async delete(collection, filter, context = {}, options = {}) {
    const serviceAccount = await this.validateServiceAccount(context);
    
    if (!this.isOperationAllowed(serviceAccount, collection, 'delete')) {
      throw new Error(`SECURITY: Delete operation not allowed for service ${serviceAccount.serviceId}`);
    }

    const practiceDb = await this.getSecureDatabase(context.practiceId, context.serviceId);
    
    let result;
    if (options.hardDelete === true && (collection === 'chat_sessions' || collection === 'chat_messages')) {
      // Allow hard delete only for chat data (non-medical records)
      // Handle both Mongoose and native MongoDB connections
      const nativeDb = practiceDb.db ? practiceDb.db : practiceDb;
      result = await nativeDb.collection(collection).deleteMany(filter);
      console.log(`🗑️ [SecureDataAccess] Hard deleted ${result.deletedCount} documents from ${collection}`);
    } else {
      // Soft delete by default for audit trail
      const softDelete = {
        $set: {
          _deleted: true,
          _deletedBy: serviceAccount.serviceId,
          _deletedAt: new Date()
        }
      };
      // Handle both Mongoose and native MongoDB connections
      const nativeDb = practiceDb.db ? practiceDb.db : practiceDb;
      result = await nativeDb.collection(collection).updateMany(filter, softDelete);
      console.log(`🗑️ [SecureDataAccess] Soft deleted ${result.modifiedCount} documents from ${collection}`);
    }

    this.auditDataAccess({
      serviceId: serviceAccount.serviceId,
      collection,
      operation: 'delete',
      filter: this.sanitizeForAudit(filter),
      deletedCount: result.modifiedCount,
      practiceId: context.practiceId
    });

    return result;
  }

  /**
   * Validate service account credentials
   */
  async validateServiceAccount(context) {
    if (!context || typeof context !== 'object') {
      return null;
    }

    // Check for required fields
    if (!context.serviceId) {
      return null;
    }
    
    // Check cache first for performance
    const cacheKey = `${context.serviceId}:${context.apiKey || ''}`;
    const cached = this.serviceAccountCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.serviceAccountCacheTTL) {
      return cached.account;
    }

    // System services get automatic approval with proper audit
    // These are core platform services that need access to perform their functions
    const systemServices = [
      // Core security services
      'secure-data-access',
      'audit-log-service',
      'security-monitoring-service',
      'incident-response-service',
      'zero-trust-service',
      'service-account-rotation',
      
      // Authentication services
      'auth-ai-service',
      'passwordless-auth-service',
      'otp-service',  // OTP authentication service
      'practice-auth-service',
      'practice-context-middleware',
      
      // Chat service
      'chat-service',
      
      // Core backend services from server.js
      'key-management-service',
      'e2e-encryption-service',
      'db-optimization-service',
      'api-versioning-service',
      'tracing-service',
      'circuit-breaker-service',
      'retry-service',
      'secrets-management-service',
      'compliance-reporting-service',
      'load-balancing-service',
      'disaster-recovery-service',
      'secure-config-service',
      'immutable-audit-service',
      'service-account-manager',
      'global-model-loader',
      'production-kms',
      'blockchain-audit-service',
      'security-chaos-service',
      'secure-session-manager',
      
      // Medical and AI services
      'agent-service',
      'agent-service-v3',
      'agent-service-v4',
      'agent-service-wrapper',
      'agent-service-claude',
      'gemini-service',
      'gemini-medical-service',
      'diagnostic-service-new',
      'document-analysis-service',
      'medical-model-service',
      'medical-parsing-service',
      'clinical-decision-support',
      'treatment-recommender',
      
      // Chat and messaging services
      'chat-service',
      
      // Cost tracking services
      'cost-tracking-db',
      
      // Essential middleware services
      'encryption-service',
      'encryptionService', // Alternative name used in code
      'audit-log-service',
      'practice-context-middleware',
      'symptom-analyzer',
      'vital-signs-analyzer',
      'allergy-checker',
      'drug-interaction-service',
      'emergency-protocol-detector',
      'lab-result-interpreter',
      'insurance-service',
      'prescription-generator',
      
      // Batch and worker services
      'batch-results-worker',
      'batch-document-processor',
      'claude-batch-processor',
      'reminder-service',
      'data-retention-service',
      'appointments-service',
      
      // Compliance and analytics
      'compliance-scorecard',
      'compliance-analytics-service',
      'compliance-reporting-service',
      'communication-audit-service',
      'breach-notification-service',
      'vendor-risk-service',
      'security-audit-service',
      'security-training-service',
      
      // Infrastructure services
      'email-service',
      'translation-service',
      'currency-service',
      'encryption-service',
      'access-request-service',
      'report-generator',
      'rbac-service',
      'long-operation-websocket-service',
      'backup-ai-provider-service',
      'gemini-cache-service',
      'consent-management-service',
      'queue-management-service',
      'policy-management-service',
      'patient-deletion-service',
      'mfa-service',
      'service-token-rotation',
      'ai-response-cache-service',
      'phi-anonymization-service',
      'enhanced-health-check-service',
      'documentation-service',
      'claude-cache-monitor',
      'cost-tracking-service',
      'cost-tracking-service-db',
      'security-alerts',
      'availability-service',
      'gemini-cost-tracker',
      'ai-circuit-breaker-service',
      'api-rate-limiter',
      'emergency-response',
      'security-headers-optimization-service',
      'threat-detection-service',
      'zero-knowledge-auth-service',
      'ai-security-wrapper',
      
      // External integrations
      'israel-post-service',
      'israel-post-api-service',
      'google-places-service',
      'address-lookup-service',
      'manual-address-service',
      'calendar-sync-service',
      'improved-ocr-service',
      
      // Security utilities
      'secure-http-client',
      'agent-capability-manager',
      'csp-service',
      'safe-dynamic-execution',
      'path-security-validator',
      'request-signing',
      'security-header-validator',
      'performance-optimizations',
      'data-gov-il-service',
      'data-gov-il-jsonp-service',
      'claude-oauth-service',
      'claude-batch-service',
      'graphql-security-service',
      'hybrid-ai-service',
      'google-kms-service',
      'baa-management-service',
      'internal-api-client',
      'file-cleanup'
    ];
    
    if (systemServices.includes(context.serviceId)) {
      // Log system service access
      await this.logSystemServiceAccess(context.serviceId);
      const account = {
        serviceId: context.serviceId,
        permissions: context.permissions || ['*'],
        allowedOperations: { '*': ['query', 'update', 'insert', 'delete'] },
        allowedCollections: ['*'],
        isSystemService: true
      };
      
      // Cache the validated account for performance
      this.serviceAccountCache.set(cacheKey, { account, timestamp: Date.now() });
      
      return account;
    }

    // No JWT validation - removed completely
    // Services now authenticate with API keys only

    // NO FALLBACKS - Medical platform security
    // API key must be validated through proper ServiceAccount

    // Try database validation - NO FALLBACK
    // cacheKey already declared above, reuse it for accessCache check
    if (this.accessCache.has(cacheKey)) {
      return this.accessCache.get(cacheKey);
    }

    try {
      // Get globalModelLoader through proxy to avoid circular dependency
      const proxy = getServiceProxy();
      const globalModelLoader = proxy.getService('globalModelLoader');
      
      // Check if global model loader is ready (handle circular dependency case)
      if (!globalModelLoader || !('isReady' in globalModelLoader) || typeof globalModelLoader.isReady !== 'function' || !globalModelLoader.isReady()) {
        console.error(`❌ SECURITY VIOLATION: Global model loader not ready for service '${context ? context.serviceId : 'UNKNOWN'}' - ACCESS DENIED`);
        return null; // NO FALLBACK - Medical platform security
      }

      const ServiceAccount = globalModelLoader.getServiceAccountModel();
      
      // Add timeout protection for MongoDB queries
      const queryPromise = ServiceAccount.findOne({
        serviceId: context.serviceId,
        active: true
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Service account validation timeout')), 10000)
      );

      const account = await Promise.race([queryPromise, timeoutPromise]);

      if (account && context.apiKey) {
        // Verify API key hash (field is 'apiKeyHash' in the database)
        const bcrypt = require('bcryptjs');
        const isValidKey = await bcrypt.compare(context.apiKey, account.apiKeyHash);
        
        if (!isValidKey) {
          console.error(`❌ Invalid API key for service ${context.serviceId}`);
          return null;
        }
        
        this.accessCache.set(cacheKey, account);
        setTimeout(() => this.accessCache.delete(cacheKey), 300000); // 5 min cache
        
        // Convert Map to plain object if needed
        let allowedOps = account.allowedOperations;
        if (allowedOps instanceof Map) {
          const opsObj = {};
          for (const [key, value] of allowedOps) {
            opsObj[key] = value;
          }
          allowedOps = opsObj;
        }
        
        return {
          serviceId: account.serviceId,
          permissions: account.permissions || ['*'],
          allowedOperations: allowedOps || { '*': ['*'] },
          allowedCollections: account.allowedCollections || ['*'],
          isSystemService: false
        };
      }

      console.error(`❌ SECURITY VIOLATION: No valid ServiceAccount found for service '${context.serviceId || 'UNKNOWN'}' - ACCESS DENIED`);
      return null; // NO FALLBACK
    } catch (error) {
      console.error(`Service account validation error for ${context.serviceId}:`, {
        error: error.message,
        serviceId: context.serviceId,
        hasApiKey: !!context.apiKey,
        timestamp: new Date().toISOString()
      });
      
      console.error(`❌ SECURITY VIOLATION: No valid ServiceAccount found for service '${context.serviceId || 'UNKNOWN'}' - ACCESS DENIED`);
      return null; // NO FALLBACK
    }
  }

  // NO FALLBACK METHOD - Removed for medical platform security
  // All services MUST authenticate properly or be denied

  /**
   * Check if collection access is allowed
   */
  isCollectionAllowed(serviceAccount, collection) {
    if (!serviceAccount) return false;

    // System services can access all collections
    if (serviceAccount.isSystemService) return true;

    // Check allowedCollections array
    if (!serviceAccount.allowedCollections || serviceAccount.allowedCollections.length === 0) {
      return false;
    }
    
    // Check permissions array for wildcard or specific collection
    if (serviceAccount.permissions && serviceAccount.permissions.includes('*')) return true;
    if (serviceAccount.permissions && serviceAccount.permissions.includes(collection)) return true;
    
    return serviceAccount.allowedCollections.includes('*') || 
           serviceAccount.allowedCollections.includes(collection);
  }

  /**
   * Check if operation is allowed
   */
  isOperationAllowed(serviceAccount, collection, operation) {
    if (!serviceAccount) return false;
    
    // System services have all permissions
    if (serviceAccount.isSystemService) return true;
    
    if (!serviceAccount.allowedOperations) return false;
    
    // Handle Map objects from MongoDB
    let allowedOps;
    if (serviceAccount.allowedOperations instanceof Map) {
      allowedOps = serviceAccount.allowedOperations.get(collection) || 
                   serviceAccount.allowedOperations.get('*');
    } else {
      // Handle regular objects
      allowedOps = serviceAccount.allowedOperations[collection] || 
                   serviceAccount.allowedOperations['*'];
    }
    
    return allowedOps && (allowedOps.includes('*') || allowedOps.includes(operation));
  }

  /**
   * Get access policy for service and collection
   */
  async getAccessPolicy(serviceAccount, collection) {
    const cacheKey = `${serviceAccount.serviceId}:${collection}`;
    if (this.policyCache.has(cacheKey)) {
      return this.policyCache.get(cacheKey);
    }

    try {
      // Get globalModelLoader through proxy to avoid circular dependency
      const proxy = getServiceProxy();
      const globalModelLoader = proxy.getService('globalModelLoader');
      
      // Check if global model loader is ready - handle circular dependency
      if (!globalModelLoader || !('isReady' in globalModelLoader) || typeof globalModelLoader.isReady !== 'function' || !globalModelLoader.isReady()) {
        process.env.NODE_ENV !== 'production' && console.warn('⚠️ Global model loader not ready for policy fetch, using default policy');
        return this.getDefaultPolicy();
      }

      const DataAccessPolicy = globalModelLoader.getDataAccessPolicyModel();
      
      const mongoosePolicy = await DataAccessPolicy.findOne({
        serviceId: serviceAccount.serviceId,
        targetCollection: collection
      }) || await DataAccessPolicy.findOne({
        serviceId: '*',
        targetCollection: collection
      });

      // CRITICAL SECURITY FIX: Convert Mongoose document to plain object
      // This prevents Mongoose properties from contaminating database queries
      let policy = null;
      if (mongoosePolicy) {
        policy = JSON.parse(JSON.stringify(mongoosePolicy.toObject()));
        // Only log this once per service to reduce noise
        if (!this.policyConversionLogged) {
          this.policyConversionLogged = new Set();
        }
        if (!this.policyConversionLogged.has(serviceAccount.serviceId)) {
          process.env.NODE_ENV !== 'production' && console.log(`🔒 SECURITY: Policy conversion active for ${serviceAccount.serviceId}`);
          this.policyConversionLogged.add(serviceAccount.serviceId);
        }
        this.policyCache.set(cacheKey, policy);
        setTimeout(() => this.policyCache.delete(cacheKey), 86400000); // 24 hours cache
      }

      return policy || this.getDefaultPolicy();
    } catch (error) {
      console.error('Policy fetch error:', error);
      return this.getDefaultPolicy();
    }
  }

  /**
   * Apply row-level security filters
   */
  applyRowLevelSecurity(filter, policy, context, collection) {
    if (!policy || !policy.rowLevelSecurity) return filter;

    const securityFilter = { ...filter };

    // Collections that don't need practice filtering (they're already in practice-specific databases)
    const skipClinicFilter = [
      'chat_sessions', 
      'chat_messages', 
      'logintokens',
      'chatSessions',  // Legacy camelCase names
      'chatMessages',
      'patients',      // Patients are already isolated by practice database
      'appointments',  // Appointments are already isolated by practice database
      'documents',     // Documents are already isolated by practice database
      'pendinguploads' // Pending uploads are already isolated by practice database
    ];

    // Add practice isolation (skip for global context and certain collections)
    // Note: Some collections use 'practiceSubdomain' field, not 'practiceId'
    if (context.practiceId && context.practiceId !== 'global' && !skipClinicFilter.includes(collection)) {
      // Collections that use practiceSubdomain field instead of practiceId
      const useSubdomainField = [
        'users',
        'usermodels',
        'pendinguploads'  // Pending uploads use practiceSubdomain field
      ];
      
      if (useSubdomainField.includes(collection)) {
        // Use practiceSubdomain field for these collections
        // The context.practiceId might actually be a subdomain string now
        if (context.practiceSubdomain) {
          securityFilter.practiceSubdomain = context.practiceSubdomain;
        } else if (!/^[a-f0-9]{24}$/i.test(context.practiceId)) {
          // If practiceId is not an ObjectId, it's probably a subdomain
          securityFilter.practiceSubdomain = context.practiceId;
        }
      } else {
        securityFilter.practiceId = context.practiceId;
      }
    }

    // Add user-based filtering if applicable
    if (policy.rowLevelSecurity.userField && context.userId) {
      securityFilter[policy.rowLevelSecurity.userField] = context.userId;
    }

    // Add custom security rules
    if (policy.rowLevelSecurity.customRules) {
      Object.assign(securityFilter, policy.rowLevelSecurity.customRules);
    }

    // Collections that don't use soft delete
    const skipSoftDelete = [
      'chat_sessions',
      'chat_messages',
      'chatSessions',  // Legacy camelCase names
      'chatMessages',
      'pendinguploads' // Pending uploads don't use soft delete
    ];

    // Exclude soft-deleted records by default (unless collection doesn't support it)
    if (!securityFilter.hasOwnProperty('_deleted') && !skipSoftDelete.includes(collection)) {
      securityFilter._deleted = { $ne: true };
    }

    return securityFilter;
  }

  /**
   * Get allowed fields based on policy
   */
  getAllowedFields(policy, serviceAccount) {
    const policyFields = policy?.allowedFields || [];
    const serviceFields = serviceAccount?.allowedFields || [];
    
    if (policyFields.includes('*') || serviceFields.includes('*')) {
      return '*';
    }
    
    return [...new Set([...policyFields, ...serviceFields])];
  }

  /**
   * Filter projection based on allowed fields
   */
  filterProjection(projection, allowedFields) {
    if (allowedFields === '*') return projection;
    
    const filtered = {};
    for (const field of allowedFields) {
      if (projection[field] !== undefined) {
        filtered[field] = projection[field];
      }
    }
    
    return filtered;
  }

  /**
   * Apply field masking to results
   */
  applyFieldMasking(result, policy) {
    if (!policy?.fieldMasking) return result;

    const mask = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      // Preserve Date objects - don't try to mask them
      if (obj instanceof Date) return obj;
      
      // Preserve ObjectId objects - don't try to mask them
      if (obj._bsontype === 'ObjectId') return obj;

      const masked = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (policy.fieldMasking[key]) {
          masked[key] = this.maskValue(value, policy.fieldMasking[key]);
        } else if (value instanceof Date) {
          // Preserve Date objects
          masked[key] = value;
        } else if (value && value._bsontype === 'ObjectId') {
          // Preserve ObjectId objects
          masked[key] = value;
        } else if (typeof value === 'object') {
          masked[key] = mask(value);
        } else {
          masked[key] = value;
        }
      }
      
      return masked;
    };

    return mask(result);
  }

  /**
   * Mask sensitive value based on masking type
   */
  maskValue(value, maskType) {
    if (!value) return value;

    switch (maskType) {
      case 'full':
        return '***REDACTED***';
      
      case 'partial':
        if (typeof value === 'string') {
          return value.substring(0, 3) + '***';
        }
        return '***';
      
      case 'hash':
        return crypto.createHash('sha256').update(String(value)).digest('hex').substring(0, 8);
      
      case 'email':
        if (typeof value === 'string' && value.includes('@')) {
          const [local, domain] = value.split('@');
          return local[0] + '***@' + domain;
        }
        return '***';
      
      default:
        return value;
    }
  }

  /**
   * Get global database connection (cached)
   */
  async getGlobalDatabase() {
    const cacheKey = 'db_global';
    const cached = this.connectionCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < this.connectionCacheTTL)) {
      return cached.db;
    }
    
    const proxy = getServiceProxy();
    const DatabaseConnectionProvider = proxy.getService('databaseConnectionProvider');
    const db = await DatabaseConnectionProvider.getConnection('secure-data-access', 'intellicare_practice_global');
    
    // Cache the connection
    this.connectionCache.set(cacheKey, {
      db: db,
      timestamp: Date.now()
    });
    
    return db;
  }

  /**
   * Get secure database connection
   */
  async getSecureDatabase(practiceId, callingService = null) {
    if (!practiceId) {
      throw new Error('SECURITY: Practice ID required for database access');
    }

    // Check connection cache
    const cacheKey = `db_${practiceId}`;
    const cached = this.connectionCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < this.connectionCacheTTL)) {
      // Return cached connection if still valid
      // No logging here - this happens too frequently
      return cached.db;
    }

    // CORRECT ARCHITECTURE: Lookup practice to get database name
    let dbName;
    
    if (practiceId === 'global') {
      dbName = 'intellicare_practice_global';
    } else {
      // Check if it's an ObjectId (24 hex characters) - this is correct now
      if (/^[a-f0-9]{24}$/i.test(practiceId)) {
        // This is an ObjectId - lookup practice in global database
        const globalDb = await this.getGlobalDatabase();
        const { ObjectId } = require('mongodb');
        // Handle both Mongoose and native MongoDB connections
        const nativeGlobalDb = globalDb.db ? globalDb.db : globalDb;
        const practice = await nativeGlobalDb.collection('practices').findOne({ _id: new ObjectId(practiceId) });
        
        if (!practice) {
          throw new Error(`Practice not found with ID: ${practiceId}`);
        }
        
        if (!practice.subdomain) {
          throw new Error(`Practice ${practiceId} has no subdomain configured`);
        }
        
        // Build database name from practice's subdomain
        dbName = `intellicare_practice_${practice.subdomain}`;
        console.log(`📍 Practice lookup: ${practiceId} → ${practice.subdomain} → ${dbName}`);
        
      } else {
        // Not an ObjectId - assume it's already a subdomain (legacy support)
        dbName = `intellicare_practice_${practiceId}`;
      }
    }
    
    // Get new connection from factory - pass the actual calling service
    const db = await DatabaseConnectionProvider.getConnection('secure-data-access', dbName, callingService);
    
    // Log initial connection only once per practice
    if (!this.loggedConnections.has(practiceId)) {
      this.loggedConnections.add(practiceId);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SecureDataAccess] Connected to database: ${db.databaseName || db.name} for practiceId: ${practiceId}`);
      }
    }
    
    // Wrap database object to prevent admin access
    const secureDb = new Proxy(db, {
      get(target, prop) {
        if (prop === 'admin' || prop === 'dropDatabase' || prop === 'dropCollection') {
          throw new Error('SECURITY: Administrative operations are not allowed through SecureDataAccess');
        }
        // Properly forward all other properties including databaseName, name, etc.
        return Reflect.get(target, prop);
      }
    });
    
    // Cache the secure connection (only once, not twice!)
    this.connectionCache.set(cacheKey, {
      db: secureDb,
      timestamp: Date.now()
    });
    
    return secureDb;
  }

  /**
   * Execute query with security monitoring
   */
  async executeSecureQuery(db, collection, filter, options) {
    const startTime = Date.now();
    
    
    try {
      // Collections that don't use soft delete
      const skipSoftDelete = [
        'chat_sessions',
        'chat_messages', 
        'chatSessions',
        'chatMessages',
        'pendinguploads',
        'ServiceAccount',  // System collections
        'practices',
        'emailverifications'
      ];
      
      // IMPORTANT: Exclude soft-deleted items unless explicitly requested
      let enhancedFilter = { ...filter };
      if (!filter._deleted && !skipSoftDelete.includes(collection)) {
        // For collections that use soft delete, exclude deleted items
        enhancedFilter = {
          ...filter,
          $or: [{ _deleted: false }, { _deleted: { $exists: false } }]
        };
      }
      
      // Handle both Mongoose connections and native MongoDB connections
      const nativeDb = db.db ? db.db : db; // If Mongoose connection, get native db
      let query = nativeDb.collection(collection).find(enhancedFilter);
      
      if (options.projection) {
        query = query.project(options.projection);
      }
      
      if (options.sort) {
        query = query.sort(options.sort);
      }
      
      if (options.limit) {
        query = query.limit(Math.min(options.limit, 1000)); // Max 1000 records
      }
      
      if (options.skip) {
        query = query.skip(options.skip);
      }

      const result = await query.toArray();
      
      // Debug: Log query results
      if (process.env.NODE_ENV !== 'production' && (collection === 'chat_sessions' || collection === 'pendinguploads')) {
        console.log(`[SecureDataAccess] Query ${collection} with ORIGINAL filter:`, JSON.stringify(filter));
        console.log(`[SecureDataAccess] Query ${collection} with ENHANCED filter:`, JSON.stringify(enhancedFilter));
        console.log(`[SecureDataAccess] Database: ${nativeDb.databaseName || db.databaseName || db.name}`);
        console.log(`[SecureDataAccess] Found ${result.length} results`);
        if (result.length > 0 && result.length <= 3) {
          console.log(`[SecureDataAccess] Sample results:`, result.map(r => r.sessionId || r.uploadId || r._id));
        }
        // If no results for pendinguploads, let's check what's actually in the collection
        if (collection === 'pendinguploads' && result.length === 0 && filter.uploadId) {
          // Do a broader query to see what's there
          const allUploads = await nativeDb.collection(collection).find({}).limit(5).toArray();
          console.log(`[SecureDataAccess] DEBUG: Found ${allUploads.length} total uploads in collection`);
          if (allUploads.length > 0) {
            console.log(`[SecureDataAccess] DEBUG: Sample upload:`, JSON.stringify(allUploads[0], null, 2).substring(0, 500));
          }
        }
      }
      
      // Track query performance
      const duration = Date.now() - startTime;
      // Increase threshold for ServiceAccount queries (bcrypt authentication is slow)
      const threshold = collection === 'ServiceAccount' ? 3000 : 1000;
      if (duration > threshold) {
        console.warn(`Slow query detected: ${collection} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      console.error('Query execution error:', error);
      throw new Error('SECURITY: Query execution failed');
    }
  }

  /**
   * Enforce rate limiting per service
   */
  async enforceServiceRateLimit(serviceId, collection) {
    // Skip rate limiting during server startup (first 2 minutes)
    const startupGracePeriod = 120000; // 2 minutes
    const serverStartTime = global.serverStartTime || (Date.now() - 60000); // Default to 1 minute ago
    if (Date.now() - serverStartTime < startupGracePeriod) {
      return; // Skip rate limiting during startup
    }
    
    // Skip rate limiting for system-critical services during initialization
    const criticalServices = [
      'service-account-manager',
      'service-account-rotation',
      'workflow-engine',
      'learning-orchestrator',
      'procedural-memory-service',
      'master-service-loader'
    ];
    if (criticalServices.includes(serviceId)) {
      return; // Allow critical services
    }
    
    const key = `${serviceId}:${collection}`;
    const now = Date.now();
    
    if (!this.queryHistory[key]) {
      this.queryHistory[key] = [];
    }
    
    // Remove old entries (older than 1 minute)
    this.queryHistory[key] = this.queryHistory[key].filter(t => now - t < 60000);
    
    // Check rate limit (max 100 queries per minute per collection)
    if (this.queryHistory[key].length >= 100) {
      throw new Error('SECURITY: Rate limit exceeded');
    }
    
    this.queryHistory[key].push(now);
  }

  /**
   * Encrypt sensitive fields
   */
  async encryptSensitiveFields(document, policy) {
    if (!policy?.sensitiveFields) return document;

    const encrypted = { ...document };
    
    for (const field of policy.sensitiveFields) {
      if (encrypted[field]) {
        // Check if the field is already encrypted (has encryption metadata)
        if (typeof encrypted[field] === 'object' && 
            encrypted[field].encrypted === true && 
            encrypted[field].iv && 
            encrypted[field].authTag) {
          // Already encrypted by the caller, skip re-encryption
          process.env.NODE_ENV !== 'production' && console.log(`🔐 Field ${field} already encrypted, skipping re-encryption`);
          continue;
        }
        encrypted[field] = await this.encryptValue(encrypted[field]);
      }
    }
    
    return encrypted;
  }

  /**
   * Encrypt a value
   */
  async encryptValue(value) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(SecureConfigService.get("ENCRYPTION_KEY") || 'default-key-replace-in-production'.padEnd(32), 'utf8');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: true,
      algorithm,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    };
  }

  /**
   * Validate required fields
   */
  validateRequiredFields(document, policy) {
    // Check if policy exists and has requiredFields array
    if (!policy?.requiredFields || !Array.isArray(policy.requiredFields)) {
      return;
    }

    for (const field of policy.requiredFields) {
      if (!document[field]) {
        throw new Error(`SECURITY: Required field ${field} is missing`);
      }
    }
  }

  /**
   * Sanitize filter for audit logging
   */
  sanitizeForAudit(filter) {
    const sanitized = { ...filter };
    
    // Remove sensitive values
    const sensitiveKeys = ['password', 'apiKey', 'token', 'secret'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        sanitized[key] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }

  /**
   * Validate no prototype pollution in query
   */
  validateNoPrototypePollution(query) {
    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const queryStr = JSON.stringify(query);
    
    for (const pattern of dangerous) {
      if (queryStr.includes(pattern)) {
        const SecurityError = class extends Error {
          constructor(message) {
            super(message);
            this.name = 'SecurityError';
          }
        };
        throw new SecurityError(`Prototype pollution attempt blocked: ${pattern}`);
      }
    }
    
    // Deep check for nested objects
    const checkObject = (obj) => {
      for (const key in obj) {
        if (dangerous.includes(key)) {
          const SecurityError = class extends Error {
            constructor(message) {
              super(message);
              this.name = 'SecurityError';
            }
          };
          throw new SecurityError(`Dangerous key detected: ${key}`);
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          checkObject(obj[key]);
        }
      }
    };
    
    if (typeof query === 'object' && query !== null) {
      checkObject(query);
    }
  }

  /**
   * CRITICAL SECURITY: Detect and reject Mongoose objects
   * Medical platform must never allow Mongoose objects to reach MongoDB
   */
  validateNotMongooseObject(obj, objName) {
    if (!obj || typeof obj !== 'object') return;

    // Mongoose object detection patterns
    const mongooseProperties = [
      '$__', '$isNew', '_doc', '$locals', '$op', '$__parent', 
      '$__path', '$__schema', '$__strictMode', '$__version'
    ];
    
    // Check if this is a Mongoose object
    for (const prop of mongooseProperties) {
      if (prop in obj) {
        // Log critical security violation
        console.error(`🚨 CRITICAL SECURITY VIOLATION: Mongoose object detected in ${objName}`);
        console.error(`   Mongoose property found: ${prop}`);
        console.error(`   This is a code violation that must be fixed at the source`);
        console.error(`   Stack trace:`, new Error().stack);
        
        // Log to audit system
        this.logSecurityViolation('MONGOOSE_OBJECT_DETECTED', {
          objectName: objName,
          mongooseProperty: prop,
          stackTrace: new Error().stack
        }).catch(err => console.error('Failed to log security violation:', err));
        
        throw new Error(`SECURITY: Mongoose object detected in ${objName}. This is a critical violation - only plain objects allowed in medical platform database queries.`);
      }
    }
    
    // Check prototype
    if (obj.constructor && obj.constructor.name !== 'Object') {
      console.warn(`🚨 Non-plain object detected in ${objName}: ${obj.constructor.name}`);
      
      this.logSecurityViolation('NON_PLAIN_OBJECT_DETECTED', {
        objectName: objName,
        constructorName: obj.constructor.name
      }).catch(err => console.error('Failed to log security violation:', err));
      
      throw new Error(`SECURITY: Non-plain object detected in ${objName}. Only plain objects allowed.`);
    }
  }

  /**
   * Sanitize object to plain object (remove all non-serializable properties)
   * This is a safety net - preference is to reject at source
   */
  sanitizeToPlainObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    // CRITICAL: Preserve MongoDB ObjectId instances for database queries
    // ObjectIds are safe and required for database lookups
    const { ObjectId } = require('mongodb');
    if (obj instanceof ObjectId) {
      return obj; // ObjectIds are safe and must be preserved
    }
    
    // CRITICAL: Preserve Date instances for database queries
    // Date objects are safe and required for date comparisons ($gt, $lt, etc.)
    if (obj instanceof Date) {
      return obj; // Date objects are safe for MongoDB queries
    }
    
    // CRITICAL: Preserve RegExp instances for database queries
    // RegExp objects are safe and required for pattern matching
    if (obj instanceof RegExp) {
      return obj; // RegExp objects are safe for MongoDB queries
    }
    
    try {
      // For arrays, recursively sanitize each element
      if (Array.isArray(obj)) {
        return obj.map(item => this.sanitizeToPlainObject(item));
      }
      
      // For objects, create a new plain object preserving ObjectIds, Dates, and RegExps
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value instanceof ObjectId) {
          // Preserve ObjectId instances
          sanitized[key] = value;
        } else if (value instanceof Date) {
          // Preserve Date instances
          sanitized[key] = value;
        } else if (value instanceof RegExp) {
          // Preserve RegExp instances
          sanitized[key] = value;
        } else if (value && typeof value === 'object') {
          // Recursively sanitize nested objects
          sanitized[key] = this.sanitizeToPlainObject(value);
        } else if (typeof value !== 'function' && typeof value !== 'symbol') {
          // Keep primitive values (string, number, boolean, null)
          sanitized[key] = value;
        }
        // Functions and symbols are excluded for security
      }
      
      return sanitized;
    } catch (error) {
      process.env.NODE_ENV !== 'production' && console.error(`🚨 Failed to sanitize object:`, error);
      throw new Error(`SECURITY: Failed to sanitize object for database query`);
    }
  }
  
  /**
   * Validate aggregation pipeline security
   */
  validateAggregationPipeline(pipeline) {
    if (!Array.isArray(pipeline)) {
      throw new Error('Invalid aggregation pipeline');
    }
    
    // Block dangerous aggregation operations
    const forbidden = ['$merge', '$out', '$function', '$accumulator', '$where'];
    
    for (const stage of pipeline) {
      const stageKeys = Object.keys(stage);
      for (const key of stageKeys) {
        if (forbidden.includes(key)) {
          const SecurityError = class extends Error {
            constructor(message) {
              super(message);
              this.name = 'SecurityError';
            }
          };
          throw new SecurityError(`Forbidden aggregation operation: ${key}`);
        }
      }
    }
    
    // Limit pipeline complexity
    if (pipeline.length > 10) {
      const SecurityError = class extends Error {
        constructor(message) {
          super(message);
          this.name = 'SecurityError';
        }
      };
      throw new SecurityError('Aggregation pipeline too complex');
    }
  }
  
  /**
   * Block a service from accessing data
   */
  blockService(serviceName) {
    this.blockedServices.add(serviceName);
    console.log(`Service blocked: ${serviceName}`);
  }
  
  /**
   * Set system to read-only mode
   */
  setReadOnlyMode(enabled) {
    this.readOnlyMode = enabled;
    console.log(`Read-only mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Log system service access
   */
  async logSystemServiceAccess(serviceId) {
    try {
      await immutableAuditService.logServiceDataAccess({
        serviceId,
        type: 'SYSTEM_SERVICE_ACCESS',
        timestamp: new Date(),
        source: 'SecureDataAccess',
        action: 'AUTHORIZED'
      });
    } catch (error) {
      console.error('System service access logging failed:', error);
      // Continue execution - don't block system services due to audit logging failures
    }
  }

  /**
   * Audit data access
   */
  async auditDataAccess(details) {
    try {
      await immutableAuditService.logServiceDataAccess({
        ...details,
        timestamp: new Date(),
        source: 'SecureDataAccess'
      });
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(type, details) {
    try {
      await immutableAuditService.logSecurityEvent({
        type,
        severity: 'HIGH',
        details,
        timestamp: new Date(),
        action: 'BLOCKED'
      });
      
      // Track for pattern analysis
      this.suspiciousPatterns.add(`${type}:${details.service}`);
      
    } catch (error) {
      console.error('Security logging failed:', error);
    }
  }

  /**
   * Handle security errors
   */
  async handleSecurityError(error, context) {
    await this.logSecurityViolation('QUERY_ERROR', {
      error: error.message,
      ...context
    });
  }

  /**
   * Analyze access patterns for anomalies
   */
  analyzeAccessPatterns() {
    // Implement pattern analysis logic
    if (this.suspiciousPatterns.size > 10) {
      console.warn('Multiple suspicious patterns detected');
      // Could trigger alerts or additional security measures
    }
  }

  /**
   * Detect anomalies in access patterns
   */
  detectAnomalies() {
    // Implement anomaly detection
    for (const [key, timestamps] of Object.entries(this.queryHistory)) {
      // service-account-manager legitimately queries ServiceAccount frequently for authentication
      if (key === 'service-account-manager:ServiceAccount') {
        continue; // Skip anomaly detection for this legitimate high-frequency pattern
      }
      if (timestamps.length > 50) {
        console.warn(`Unusual activity detected for ${key}`);
      }
    }
  }

  /**
   * Enforce rate limits across all services
   */
  enforceRateLimits() {
    // Clean up old entries
    const now = Date.now();
    for (const key of Object.keys(this.queryHistory)) {
      this.queryHistory[key] = this.queryHistory[key].filter(t => now - t < 60000);
      if (this.queryHistory[key].length === 0) {
        delete this.queryHistory[key];
      }
    }
  }

  /**
   * Get default security policy
   */
  getDefaultPolicy() {
    return {
      allowedFields: ['_id', 'name', 'createdAt', 'updatedAt'],
      rowLevelSecurity: {
        userField: null,
        customRules: {}
      },
      fieldMasking: {},
      sensitiveFields: [],
      requiredFields: [],
      defaultAccessLevel: 'restricted'
    };
  }

  /**
   * Block a service for security violations
   */
  blockService(serviceId, reason) {
    this.blockedServices.add(serviceId);
    console.error(`Service ${serviceId} blocked: ${reason}`);
    
    // Could trigger alerts to security team
    this.logSecurityViolation('SERVICE_BLOCKED', {
      serviceId,
      reason,
      timestamp: new Date()
    });
  }

  /**
   * Check if service is blocked
   */
  isServiceBlocked(serviceId) {
    return this.blockedServices.has(serviceId);
  }
}

// Export singleton instance
const secureDataAccessInstance = new SecureDataAccess();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('secureDataAccess', () => secureDataAccessInstance);
}

module.exports = secureDataAccessInstance;