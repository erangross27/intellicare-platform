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
const databaseFactory = require('../utils/databaseFactory');
const globalModelLoader = require('./globalModelLoader');
const immutableAuditService = require('./immutableAuditService');
const { detectSqlInjection, detectNoSqlInjection, validateInput } = require('../utils/securityUtils');
const SecureConfigService = require('./secureConfigService');
const ServiceRegistry = require('./serviceRegistry');
const { getTimestampForDocument } = require('../utils/timezoneHelper');

// MongoDB Operators Configuration
const MONGODB_OPERATORS = {
  // Safe comparison operators - can be used freely
  COMPARISON: ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin'],

  // Safe logical operators - for combining conditions
  LOGICAL: ['$and', '$or', '$not', '$nor'],

  // Safe element operators - for field existence checks
  ELEMENT: ['$exists', '$type'],

  // Safe array operators
  ARRAY: ['$all', '$elemMatch', '$size'],

  // Safe update operators
  UPDATE: ['$set', '$unset', '$inc', '$push', '$pull', '$addToSet', '$pop', '$rename', '$min', '$max', '$currentDate'],

  // Restricted operators - need validation
  RESTRICTED: {
    '$regex': (value) => {
      // Validate regex pattern is safe
      if (typeof value !== 'string' && !(value instanceof RegExp)) return false;
      // Block dangerous regex patterns
      const pattern = value.toString();
      if (pattern.includes('(?=') || pattern.includes('(?!')) return false; // No lookaheads
      if (pattern.includes('*+') || pattern.includes('+*')) return false; // No catastrophic backtracking
      return true;
    },
    '$options': (value) => {
      // Options is used with $regex for flags like 'i' (case-insensitive)
      // Only allow safe regex flags
      if (typeof value !== 'string') return false;
      // MongoDB supports: i, m, s, x flags
      return /^[imsx]*$/.test(value);
    },
    '$text': (value) => {
      // Text search must have $search property
      return value && typeof value === 'object' && '$search' in value;
    }
  },

  // Blocked operators - NEVER allowed
  BLOCKED: ['$where', '$function', '$accumulator', '$jsonSchema']
};

// Helper to get all allowed operators
const ALL_ALLOWED_OPERATORS = [
  ...MONGODB_OPERATORS.COMPARISON,
  ...MONGODB_OPERATORS.LOGICAL,
  ...MONGODB_OPERATORS.ELEMENT,
  ...MONGODB_OPERATORS.ARRAY,
  ...MONGODB_OPERATORS.UPDATE,
  ...Object.keys(MONGODB_OPERATORS.RESTRICTED)
];
const DatabaseConnectionProvider = require('./databaseConnectionProvider');
const BaseService = require('./baseService');

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
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('secure-data-access');
    console.log('✅ [SecureDataAccess] Service initialized with security enforcement enabled');
    return this;
  }

  /**
   * Clear service account cache - useful after adding new services
   */
  clearServiceAccountCache() {
    this.serviceAccountCache.clear();
    console.log('🔄 [SecureDataAccess] Service account cache cleared');
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
   * Validate MongoDB operators in a filter
   * @param {Object} filter - The MongoDB query filter
   * @returns {Object} - Validation result { isValid: boolean, errors: string[] }
   */
  validateMongoOperators(filter) {
    const errors = [];

    const validateObject = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        // Check if it's a MongoDB operator (starts with $)
        if (key.startsWith('$')) {
          // Check if operator is blocked
          if (MONGODB_OPERATORS.BLOCKED.includes(key)) {
            errors.push(`Blocked operator ${key} at ${currentPath}`);
            continue;
          }

          // Check if operator is allowed
          if (!ALL_ALLOWED_OPERATORS.includes(key)) {
            errors.push(`Unknown operator ${key} at ${currentPath}`);
            continue;
          }

          // Check restricted operators
          if (MONGODB_OPERATORS.RESTRICTED[key]) {
            const validator = MONGODB_OPERATORS.RESTRICTED[key];
            if (!validator(value)) {
              errors.push(`Invalid value for restricted operator ${key} at ${currentPath}`);
              continue;
            }
          }

          // For logical operators, validate nested conditions
          if (MONGODB_OPERATORS.LOGICAL.includes(key)) {
            if (Array.isArray(value)) {
              value.forEach((item, index) => {
                if (typeof item === 'object' && item !== null) {
                  validateObject(item, `${currentPath}[${index}]`);
                }
              });
            }
          }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Recursively validate nested objects (for embedded operators)
          validateObject(value, currentPath);
        }
      }
    };

    validateObject(filter);

    return {
      isValid: errors.length === 0,
      errors
    };
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
        // SECURITY: Use strict whitelist validation for known safe patterns
        
        // Define valid ID patterns for different types
        const validIdPatterns = {
          // Session IDs: practice_session_practice_timestamp_random OR session_practice_timestamp_random
          sessionId: /^[a-zA-Z0-9_]+_session_[a-zA-Z0-9_]+_\d{13}_[a-z0-9]{1,20}$|^session_[a-zA-Z0-9_]+_\d{13}_[a-z0-9]{1,20}$/,
          // MongoDB ObjectIds: 24 hex characters
          _id: /^[a-f0-9]{24}$/,
          // User IDs: MongoDB ObjectId or email format
          userId: /^[a-f0-9]{24}$|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
          // Patient IDs: MongoDB ObjectId
          patientId: /^[a-f0-9]{24}$/,
          // Document IDs: MongoDB ObjectId  
          documentId: /^[a-f0-9]{24}$/
        };
        
        // Check if query contains only safe ID lookups
        let containsOnlySafeIds = true;
        let hasAtLeastOneId = false;
        
        for (const [field, value] of Object.entries(filter)) {
          // Validate MongoDB operators using our new validation
          if (field.startsWith('$')) {
            // This will be validated later with validateMongoOperators
            containsOnlySafeIds = false;
            continue;
          }
          
          // Check if this field is a known ID field
          if (validIdPatterns[field]) {
            hasAtLeastOneId = true;
            
            // Validate the ID against its specific pattern
            if (typeof value === 'string') {
              if (!validIdPatterns[field].test(value)) {
                await this.logSecurityViolation('INVALID_ID_FORMAT', {
                  service: serviceAccount.serviceId,
                  collection,
                  field,
                  value: value.substring(0, 50) // Log only first 50 chars for security
                });
                throw new Error(`SECURITY: Invalid ${field} format`);
              }
            } else if (typeof value === 'object' && value !== null) {
              // Handle operators like {$in: [...]}
              containsOnlySafeIds = false;
            }
          } else {
            // Non-ID field - needs full validation
            containsOnlySafeIds = false;
          }
        }
        
        // If query contains non-ID fields or complex operators, apply validation
        if (!containsOnlySafeIds || !hasAtLeastOneId) {
          const filterString = JSON.stringify(filter);

          // Validate MongoDB operators
          const operatorValidation = this.validateMongoOperators(filter);
          if (!operatorValidation.isValid) {
            await this.logSecurityViolation('INVALID_OPERATORS', {
              service: serviceAccount.serviceId,
              collection,
              errors: operatorValidation.errors
            });
            throw new Error(`SECURITY: Invalid MongoDB operators - ${operatorValidation.errors.join(', ')}`);
          }

          // Check for SQL injection (MongoDB doesn't execute SQL, but check for attempts)
          const hasDangerousSQL = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|UNION|EXEC)\b|--|\/\*|\*\/)/i.test(filterString);
          if (hasDangerousSQL) {
            await this.logSecurityViolation('SQL_INJECTION_ATTEMPT', {
              service: serviceAccount.serviceId,
              collection,
              filter
            });
            throw new Error('SECURITY: SQL injection attempt detected');
          }

          // Check for hex injection patterns
          const realHexPattern = /0x[0-9a-fA-F]+(?![0-9a-zA-Z])/;
          if (realHexPattern.test(filterString)) {
            await this.logSecurityViolation('HEX_INJECTION_ATTEMPT', {
              service: serviceAccount.serviceId,
              collection,
              filter
            });
            throw new Error('SECURITY: Hex injection attempt detected');
          }
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
      // CRITICAL: Some collections live in global database, not practice-specific database
      const GLOBAL_COLLECTIONS = ['practices', 'system_config', 'api_keys'];

      let db;
      if (GLOBAL_COLLECTIONS.includes(collection)) {
        // Query global database for global collections (practices, system_config, etc.)
        db = await this.getGlobalDatabase();
      } else {
        // Query practice-specific database for practice-isolated data
        const dbIdentifier = context.practiceSubdomain || context.practiceId;
        db = await this.getSecureDatabase(dbIdentifier, context.serviceId);
      }

      // 8. Execute query with monitoring
      const result = await this.executeSecureQuery(db, collection, filter, options);

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
    
    // Auto-grant permissions for FieldMapper services
    if (serviceAccount.serviceId.endsWith('FieldMapper')) {
      if (!this.isOperationAllowed(serviceAccount, collection, 'insert')) {
        console.log(`🔓 Auto-granting ${collection} permissions to ${serviceAccount.serviceId}`);
        await this.autoGrantFieldMapperPermissions(serviceAccount.serviceId, collection);
        // Clear cache so updated permissions are loaded
        this.serviceAccountCache.clear();
        // Reload serviceAccount with new permissions
        const updatedAccount = await this.validateServiceAccount(context);
        if (updatedAccount) {
          Object.assign(serviceAccount, updatedAccount);
        }
      }
    }

    // Now safe to access properties
    if (!this.isOperationAllowed(serviceAccount, collection, 'insert')) {
      console.error(`❌ INSERT BLOCKED - Service: ${serviceAccount.serviceId}, Collection: ${collection}`);
      console.error('   ServiceAccount allowedCollections:', serviceAccount.allowedCollections);
      console.error('   ServiceAccount allowedOperations:', serviceAccount.allowedOperations);
      throw new Error(`SECURITY: Insert operation not allowed for service ${serviceAccount.serviceId} on collection ${collection}`);
    }

    // Validate required fields
    const policy = await this.getAccessPolicy(serviceAccount, collection);
    this.validateRequiredFields(document, policy);

    // Get practice timezone for timestamp generation
    let practiceTimezone = 'UTC';
    if (context.practiceId && context.practiceId !== 'global') {
      // Skip timezone lookup for 'global' context (service-level operations that should use UTC)
      try {
        // console.log(`🔍 [SecureDataAccess.insert] Looking up timezone for practice: ${context.practiceId}`);

        // CRITICAL: Practices collection is in GLOBAL database, not practice-specific database
        const globalDb = await this.getGlobalDatabase();
        const nativeDb = globalDb.db ? globalDb.db : globalDb;

        // console.log(`🔍 [SecureDataAccess.insert] Global database name: ${nativeDb.databaseName}`);

        // Try to match by subdomain (string) or _id (ObjectId)
        const query = { subdomain: context.practiceId };

        // If practiceId looks like an ObjectId, also try matching by _id
        if (/^[a-f0-9]{24}$/.test(context.practiceId)) {
          const { ObjectId } = require('mongodb');
          query.$or = [
            { subdomain: context.practiceId },
            { _id: new ObjectId(context.practiceId) }
          ];
          delete query.subdomain;
        }

        const practices = await nativeDb.collection('practices').find(query).limit(1).toArray();

        // console.log(`🔍 [SecureDataAccess.insert] Practices query result:`, practices);

        if (practices && practices[0] && practices[0].settings && practices[0].settings.timezone) {
          practiceTimezone = practices[0].settings.timezone;
          // console.log(`✅ [SecureDataAccess.insert] Found practice timezone: ${practiceTimezone}`);
        } else {
          console.warn(`⚠️ [SecureDataAccess.insert] Practice found but no timezone setting, using UTC`);
        }
      } catch (err) {
        console.warn(`⚠️ Could not retrieve practice timezone, using UTC: ${err.message}`);
      }
    } else {
      // console.log(`⚠️ [SecureDataAccess.insert] No context.practiceId provided or using 'global' context, using UTC`);
    }

    // Generate timestamps in practice local timezone
    const timestamps = getTimestampForDocument(practiceTimezone);

    // Add practice-local timestamps to document if it has date-related fields
    // Common timestamp fields in medical documents
    if (!document.createdAt) {
      document.createdAt = timestamps.createdAt;  // Practice local time
      document.createdAtUTC = timestamps.createdAtUTC;  // UTC time
      document.createdAtTimezone = timestamps.createdAtTimezone;  // Timezone identifier
    }

    // Add updatedAt timestamps as well
    if (!document.updatedAt) {
      document.updatedAt = timestamps.updatedAt;
      document.updatedAtUTC = timestamps.updatedAtUTC;
      document.updatedAtTimezone = timestamps.updatedAtTimezone;
    }

    // Also add to _securityMetadata for audit purposes
    document._securityMetadata = {
      createdBy: serviceAccount.serviceId,
      createdAt: timestamps.createdAt,  // Practice local time (for human troubleshooting)
      createdAtUTC: timestamps.createdAtUTC,  // UTC time (for system operations)
      createdAtTimezone: timestamps.createdAtTimezone,  // Which timezone was used
      encryptionVersion: 'v2',
      accessLevel: policy.defaultAccessLevel || 'restricted'
    };

    // Encrypt sensitive fields
    document = await this.encryptSensitiveFields(document, policy);

    // DEBUG: Log patientId type before MongoDB insert
    if (document.patientId) {
      console.log(`🔍 [SecureDataAccess.insert] ${collection} - patientId type:`, typeof document.patientId, document.patientId);
      console.log(`🔍 [SecureDataAccess.insert] ${collection} - Is ObjectId?:`, document.patientId.constructor?.name);
    }

    // Debug logging for recall alerts routing
    if (collection === 'patient_recall_alerts') {
      console.log(`🔍 [SecureDataAccess.insert] patient_recall_alerts - context.practiceId: ${context.practiceId}, context.practiceSubdomain: ${context.practiceSubdomain}`);
    }

    // Auto-populate practiceSubdomain for collections that use it for row-level security
    // This ensures every document can be found by applyRowLevelSecurity queries
    const useSubdomainField = ['users', 'usermodels', 'pendinguploads'];
    if (useSubdomainField.includes(collection) && !document.practiceSubdomain && context.practiceId && context.practiceId !== 'global') {
      if (context.practiceSubdomain) {
        document.practiceSubdomain = context.practiceSubdomain;
      } else if (!/^[a-f0-9]{24}$/i.test(context.practiceId)) {
        // practiceId is a subdomain string, not an ObjectId
        document.practiceSubdomain = context.practiceId;
      }
    }

    const practiceDb = await this.getSecureDatabase(context.practiceId, context.serviceId);
    // Handle both Mongoose and native MongoDB connections
    let nativeDb = practiceDb.db ? practiceDb.db : practiceDb;
    let result;
    try {
      result = await nativeDb.collection(collection).insertOne(document);
    } catch (error) {
      // Mirror the read path (see find()): a stale/closed pooled connection surfaces as
      // MongoNotConnectedError. Drop the cached connection and retry the insert ONCE with a fresh
      // one, so writes — including audit_logs to the global DB — survive a dropped topology instead
      // of failing outright.
      if (error.name === 'MongoNotConnectedError' ||
          error.message?.includes('Client must be connected') ||
          error.message?.includes('topology was destroyed')) {
        console.log('🔄 MongoDB connection lost during insert, reconnecting and retrying once...');
        const dbName = practiceDb.name || practiceDb.databaseName || practiceDb.db?.databaseName;
        if (!dbName) throw error;

        const cacheKey = `db_${dbName.replace('intellicare_practice_', '')}`;
        this.connectionCache.delete(cacheKey);
        try {
          const provider = require('./databaseConnectionProvider');
          if (provider.databaseConnections) provider.databaseConnections.delete(dbName);
        } catch (e) {
          // Provider not available
        }

        const practiceIdentifier = dbName.replace('intellicare_practice_', '');
        const freshDb = await this.getSecureDatabase(practiceIdentifier, context.serviceId || 'secure-data-access');
        nativeDb = freshDb.db ? freshDb.db : freshDb;
        result = await nativeDb.collection(collection).insertOne(document);
        console.log('✅ Insert retry succeeded with fresh connection');
      } else {
        throw error;
      }
    }

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

    // Validate MongoDB operators in filter
    const filterValidation = this.validateMongoOperators(filter);
    if (!filterValidation.isValid) {
      await this.logSecurityViolation('INVALID_OPERATORS_IN_UPDATE', {
        service: serviceAccount.serviceId,
        collection,
        errors: filterValidation.errors
      });
      throw new Error(`SECURITY: Invalid MongoDB operators in update filter - ${filterValidation.errors.join(', ')}`);
    }

    // Validate MongoDB operators in update document
    const updateValidation = this.validateMongoOperators(update);
    if (!updateValidation.isValid) {
      await this.logSecurityViolation('INVALID_OPERATORS_IN_UPDATE', {
        service: serviceAccount.serviceId,
        collection,
        errors: updateValidation.errors
      });
      throw new Error(`SECURITY: Invalid MongoDB operators in update - ${updateValidation.errors.join(', ')}`);
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

    // Validate MongoDB operators in filter
    const filterValidation = this.validateMongoOperators(filter);
    if (!filterValidation.isValid) {
      await this.logSecurityViolation('INVALID_OPERATORS_IN_DELETE', {
        service: serviceAccount.serviceId,
        collection,
        errors: filterValidation.errors
      });
      throw new Error(`SECURITY: Invalid MongoDB operators in delete filter - ${filterValidation.errors.join(', ')}`);
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
      // FIX: Normalize collection name to fix typos in logs
      const normalizedCollection = collection
        .replace('seessions', 'sessions')
        .replace('zerotrustsessions', 'zero_trust_sessions');
      if (process.env.QUIET_LOGS !== 'true') console.log(`🗑️ [SecureDataAccess] Soft deleted ${result.modifiedCount} documents from ${normalizedCollection}`);
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
   * Secure upsert operation (atomic create-or-update)
   *
   * IMPORTANT: Use this for idempotent operations where you want to create a document
   * if it doesn't exist, or retrieve it if it does exist. This prevents race conditions
   * when multiple requests try to create the same resource simultaneously.
   *
   * ✅ Good for: sessions, user preferences, device registrations, singleton resources
   * ❌ Bad for: medical records, audit logs, transactions, time-series data
   *
   * @param {string} collection - Collection name
   * @param {Object} filter - Unique filter to identify the document
   * @param {Object} document - Document to insert if not found
   * @param {Object} context - Security context
   * @param {Object} options - Optional settings
   * @param {Object} options.updateOnExist - Fields to update if document exists ($set operator)
   * @returns {Promise<Object>} The upserted document
   */
  async upsert(collection, filter, document, context = {}, options = {}) {
    const startTime = Date.now();

    // Validate context structure
    if (!context || typeof context !== 'object') {
      throw new Error('SECURITY: Invalid or missing context');
    }

    if (!context.serviceId) {
      throw new Error('SECURITY: Missing serviceId in context');
    }

    // Validate service account
    const serviceAccount = await this.validateServiceAccount(context);

    if (!serviceAccount) {
      throw new Error(`SECURITY: Service ${context.serviceId} authentication failed`);
    }

    // Check permissions - upsert requires both update and insert permissions
    if (!this.isOperationAllowed(serviceAccount, collection, 'update') ||
        !this.isOperationAllowed(serviceAccount, collection, 'insert')) {
      console.error(`❌ UPSERT BLOCKED - Service: ${serviceAccount.serviceId}, Collection: ${collection}`);
      throw new Error(`SECURITY: Upsert operation not allowed for service ${serviceAccount.serviceId} on collection ${collection}`);
    }

    // Validate MongoDB operators in filter
    const filterValidation = this.validateMongoOperators(filter);
    if (!filterValidation.isValid) {
      await this.logSecurityViolation('INVALID_OPERATORS_IN_UPSERT', {
        service: serviceAccount.serviceId,
        collection,
        errors: filterValidation.errors
      });
      throw new Error(`SECURITY: Invalid MongoDB operators in upsert filter - ${filterValidation.errors.join(', ')}`);
    }

    // Validate required fields
    const policy = await this.getAccessPolicy(serviceAccount, collection);
    this.validateRequiredFields(document, policy);

    // Add security metadata for new documents
    const securityMetadata = {
      createdBy: serviceAccount.serviceId,
      createdAt: new Date(),
      encryptionVersion: 'v2',
      accessLevel: policy.defaultAccessLevel || 'restricted'
    };

    // Encrypt sensitive fields
    const encryptedDocument = await this.encryptSensitiveFields(document, policy);

    // Build update operation
    const updateOp = {};

    // Add fields to update if document already exists
    if (options.updateOnExist && typeof options.updateOnExist === 'object') {
      // When updateOnExist is provided, use $set for ALL fields (insert + update)
      updateOp.$set = {
        ...encryptedDocument,
        ...options.updateOnExist,
        _lastModifiedBy: serviceAccount.serviceId,
        _lastModifiedAt: new Date()
      };

      // Only set security metadata on insert (not on update)
      updateOp.$setOnInsert = {
        _securityMetadata: securityMetadata
      };
    } else {
      // Original behavior: Use $setOnInsert for document fields, $set for modification tracking
      updateOp.$setOnInsert = {
        ...encryptedDocument,
        _securityMetadata: securityMetadata
      };

      updateOp.$set = {
        _lastModifiedBy: serviceAccount.serviceId,
        _lastModifiedAt: new Date()
      };
    }

    // Get database connection
    const practiceDb = await this.getSecureDatabase(context.practiceId, context.serviceId);
    const nativeDb = practiceDb.db ? practiceDb.db : practiceDb;

    try {
      // ATOMIC OPERATION: findOneAndUpdate with upsert
      const result = await nativeDb.collection(collection).findOneAndUpdate(
        filter,
        updateOp,
        {
          upsert: true,
          returnDocument: 'after'  // Return document after upsert
        }
      );

      const upsertedDocument = result.value || result;

      if (!upsertedDocument || !upsertedDocument._id) {
        throw new Error('Upsert operation failed to return document');
      }

      // Audit the operation
      this.auditDataAccess({
        serviceId: serviceAccount.serviceId,
        collection,
        operation: 'upsert',
        filter: this.sanitizeForAudit(filter),
        documentId: upsertedDocument._id,
        wasInsert: !result.lastErrorObject?.updatedExisting,
        duration: Date.now() - startTime,
        practiceId: context.practiceId
      });

      return upsertedDocument;

    } catch (error) {
      console.error(`❌ [SecureDataAccess] Upsert failed:`, error);

      await this.logSecurityViolation('UPSERT_FAILED', {
        service: serviceAccount.serviceId,
        collection,
        error: error.message
      });

      throw new Error(`SECURITY: Upsert operation failed - ${error.message}`);
    }
  }

  /**
   * Secure aggregation operation
   * MongoDB aggregation pipeline for complex data processing
   */
  async aggregate(collection, pipeline, context = {}) {
    // Validate context
    if (!context || typeof context !== 'object') {
      throw new Error('SECURITY: Invalid or missing context');
    }

    if (!context.serviceId) {
      throw new Error('SECURITY: Missing serviceId in context');
    }

    // Validate service account
    const serviceAccount = await this.validateServiceAccount(context);

    if (!serviceAccount) {
      throw new Error(`SECURITY: Service ${context.serviceId} authentication failed - no valid account`);
    }

    // Check permissions
    if (!this.isOperationAllowed(serviceAccount, collection, 'query')) {
      throw new Error(`SECURITY: Aggregate operation not allowed for service ${serviceAccount.serviceId}`);
    }

    // Validate pipeline is an array
    if (!Array.isArray(pipeline)) {
      throw new Error('SECURITY: Aggregation pipeline must be an array');
    }

    // Validate pipeline stages
    this.validateAggregationPipeline(pipeline);

    // Add security filters to first stage if it's $match
    const policy = await this.getAccessPolicy(serviceAccount, collection);
    const securedPipeline = [...pipeline];

    if (securedPipeline[0] && securedPipeline[0].$match) {
      // If first stage is $match, apply row-level security
      securedPipeline[0].$match = this.applyRowLevelSecurity(
        securedPipeline[0].$match,
        policy,
        context,
        collection
      );
    } else {
      // Add $match stage at the beginning with security filters
      const securityFilter = this.applyRowLevelSecurity({}, policy, context, collection);

      if (Object.keys(securityFilter).length > 0) {
        securedPipeline.unshift({ $match: securityFilter });
      }
    }

    // Get practice database
    const practiceDb = await this.getSecureDatabase(context.practiceId, context.serviceId);
    
    try {
      // Execute aggregation
      const nativeDb = practiceDb.db ? practiceDb.db : practiceDb;
      const result = await nativeDb.collection(collection)
        .aggregate(securedPipeline, {
          maxTimeMS: 30000, // 30 second timeout
          allowDiskUse: true // Allow disk use for large aggregations
        })
        .toArray();
      
      // Audit the operation
      this.auditDataAccess({
        serviceId: serviceAccount.serviceId,
        collection,
        operation: 'aggregate',
        pipelineStages: securedPipeline.map(stage => Object.keys(stage)[0]),
        resultCount: result.length,
        practiceId: context.practiceId
      });
      
      return result;
    } catch (error) {
      console.error('Aggregation error:', error);
      throw new Error(`SECURITY: Aggregation failed - ${error.message}`);
    }
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
      'permission-sync', // Auto-grants medical collection permissions
      
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

      // API route services
      'notifications-api',
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
      'agentServiceV4',  // CamelCase version used in function calls
      'agent-service-wrapper',
      'agent-service-claude',
      'agent-route',  // Artifact panel routes
      'gemini-service',
      'gemini-medical-service',
      'claude-medical-image-service',
      'blue-button-oauth-service',
      'patient-import-service',
      'diagnostic-service-new',
      'document-analysis-service',
      'medical-model-service',
      'medical-parsing-service',
      'clinical-decision-support',
      'treatment-recommender',
      'optimized-medical-functions',  // Optimized wrapper for medical functions - needs patient name access

      // Visit recording
      'visit-recording-service',  // Patient visit recording (SOAP note generation)
      'visit-recording-ws',       // WebSocket audio save (server-side)

      // Template editing (per-collection isolation)
      'medications-edit-service',  // Inline editing of medication fields
      'allergies-edit-service',    // Inline editing of allergy fields
      'diagnoses-edit-service',    // Inline editing of diagnosis fields
      'smoking_cessation_program-edit-service',  // Inline editing of smoking cessation program fields
      'lab-results-edit-service',  // Inline editing of lab result fields
      'medical-procedures-edit-service',  // Inline editing of medical procedure fields
      'imaging-reports-edit-service',  // Inline editing of imaging report fields
      'hospital-course-edit-service',  // Inline editing of hospital course fields
      'follow-up-appointments-edit-service',  // Inline editing of follow-up appointment fields
      'treatment-courses-edit-service',  // Inline editing of treatment course fields
      'echo-reports-edit-service',  // Inline editing of echo report fields
      'patient-education-records-edit-service',
      'social-history-edit-service',  // Inline editing of social history fields
      'history-present-illness-edit-service',  // Inline editing of HPI fields
      'cardiology-assessment-edit-service',  // Inline editing of cardiology assessment fields
      'pulmonary-imaging-edit-service',  // Inline editing of pulmonary imaging fields
      'respiratory-medications-edit-service',  // Inline editing of respiratory medications fields
      'discharge-summaries-edit-service',  // Inline editing of discharge summary fields
      'administrative-data-edit-service',  // Inline editing of administrative data fields
      'emergency-information-edit-service',  // Inline editing of emergency information fields
      'patient-provider-edit-service',  // Inline editing of patient provider fields
      'medication-recommendations-edit-service',  // Inline editing of medication recommendations fields
      'referrals-edit-service',  // Inline editing of referral fields
      'addiction-medicine-consultations-edit-service',  // Inline editing of addiction medicine consultation fields
      'case-management-edit-service',  // Inline editing of case management fields
      'hepatitis-c-history-edit-service',
      'ecg-reports-edit-service',
      'therapy-session-notes-edit-service',
      'liver-function-assessments-edit-service',
      'depression-screening-edit-service',
      'therapy-progress-notes-edit-service',
      'insurance-authorizations-edit-service',
      'stress-management-referrals-edit-service',
      'past-medical-history-edit-service',
      'family-history-edit-service',
      'chief-complaints-edit-service',
      'review-of-systems-edit-service',
      'physical-examinations-edit-service',
      'assessment-plans-edit-service',
      'consultation-details-edit-service',
      'prognosis-edit-service',
      'abnormal-results-edit-service',
      'cancer-surveillance-edit-service',  // Inline editing of cancer surveillance fields
      'mental-status-exams-edit-service',
      'pain-management-edit-service',
      'psychiatric-assessment-scales-edit-service',
      'substance-use-assessment-edit-service',
      'monitoring-plans-edit-service',
      'follow-up-plan-edit-service',
      'social-determinants-of-health-edit-service',
      'treatment-plans-edit-service',
      'therapy-requests-edit-service',
      'endoscopy-reports-edit-service',
      'cmv-monitoring-plan-edit-service',
      'coagulation-studies-edit-service',
      'code-blue-summaries-edit-service',
      'cognitive-evaluations-edit-service',
      'cognitive-rehabilitation-reports-edit-service',
      'cognitive-screening-edit-service',
      'colonoscopy-reports-edit-service',
      'colorectal-colonoscopies-edit-service',
      'colorectal-surgery-assessment-edit-service',
      'colorectal-surgery-consultations-edit-service',
      'complications-edit-service',
      'component-allergen-testing-edit-service',
      'comprehensive-cardiomyopathy-panel-edit-service',
      'comprehensive-medication-review-edit-service',
      'compression-therapy-edit-service',
      'concussion-assessment-edit-service',
      'connective-tissue-disease-assessment-edit-service',
      'consultation-notes-edit-service',
      'consultation-requests-edit-service',
      'consultation-timeline-edit-service',
      'contact-lens-fitting-edit-service',
      'contraction-monitoring-edit-service',
      'continuous-infusions-edit-service',
      'copd-assessments-edit-service',
      'critical-view-of-safety-edit-service',
      'cultural-considerations-edit-service',
      'current-dialysis-edit-service',
      'current-pregnancy-edit-service',
      'cystoscopy-reports-edit-service',
      'cytology-reports-edit-service',
      'cyp450-panel-results-edit-service',
      'day-programs-edit-service',
      'daytime-sleepiness-assessment-edit-service',
      'deep-brain-stimulation-edit-service',
      'delivery-planning-edit-service',
      'dementia-assessment-edit-service',
      'dementia-education-edit-service',
      'dental-examination-reports-edit-service',
      'dental-implant-surgery-edit-service',
      'detailed-family-pedigree-edit-service',
      'dermatology-assessment-edit-service',
      'dermatology-consultations-edit-service',
      'dermatology-procedure-notes-edit-service',
      'developmental-assessments-edit-service',
      'early-childhood-development-edit-service',
      'developmental-milestones-edit-service',
      'dexa-scan-reports-edit-service',
      'diabetes-education-edit-service',
      'diabetes-educator-edit-service',
      'diabetes-management-edit-service',
      'diabetes-management-notes-edit-service',
      'diabetes-quality-metrics-edit-service',
      'diabetes-supplies-edit-service',
      'diabetic-nephropathy-edit-service',
      'diagnostic-impression-edit-service',
      'diagnostic-studies-edit-service',
      'dialysate-composition-edit-service',
      'dialysis-planning-edit-service',
      'dialysis-prescription-edit-service',
      'dialysis-records-edit-service',
      'dialysis-run-sheets-edit-service',
      'dialyzer-edit-service',
      'dietary-interventions-edit-service',
      'disability-evaluations-edit-service',
      'discharge-planning-edit-service',
      'disease-activity-scores-edit-service',
      'disease-severity-edit-service',
      'dnr-orders-edit-service',
      'doctors-medication-recommendations-edit-service',
      'document-metadata-edit-service',
      'donor-egg-cycle-edit-service',
      'drug-gene-interaction-report-edit-service',
      'durable-medical-equipment-orders-edit-service',
      'dvt-prophylaxis-edit-service',
      'ed-course-edit-service',
      'ed-disposition-edit-service',
      'ed-triage-assessment-edit-service',
      'education-initiated-edit-service',
      'eeg-reports-edit-service',
      'elder-abuse-screening-edit-service',
      'emergency-airway-management-edit-service',
      'emergency-assessment-edit-service',
      'emergency-discharge-summaries-edit-service',
      'emergency-observation-unit-edit-service',
      'emergency-reports-edit-service',
      'emg-reports-edit-service',
      'ems-run-reports-edit-service',
      'endocrine-lab-results-edit-service',
      'endocrine-therapy-edit-service',
      'endocrinology-assessment-edit-service',
      'endocrinology-consultations-edit-service',
      'endoscopy-findings-edit-service',
      'ent-assessment-edit-service',
      'ent-consultations-edit-service',
      'enteral-feeding-assessment-edit-service',
      'environmental-exposures-edit-service',
      'epilepsy-assessment-edit-service',
      'ergonomic-assessment-edit-service',
      'estimated-blood-loss-edit-service',
      'estimated-delivery-date-edit-service',
      'estimated-time-to-dialysis-edit-service',
      'excessive-glucose-monitoring-edit-service',
      'exercise-prescription-edit-service',
      'exercise-program-edit-service',
      'exercise-recommendations-edit-service',
      'extended-family-history-edit-service',
      'extraintestinal-manifestations-edit-service',
      'facility-edit-service',
      'fall-prevention-education-edit-service',
      'fall-risk-assessments-edit-service',
      'family-medicine-assessment-edit-service',
      'family-medicine-visits-edit-service',
      'family-meeting-notes-edit-service',
      'fecal-calprotectin-edit-service',
      'fertility-preservation-edit-service',
      'fetal-assessment-edit-service',
      'fetal-surveillance-edit-service',
      'fetal-ultrasound-edit-service',
      'first-trimester-screen-result-edit-service',
      'flare-management-edit-service',
      'flow-cytometry-reports-edit-service',
      'fluid-electrolyte-management-edit-service',
      'fluid-intake-edit-service',
      'fluid-output-edit-service',
      'ventilator-weaning-protocol-edit-service',
      'follow-up-enhanced-edit-service',
      'follow-up-intelligence-edit-service',
      'follow-ups-edit-service',
      'food-insecurity-edit-service',
      'foot-exam-edit-service',
      'wound-healing-hyperbaric-edit-service',
      'hyperbaric-oxygen-therapy-edit-service',
      'decompression-sickness-treatment-edit-service',
      'diabetic-foot-assessment-edit-service',
      'podiatry-consultations-edit-service',
      'podiatry-examinations-edit-service',
      'bunion-surgery-evaluation-edit-service',
      'heel-pain-assessment-edit-service',
      'ingrown-toenail-treatment-edit-service',
      'plantar-fasciitis-management-edit-service',
      'foot-orthotics-assessment-edit-service',
      'breastfeeding-recommendation-edit-service',
      'postpartum-diabetes-risk-edit-service',
      'gdm-recurrence-risk-edit-service',
      'postpartum-glucose-monitoring-edit-service',
      'total-weight-gain-edit-service',
      'pre-pregnancy-weight-edit-service',
      'early-maternity-leave-edit-service',
      'inter-pregnancy-weight-management-edit-service',
      'toxicity-assessment-edit-service',
      'oncologic-emergencies-edit-service',
      'pre-chemotherapy-workup-edit-service',
      'toxicology-reports-edit-service',
      'fitness-for-duty-evaluations-edit-service',
      'employment-counseling-edit-service',
      'pre-employment-physical-edit-service',
      'prenatal-testing-reports-edit-service',
      'maternal-fetal-reports-edit-service',
      'ultrasound-ob-reports-edit-service',
      'macrosomia-threshold-edit-service',
      'psychiatric-discharge-summaries-edit-service',
      'psychiatric-progress-notes-edit-service',
      'homicide-risk-assessment-edit-service',
      'psychiatric-review-edit-service',
      'behavioral-health-goals-edit-service',
      'functional-assessments-edit-service',
      'functional-mri-studies-edit-service',
      'liver-transplant-evaluation-edit-service',
      'lung-transplant-evaluation-edit-service',
      'stem-cell-transplant-assessment-edit-service',
      'bleeding-risk-assessment-edit-service',
      'diabetes-management-plan-edit-service',
      'pump-advanced-settings-edit-service',
      'pancreas-transplant-evaluation-edit-service',
      'liver-transplant-follow-up-edit-service',
      'lung-transplant-follow-up-edit-service',
      'adhd-assessment-edit-service',
      'access-planning-edit-service',
      'acmg-guidelines-reference-edit-service',
      'acute-kidney-injury-edit-service',
      'additional-data-edit-service',
      'admission-recommendations-edit-service',
      'advance-care-planning-edit-service',
      'advance-directives-edit-service',
      'airway-management-edit-service',
      'allergy-assessments-edit-service',
      'allergy-immunology-assessment-edit-service',
      'allergy-skin-testing-edit-service',
      'anatomy-scan-result-edit-service',
      'anesthesia-edit-service',
      'anesthesia-complications-edit-service',
      'anesthesia-consent-edit-service',
      'anesthesia-records-edit-service',
      'anesthesiology-assessment-edit-service',
      'apgar-scores-edit-service',
      'appetite-stimulants-edit-service',
      'antibiotic-stewardship-edit-service',
      'antibiogram-reports-edit-service',
      'anticoagulation-management-edit-service',
      'arterial-blood-gases-edit-service',
      'anticipatory-guidance-edit-service',
      'antimicrobial-susceptibility-edit-service',
      'arthritis-assessments-edit-service',
      'articular-cartilage-edit-service',
      'assistive-devices-edit-service',
      'athletic-injury-assessment-edit-service',
      'asthma-action-plan-edit-service',
      'asthma-assessments-edit-service',
      'asthma-management-notes-edit-service',
      'athlete-specific-data-edit-service',
      'audiometry-reports-edit-service',
      'autoantibody-profile-edit-service',
      'autoimmune-evaluations-edit-service',
      'autoimmune-panels-edit-service',
      'autopsy-reports-edit-service',
      'barriers-psychosocial-issues-edit-service',
      'basal-rate-adjustments-edit-service',
      'behavioral-assessment-edit-service',
      'biologic-therapy-records-edit-service',
      'biopsy-reports-edit-service',
      'biopsychosocial-formulation-edit-service',
      'birth-history-edit-service',
      'birth-plan-edit-service',
      'blood-disorder-reports-edit-service',
      'blood-sample-collection-status-edit-service',
      'blood-glucose-logs-edit-service',
      'blood-glucose-monitoring-edit-service',
      'blood-pressure-readings-edit-service',
      'blood-products-ordered-edit-service',
      'blood-smears-edit-service',
      'bolus-adjustments-edit-service',
      'bone-health-edit-service',
      'bone-marrow-studies-edit-service',
      'bone-scan-reports-edit-service',
      'brain-tumor-characteristics-edit-service',
      'brain-tumor-molecular-markers-edit-service',
      'syphilis-treatment-follow-up-edit-service',
      'varicose-vein-treatment-edit-service',
      'heart-transplant-follow-up-edit-service',
      'kidney-transplant-follow-up-edit-service',
      'foot-reconstruction-edit-service',
      'pulmonary-rehabilitation-edit-service',
      'medication-action-plan-edit-service',
      'polypharmacy-edit-service',
      'cesarean-threshold-edit-service',
      'diabetes-educator-training-edit-service',
      'height-measurements-edit-service',
      'point-of-care-ultrasound-heart-rate-edit-service',
      'glucose-testing-weeks-edit-service',
      'social-functional-assessment-edit-service',
      'patient-emotional-response-edit-service',
      'support-group-referral-edit-service',
      'partner-involvement-edit-service',
      'admission-decisions-edit-service',
      'post-op-testing-edit-service',
      'postop-testing-edit-service',
      'bone-marrow-transplant-evaluation-edit-service',
      'bone-marrow-transplant-follow-up-edit-service',
      'pancreas-transplant-follow-up-edit-service',
      'bone-marrow-reports-edit-service',
      'cytogenetics-edit-service',
      'blood-products-edit-service',
      'pre-operative-preparation-edit-service',
      'amniotic-fluid-index-current-edit-service',
      'fetal-echo-results-edit-service',
      'annual-physical-examination-edit-service',
      'caregiver-support-groups-edit-service',
      'family-meeting-decisions-edit-service',
      'frailty-assessment-edit-service',
      'geriatric-nutritional-assessment-edit-service',
      'chronic-disease-goals-edit-service',
      'continuous-glucose-monitor-discussion-edit-service',
      'hypoglycemia-protocol-edit-service',
      'hormone-therapy-records-edit-service',
      'fluid-electrolyte-management-edit-service',
      'urology-assessment-edit-service',
      'neuropsych-testing-edit-service',
      'wellness-visit-documentation-edit-service',
      'trend-analysis-edit-service',
      'biologic-therapy-edit-service',
      'continuous-glucose-monitor-edit-service',
      'vital-signs-monitoring-edit-service',
      'obstetric-ultrasound-reports-edit-service',
      'doctors-medications-recommendations-optimizations-edit-service',
      'allergies-assessments-edit-service',
      'occupational-exposure-records-edit-service',
      'fmla-documentation-note-edit-service',
      'workers-comp-evaluations-edit-service',
      'emergency-disposition-edit-service',
      'procedure-requests-edit-service',
      'port-placement-edit-service',
      'burn-assessment-edit-service',
      'burn-fluid-resuscitation-edit-service',
      'burn-wound-care-edit-service',
      'burn-rehabilitation-edit-service',
      'cam-icu-edit-service',
      'ckd-assessment-edit-service',
      'ckd-management-edit-service',
      'cancer-diagnosis-edit-service',
      'cancer-related-side-effects-edit-service',
      'cancer-screening-records-edit-service',
      'cancer-staging-edit-service',
      'carbohydrate-counting-education-edit-service',
      'cardiac-catheterization-reports-edit-service',
      'cardiac-device-interrogations-edit-service',
      'cardiac-monitoring-edit-service',
      'cardiac-rehabilitation-reports-edit-service',
      'cardiology-admission-notes-edit-service',
      'cardiology-consultations-edit-service',
      'cardiology-followup-reports-edit-service',
      'cardiovascular-risk-reduction-edit-service',
      'cardiovascular-risk-screening-edit-service',
      'care-coordination-edit-service',
      'care-coordination-notes-edit-service',
      'care-team-edit-service',
      'caregiver-assessment-edit-service',
      'caregiver-support-edit-service',
      'cascade-testing-protocol-edit-service',
      'case-summaries-edit-service',
      'cell-free-dna-results-edit-service',
      'cgm-data-edit-service',
      'challenge-tests-edit-service',
      'chemotherapy-records-edit-service',
      'chemotherapy-regimen-edit-service',
      'children-specific-risk-edit-service',
      'chiropractic-consultations-edit-service',
      'chiropractic-treatment-plan-edit-service',
      'chiropractic-x-ray-review-edit-service',
      'chronic-disease-management-edit-service',
      'chronic-pain-assessment-edit-service',
      'clinical-decision-support-edit-service',
      'clinical-risk-scores-edit-service',
      'clinical-scores-edit-service',
      'clinical-trial-documents-edit-service',
      'clinical-trials-edit-service',
      'closure-technique-edit-service',
      'functional-status-edit-service',
      'gi-risk-assessment-edit-service',
      'gait-analysis-edit-service',
      'gastroenterology-consultations-edit-service',
      'genetic-oncology-edit-service',
      'genetic-testing-reports-edit-service',
      'genetics-psychosocial-assessment-edit-service',
      'geriatric-assessments-edit-service',
      'geriatric-care-planning-edit-service',
      'geriatric-cognitive-assessment-edit-service',
      'geriatric-medications-edit-service',
      'gestational-diabetes-edit-service',
      'glasgow-coma-scale-edit-service',
      'glaucoma-assessments-edit-service',
      'glaucoma-management-edit-service',
      'glomerular-disease-edit-service',
      'glucose-monitoring-frequency-edit-service',
      'glucose-monitoring-goals-edit-service',
      'goals-of-care-discussion-edit-service',
      'goals-of-care-discussions-edit-service',
      'growth-parameters-edit-service',
      'gout-assessment-edit-service',
      'guideline-compliance-edit-service',
      'gynecology-consultations-edit-service',
      'harm-reduction-counseling-edit-service',
      'headache-assessment-edit-service',
      'health-maintenance-edit-service',
      'heart-transplant-evaluation-edit-service',
      'hematology-assessment-edit-service',
      'hematology-consultations-edit-service',
      'hepatitis-c-management-edit-service',
      'hiv-history-edit-service',
      'home-health-notes-edit-service',
      'home-health-orders-edit-service',
      'home-monitoring-edit-service',
      'home-safety-edit-service',
      'hormone-panels-edit-service',
      'hospice-notes-edit-service',
      'mortality-risk-assessment-edit-service',
      'pressure-ulcer-risk-edit-service',
      'palliative-care-edit-service',
      'hydration-management-edit-service',
      'hospital-admission-notes-edit-service',
      'hospital-transfer-notes-edit-service',
      'admission-assessments-edit-service',
      'second-opinion-reports-edit-service',
      'readmission-risk-assessment-edit-service',
      'myositis-assessment-edit-service',
      'polycystic-kidney-disease-edit-service',
      'travel-medicine-assessment-edit-service',
      'travel-health-certificates-edit-service',
      'health-coaching-notes-edit-service',
      'ibd-biomarkers-edit-service',
      'respiratory-infections-edit-service',
      'transfer-summaries-edit-service',
      'hospital-discharge-edit-service',
      'hospital-discharge-summaries-edit-service',
      'hourly-vital-signs-edit-service',
      'hypertensive-nephropathy-edit-service',
      'hypoglycemia-management-edit-service',
      'ibd-assessment-edit-service',
      'ibd-consultation-details-edit-service',
      'ibd-surgical-planning-edit-service',
      'icu-flow-sheets-edit-service',
      'imaging-orders-edit-service',
      'immediate-interventions-edit-service',
      'immune-function-tests-edit-service',
      'immune-reconstitution-planning-edit-service',
      'infection-control-records-edit-service',
      'infectious-disease-assessment-edit-service',
      'infection-risk-monitoring-edit-service',
      'infection-surveillance-edit-service',
      'indian-diet-exchange-lists-edit-service',
      'inflammatory-bowel-reports-edit-service',
      'inflammatory-markers-edit-service',
      'infliximab-drug-monitoring-edit-service',
      'infusion-therapy-edit-service',
      'inheritance-pattern-details-edit-service',
      'injury-details-edit-service',
      'insulin-adjustment-protocol-edit-service',
      'insulin-pump-settings-edit-service',
      'insulin-regimen-edit-service',
      'insulin-storage-instructions-edit-service',
      'insulin-timing-instructions-edit-service',
      'insurance-forms-edit-service',
      'intake-output-records-edit-service',
      'intelligent-recommendations-edit-service',
      'interval-history-edit-service',
      'interventional-pain-procedures-edit-service',
      'interventional-radiology-notes-edit-service',
      'intradialytic-monitoring-edit-service',
      'intraoperative-cholangiography-edit-service',
      'intraoperative-findings-edit-service',
      'intraoperative-imaging-edit-service',
      'intraoperative-monitoring-edit-service',
      'intraoperative-records-edit-service',
      'isolation-precautions-edit-service',
      'jaw-reconstruction-edit-service',
      'ketone-monitoring-instructions-edit-service',
      'kidney-disease-progression-timeline-edit-service',
      'kidney-function-reports-edit-service',
      'lab-orders-edit-service',
      'labor-delivery-records-edit-service',
      'laryngoscopy-reports-edit-service',
      'lifestyle-assessments-edit-service',
      'lifestyle-counseling-edit-service',
      'lifestyle-risk-assessment-edit-service',
      'ligament-reconstruction-edit-service',
      'lupus-assessment-edit-service',
      'lymph-node-cytomorphology-edit-service',
      'low-vision-evaluation-edit-service',
      'mammography-reports-edit-service',
      'maternal-labs-edit-service',
      'maternal-weight-monitoring-edit-service',
      'mayo-score-edit-service',
      'mechanism-of-injury-edit-service',
      'medical-alerts-edit-service',
      'medical-certificates-edit-service',
      'medical-geneticist-edit-service',
      'medical-history-edit-service',
      'medical-power-of-attorney-edit-service',
      'medical-reconciliation-forms-edit-service',
      'medication-access-programs-edit-service',
      'medication-administration-records-edit-service',
      'medication-changes-discontinued-edit-service',
      'medication-changes-dose-edit-service',
      'medication-changes-new-edit-service',
      'medication-deprescribing-edit-service',
      'medication-optimization-edit-service',
      'medication-reconciliation-edit-service',
      'medication-renal-dosing-edit-service',
      'medication-safety-edit-service',
      'medication-safety-alerts-edit-service',
      'medication-therapy-management-edit-service',
      'medications-administered-edit-service',
      'meniscus-repair-edit-service',
      'mental-health-assessments-edit-service',
      'mental-health-resources-edit-service',
      'mental-status-exam-edit-service',
      'microbiology-culture-reports-edit-service',
      'mineral-bone-disease-edit-service',
      'mood-psychological-assessment-edit-service',
      'motor-complications-edit-service',
      'movement-disorder-assessment-edit-service',
      'mri-reports-edit-service',
      'multimodal-pain-therapy-edit-service',
      'multiple-sclerosis-assessment-edit-service',
      'myeloma-specific-data-edit-service',
      'nephrology-consultation-details-edit-service',
      'nephrology-consultations-edit-service',
      'neuro-imaging-edit-service',
      'neurological-assessment-edit-service',
      'neurological-exam-edit-service',
      'neurological-examination-edit-service',
      'neurological-findings-edit-service',
      'neurology-consultations-edit-service',
      'neurology-progress-notes-edit-service',
      'neuromuscular-disorder-edit-service',
      'neuropsychological-assessments-edit-service',
      'neurosurgery-assessment-edit-service',
      'neurosurgery-consultations-edit-service',
      'neurovascular-exam-edit-service',
      'newborn-screening-results-edit-service',
      'nicu-progress-notes-edit-service',
      'non-motor-symptoms-edit-service',
      'nuclear-medicine-assessment-edit-service',
      'nuclear-medicine-studies-edit-service',
      'nursing-assessments-edit-service',
      'nursing-notes-edit-service',
      'nurse-signatures-edit-service',
      'nutrition-assessments-edit-service',
      'nutritional-assessment-edit-service',
      'nutritional-supplementation-edit-service',
      'nutritional-support-edit-service',
      'nutrition-support-consultation-edit-service',
      'obstetric-history-edit-service',
      'occupational-health-assessment-edit-service',
      'occupational-medicine-evaluations-edit-service',
      'occupational-therapy-reports-edit-service',
      'oncology-consultations-edit-service',
      'oncology-followup-reports-edit-service',
      'oncology-team-edit-service',
      'oncology-treatment-plans-edit-service',
      'omissions-refusals-edit-service',
      'operative-details-edit-service',
      'operative-report-details-edit-service',
      'operative-reports-edit-service',
      'operative-technique-edit-service',
      'ophthalmology-exam-edit-service',
      'ophthalmology-examinations-edit-service',
      'optometry-examination-edit-service',
      'opioid-risk-assessment-edit-service',
      'opportunistic-infections-edit-service',
      'oral-pathology-biopsy-edit-service',
      'oral-surgery-reports-edit-service',
      'orthodontic-treatment-plans-edit-service',
      'orthognathic-surgery-evaluation-edit-service',
      'orthopedic-assessment-edit-service',
      'orthopedic-consultations-edit-service',
      'orthopedic-followup-notes-edit-service',
      'orthopedic-imaging-edit-service',
      'overtraining-assessment-edit-service',
      'orthopedic-operative-reports-edit-service',
      'orthopedic-procedures-edit-service',
      'outcomes-predictions-edit-service',
      'outcomes-predictions-smart-edit-service',
      'psc-management-edit-service',
      'pain-assessment-forms-edit-service',
      'pain-management-notes-edit-service',
      'medication-dosing-recommendation-edit-service',
      'pharmacogenomic-testing-edit-service',
      'malnutrition-risk-assessment-edit-service',
      'pain-medication-agreements-edit-service',
      'pain-functional-assessment-edit-service',
      'pain-management-plan-edit-service',
      'palliative-care-needs-edit-service',
      'parental-concerns-edit-service',
      'parenteral-nutrition-monitoring-edit-service',
      'nutrition-lab-monitoring-edit-service',
      'parkinson-medications-edit-service',
      'parkinsonian-features-edit-service',
      'partner-involvement-diabetes-management-edit-service',
      'past-ocular-history-edit-service',
      'pathology-gross-description-edit-service',
      'patient-advocacy-support-edit-service',
      'patient-barriers-assessment-edit-service',
      'patient-compliance-tracking-edit-service',
      'patient-education-diabetes-edit-service',
      'patient-engagement-metrics-edit-service',
      'patient-goal-setting-edit-service',
      'patient-portal-security-edit-service',
      'patient-reported-measures-edit-service',
      'patient-safety-screening-edit-service',
      'pediatric-dental-edit-service',
      'pediatric-growth-charts-edit-service',
      'pediatric-screening-edit-service',
      'pediatric-vaccination-records-edit-service',
      'pediatric-visits-edit-service',
      'performance-status-edit-service',
      'periodontal-charts-edit-service',
      'peripheral-artery-disease-edit-service',
      'integrative-oncology-edit-service',
      'peripheral-neuropathy-edit-service',
      'pet-scan-reports-edit-service',
      'pharmacist-consultation-edit-service',
      'physical-therapy-evaluations-edit-service',
      'physical-therapy-notes-edit-service',
      'falls-prevention-program-assessment-edit-service',
      'pharmacy-review-edit-service',
      'plastic-surgery-assessment-edit-service',
      'plastic-surgery-consultations-edit-service',
      'poison-control-reports-edit-service',
      'pmr-assessment-edit-service',
      'pneumoperitoneum-edit-service',
      'polypharmacy-reviews-edit-service',
      'post-dialysis-assessment-edit-service',
      'post-operative-reports-edit-service',
      'postoperative-condition-edit-service',
      'postoperative-orders-edit-service',
      'postoperative-pain-management-edit-service',
      'postpartum-notes-edit-service',
      'postpartum-planning-edit-service',
      'potential-testing-outcomes-edit-service',
      'pre-dialysis-assessment-edit-service',
      'pre-operative-assessments-edit-service',
      'preconception-counseling-edit-service',
      'pregnancy-course-edit-service',
      'pregnancy-risk-assessment-edit-service',
      'pregnancy-symptoms-edit-service',
      'prenatal-education-edit-service',
      'prenatal-screening-edit-service',
      'prenatal-visits-edit-service',
      'preoperative-evaluation-edit-service',
      'preoperative-preparation-edit-service',
      'prep-and-drape-edit-service',
      'prescriptions-edit-service',
      'pressure-injury-edit-service',
      'preventive-biomarkers-edit-service',
      'preventive-care-edit-service',
      'preventive-medicine-assessments-edit-service',
      'primary-prophylaxis-edit-service',
      'prior-authorization-forms-edit-service',
      'prior-authorization-status-edit-service',
      'prn-medications-edit-service',
      'procedures-interventions-edit-service',
      'prognosis-discussion-edit-service',
      'prognosis-records-edit-service',
      'prognostic-factors-edit-service',
      'progress-notes-edit-service',
      'prophylactic-medications-edit-service',
      'proposed-art-switch-edit-service',
      'sperm-analysis-edit-service',
      'intrauterine-insemination-edit-service',
      'surrogacy-evaluation-edit-service',
      'proteinuria-assessment-edit-service',
      'provider-info-edit-service',
      'psychiatric-evaluation-edit-service',
      'psychiatric-evaluations-edit-service',
      'psychiatric-history-edit-service',
      'psychiatric-treatment-plan-edit-service',
      'psychosocial-assessments-edit-service',
      'psychosocial-factors-edit-service',
      'psychosocial-oncology-edit-service',
      'psychosocial-support-services-edit-service',
      'psychotropic-medications-edit-service',
      'pulmonary-function-tests-edit-service',
      'pulmonary-rehabilitation-notes-edit-service',
      'pulmonology-consultations-edit-service',
      'pump-download-analysis-edit-service',
      'quality-assurance-edit-service',
      'quality-metrics-edit-service',
      'radiation-therapy-edit-service',
      'radiation-therapy-records-edit-service',
      'radiology-findings-edit-service',
      'radiology-reports-edit-service',
      'rapid-response-summaries-edit-service',
      'reason-for-referral-edit-service',
      'procedural-sedation-edit-service',
      'recommendations-edit-service',
      'referrals-placed-edit-service',
      'regional-anesthesia-edit-service',
      'rehabilitation-goals-edit-service',
      'rehabilitation-progress-notes-edit-service',
      'rehabilitation-protocol-edit-service',
      'reminders-edit-service',
      'renal-anemia-edit-service',
      'renal-nutrition-edit-service',
      'renal-protection-plan-edit-service',
      'reproductive-history-edit-service',
      'fertility-tracking-edit-service',
      'single-embryo-transfer-edit-service',
      'rescue-therapy-options-edit-service',
      'research-consent-forms-edit-service',
      'respiratory-devices-edit-service',
      'respite-care-edit-service',
      'response-assessment-edit-service',
      'resuscitation-records-edit-service',
      'retinal-examinations-edit-service',
      'return-to-play-protocol-edit-service',
      'return-to-sport-edit-service',
      'return-to-work-plan-edit-service',
      'rheumatologic-treatment-edit-service',
      'rheumatologic-assessment-edit-service',
      'rheumatologic-monitoring-edit-service',
      'rheumatology-consultations-edit-service',
      'risk-calculators-edit-service',
      'risk-counseling-edit-service',
      'risk-factors-edit-service',
      'safety-planning-edit-service',
      'school-health-forms-edit-service',
      'school-performance-edit-service',
      'scheduled-medications-edit-service',
      'scleroderma-assessment-edit-service',
      'screening-compliance-edit-service',
      'secondary-prophylaxis-edit-service',
      'sedation-records-edit-service',
      'sepsis-management-edit-service',
      'sjogrens-syndrome-assessment-edit-service',
      'skin-biopsy-reports-edit-service',
      'skin-grafting-evaluation-edit-service',
      'sleep-apnea-management-edit-service',
      'sleep-disorder-assessment-edit-service',
      'sleep-disturbances-edit-service',
      'sleep-hygiene-education-edit-service',
      'sleep-study-reports-edit-service',
      'smoking-cessation-program-edit-service',
      'social-support-edit-service',
      'social-work-edit-service',
      'social-work-notes-edit-service',
      'soap-notes-edit-service',
      'south-asian-nutritionist-edit-service',
      'specific-ige-testing-edit-service',
      'specific-ige-tests-edit-service',
      'specimens-edit-service',
      'speech-therapy-assessments-edit-service',
      'spinal-manipulation-record-edit-service',
      'spondyloarthritis-assessment-edit-service',
      'sports-medicine-evaluations-edit-service',
      'sports-nutrition-plan-edit-service',
      'sports-physical-examination-edit-service',
      'staging-summary-edit-service',
      'stress-test-reports-edit-service',
      'stroke-assessment-edit-service',
      'suicide-risk-assessment-edit-service',
      'supplementation-plans-edit-service',
      'supportive-care-edit-service',
      'surgical-approach-edit-service',
      'sponge-instrument-counts-edit-service',
      'surgical-consent-forms-edit-service',
      'surgical-history-edit-service',
      'surgical-oncology-edit-service',
      'surgical-steps-edit-service',
      'surgical-team-edit-service',
      'survivorship-care-plan-edit-service',
      'symptom-progression-edit-service',
      'symptom-progression-timeline-edit-service',
      'table-edit-service',
      'telemedicine-encounters-edit-service',
      'thoracic-surgery-assessment-edit-service',
      'thyroid-evaluations-edit-service',
      'thyroid-management-edit-service',
      'tmj-assessment-edit-service',
      'tourniquet-data-edit-service',
      'tpn-management-edit-service',
      'toxicology-reports-edit-service',
      'tractography-studies-edit-service',
      'transplant-assessment-edit-service',
      'transplant-evaluations-edit-service',
      'treatment-goals-edit-service',
      'treatment-summary-edit-service',
      'trending-analysis-edit-service',
      'triage-data-edit-service',
      'tropical-disease-assessment-edit-service',
      'tube-feeding-order-edit-service',
      'tumor-board-notes-edit-service',
      'tumor-marker-panels-edit-service',
      'tumor-markers-edit-service',
      'urodynamic-studies-edit-service',
      'urology-consultations-edit-service',
      'vaccination-records-edit-service',
      'vasculitis-assessment-edit-service',
      'variant-interpretation-guidelines-edit-service',
      'ventilator-settings-edit-service',
      'visual-acuity-reports-edit-service',
      'vision-therapy-assessment-edit-service',
      'vital-signs-edit-service',
      'vital-signs-table-edit-service',
      'vital-signs-logs-edit-service',
      'weight-measurements-edit-service',
      'weekly-virtual-check-ins-edit-service',
      'weight-monitoring-edit-service',
      'well-child-examinations-edit-service',
      'well-child-summary-edit-service',
      'work-accommodations-edit-service',
      'work-restrictions-edit-service',
      'workers-compensation-evaluation-edit-service',
      'workplace-accommodations-edit-service',
      'workplace-injury-report-edit-service',
      'wound-care-assessments-edit-service',
      'wound-care-documentation-edit-service',
      'wound-care-notes-edit-service',

    'cardiology-admission-edit-service',
    'care-gaps-edit-service',
    'pathology-reports-edit-service',
    'patient-care-goals-edit-service',
    'patient-care-plan-edit-service',
    'patient-details-edit-service',
    'patient-education-context-edit-service',
    'patient-instructions-edit-service',
    'patient-positioning-edit-service',
    'patient-specific-care-plan-edit-service',
    'amniocentesis-reports-edit-service',
    'amniotic-fluid-assessment-edit-service',
    'cervical-assessment-edit-service',
    'cervical-length-measurement-edit-service',
    'perinatal-mental-health-referral-edit-service',
    'fetal-echo-edit-service',
    'first-trimester-bleeding-edit-service',
    'growth-ultrasound-schedule-edit-service',
    'nt-scan-result-edit-service',
    'preeclampsia-monitoring-edit-service',
    'pregnancy-complications-edit-service',
    'umbilical-artery-doppler-edit-service',
    'sti-screening-panel-edit-service',
    'hiv-pep-prophylaxis-edit-service',
    'hiv-prep-management-edit-service',
    'sexual-health-counseling-edit-service',
    'partner-notification-edit-service',
    'shift-handoff-notes-edit-service',
    'respiratory-therapy-assessment-edit-service',
    'oxygen-titration-protocol-edit-service',
    'airway-clearance-therapy-edit-service',
    'bronchial-hygiene-therapy-edit-service',
    'cpap-bipap-management-edit-service',
    'cpap-management-edit-service',
    'single-embryo-transfer-details-edit-service',
    'ivf-cycle-monitoring-edit-service',
    'egg-retrieval-procedure-edit-service',
    'embryo-transfer-procedure-edit-service',
    'ovarian-stimulation-protocol-edit-service',
    'fertility-medication-management-edit-service',
    'rheumatoid-arthritis-assessment-edit-service',
    'advance-directive-discussion-edit-service',
    'adult-day-program-info-edit-service',
    'nutritional-status-edit-service',
    'operative-time-edit-service',
    'vascular-surgery-assessment-edit-service',
    'job-hazard-analysis-edit-service',
    'vascular-bypass-surgery-edit-service',
    'venous-insufficiency-assessment-edit-service',
    'aortic-aneurysm-surveillance-edit-service',
    'trauma-flow-sheets-edit-service',
    'trauma-assessment-edit-service',
    'trauma-scoring-edit-service',
    'emergency-procedures-edit-service',
    'immunization-schedule-edit-service',
    'travel-vaccination-records-edit-service',
    'facial-trauma-assessment-edit-service',
    'insomnia-assessment-edit-service',
    'narcolepsy-assessment-edit-service',
    'immediate-recommendations-edit-service',
    'immunization-record-edit-service',
    'iv-infusions-edit-service',
    'venous-thromboembolism-risk-edit-service',
    'performance-assessment-edit-service',
    'document-type-edit-service',
      // Domain services
      'patientService',  // Patient management
      'medicationService',  // Medication management
      'appointmentService',  // Appointment scheduling
      'prescriptionService',  // Prescription management
      'roleManagementService',  // RBAC role CRUD operations

      // Cron job services
      'follow-up-appointment-creator',  // Auto-creates appointments from scheduled follow-ups

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
      'batch-progress-cache',
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

      // Natural language and vector search services
      'natural-language-query-service',
      'vector-search-service',
      'emergency-response',
      'security-headers-optimization-service',
      'threat-detection-service',
      'zero-knowledge-auth-service',
      'ai-security-wrapper',
      
      // Learning services
      'learning-orchestrator',
      'learning-services-initializer',
      'procedural-memory-service',
      'workflow-predictor-service',
      'personal-assistant-service',
      'interaction-capture-service',
      'sequence-pattern-engine',
      'temporal-pattern-engine',
      'user-memory-service',
      'challenger-service',
      'solver-service',
      'bottleneck-detector-service',
      'automation-opportunity-service',
      'efficiency-analyzer-service',
      
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
      // Check if global model loader is ready (handle circular dependency case)
      if (!globalModelLoader || !('isReady' in globalModelLoader) || typeof globalModelLoader.isReady !== 'function' || !globalModelLoader.isReady()) {
        console.warn(`⚠️ GlobalModelLoader not ready for service '${context ? context.serviceId : 'UNKNOWN'}' - attempting lazy initialization...`);
        
        // Attempt lazy initialization of globalModelLoader
        try {
          if (globalModelLoader && globalModelLoader.initialize) {
            console.log('🔄 Attempting to initialize GlobalModelLoader on-demand...');
            await globalModelLoader.initialize();
            
            // Check if it's ready now
            if (globalModelLoader.isReady()) {
              console.log('✅ GlobalModelLoader successfully initialized on-demand');
            } else {
              console.error('❌ GlobalModelLoader initialization succeeded but still not ready');
              return null; // NO FALLBACK - Medical platform security
            }
          } else {
            console.error('❌ GlobalModelLoader does not have initialize method');
            return null; // NO FALLBACK - Medical platform security
          }
        } catch (initError) {
          console.error(`❌ Failed to initialize GlobalModelLoader on-demand: ${initError.message}`);
          return null; // NO FALLBACK - Medical platform security
        }
      }

      const ServiceAccount = globalModelLoader.getServiceAccountModel();
      
      // Retry logic for transient connection issues
      let account = null;
      let lastError = null;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Add timeout protection for MongoDB queries
          const queryPromise = ServiceAccount.findOne({
            serviceId: context.serviceId,
            active: true
          }).maxTimeMS(25000); // 25s max query time

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Service account validation timeout')), 30000)
          );

          account = await Promise.race([queryPromise, timeoutPromise]);
          
          // Success - break out of retry loop
          if (account || attempt === maxRetries) {
            break;
          }
        } catch (err) {
          lastError = err;
          // Only retry on connection/timeout errors
          if (err.message?.includes('timeout') || 
              err.message?.includes('connection') ||
              err.message?.includes('PoolCleared') ||
              err.message?.includes('network')) {
            if (attempt < maxRetries) {
              console.warn(`⚠️ Service account validation attempt ${attempt} failed (${err.message}), retrying...`);
              await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
            }
          } else {
            // Non-retryable error - throw immediately
            throw err;
          }
        }
      }
      
      if (!account && lastError) {
        throw lastError;
      }

      if (account && context.apiKey) {
        // Extract API key if it's an object (defensive handling for auth tokens)
        let apiKeyToVerify = context.apiKey;
        if (typeof context.apiKey === 'object' && context.apiKey !== null) {
          // Handle auth token objects
          apiKeyToVerify = context.apiKey.apiKey || context.apiKey.token || context.apiKey.sessionToken || String(context.apiKey);
        }

        // Verify API key hash (field is 'apiKeyHash' in the database)
        const bcrypt = require('bcryptjs');
        const isValidKey = await bcrypt.compare(apiKeyToVerify, account.apiKeyHash);
        
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
   * Auto-grant permissions to FieldMapper services for medical collections
   * Grants wildcard (*) access to all collections since FieldMappers are trusted medical data services
   */
  async autoGrantFieldMapperPermissions(serviceId, collection) {
    try {
      const { MongoClient } = require('mongodb');
      const fs = require('fs');
      const path = require('path');

      // Read MongoDB URI
      const mongoUriPath = path.join(__dirname, '../.kms/MONGODB_ADMIN_URI');
      const mongoUri = fs.readFileSync(mongoUriPath, 'utf8').trim();

      const client = new MongoClient(mongoUri);
      await client.connect();

      const db = client.db('intellicare_practice_global');

      // Grant wildcard access to ALL collections (FieldMappers are trusted)
      await db.collection('ServiceAccount').updateOne(
        { serviceId: serviceId },
        {
          $set: {
            allowedCollections: ['*'],  // Wildcard = all collections
            allowedOperations: {
              '*': ['insert', 'update', 'query']  // All operations on all collections
            },
            updatedAt: new Date()
          }
        }
      );

      await client.close();
      console.log(`✅ Auto-granted wildcard (*) access to ${serviceId} (triggered by ${collection})`);
    } catch (error) {
      console.error(`❌ Failed to auto-grant permissions:`, error.message);
    }
  }

  /**
   * Check if operation is allowed
   */
  isOperationAllowed(serviceAccount, collection, operation) {
    if (!serviceAccount) return false;

    // System services have all permissions
    if (serviceAccount.isSystemService) return true;

    if (!serviceAccount.allowedOperations) return false;

    // Handle different allowedOperations structures
    let allowedOps;

    if (serviceAccount.allowedOperations instanceof Map) {
      // First check if Map has numeric keys (incorrect structure)
      const hasNumericKeys = Array.from(serviceAccount.allowedOperations.keys()).some(key => !isNaN(key));

      if (hasNumericKeys) {
        // Handle incorrect structure with numeric keys
        // Collect all operations from all numeric keys
        const allOperations = [];
        for (const [key, ops] of serviceAccount.allowedOperations) {
          if (Array.isArray(ops)) {
            allOperations.push(...ops);
          }
        }
        // Check if the operation is in the combined list
        return allOperations.includes('*') || allOperations.includes(operation);
      } else {
        // Correct structure with collection names
        allowedOps = serviceAccount.allowedOperations.get(collection) ||
                     serviceAccount.allowedOperations.get('*');
      }
    } else {
      // Handle regular objects
      // Check if object has numeric keys (incorrect structure)
      const hasNumericKeys = Object.keys(serviceAccount.allowedOperations).some(key => !isNaN(key));

      if (hasNumericKeys) {
        // Handle incorrect structure with numeric keys
        // Collect all operations from all numeric keys
        const allOperations = [];
        for (const key in serviceAccount.allowedOperations) {
          const ops = serviceAccount.allowedOperations[key];
          if (Array.isArray(ops)) {
            allOperations.push(...ops);
          }
        }
        // Check if the operation is in the combined list
        return allOperations.includes('*') || allOperations.includes(operation);
      } else {
        // Correct structure with collection names
        allowedOps = serviceAccount.allowedOperations[collection] ||
                     serviceAccount.allowedOperations['*'];
      }
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
    if (!policy || !policy.rowLevelSecurity) {
      return filter;
    }

    const securityFilter = { ...filter };

    // Collections that don't need practice filtering (they're already in practice-specific databases)
    // Collections that don't need practiceId filter (already isolated by practice database)
    const practiceIsolatedCollections = [
      'chat_sessions',
      'chat_messages',
      'logintokens',
      'chatSessions',  // Legacy camelCase names
      'chatMessages',
      'patients',      // Patients are already isolated by practice database
      'appointments',  // Appointments are already isolated by practice database
      'follow_ups',    // Follow-ups are already isolated by practice database (system/operational, not medical)
      'follow_up_appointments', // Follow-up appointments are already isolated by practice database (medical collection)
      'reminders',     // Reminders are already isolated by practice database (system/operational, not medical)
      'documents',     // Documents are already isolated by practice database
      'pendinguploads', // Pending uploads are already isolated by practice database
      'notifications', // Notifications are already isolated by practice database
      'prognosis_records', // Medical collection - isolated by practice database, no practiceId field
      'medical_history',    // Medical collection - isolated by practice database, no practiceId field
      'past_medical_history',    // Medical collection - isolated by practice database, no practiceId field
      'functional_mri_studies', // Neurology medical collection - isolated by practice database, no practiceId field
      'tractography_studies', // Neurosurgery/Radiology medical collection - isolated by practice database, no practiceId field
      'brain_tumor_characteristics', // Oncology medical collection - isolated by practice database, no practiceId field
      'neurosurgery_consultations', // Neurosurgery medical collection - isolated by practice database, no practiceId field
      'medication_safety',
      'medications', // Medical collection - isolated by practice database, no practiceId field
      'allergy_skin_testing', // Allergy medical collection - isolated by practice database, no practiceId field
      'specific_ige_tests', // Allergy medical collection - isolated by practice database, no practiceId field
      'component_allergen_testing', // Allergy medical collection - isolated by practice database, no practiceId field
      'pulmonary_function_tests', // Pulmonology medical collection - isolated by practice database, no practiceId field
      'hospital_course', // Hospital medical collection - isolated by practice database, no practiceId field
      'echo_reports', // Cardiology medical collection - isolated by practice database, no practiceId field
      'social_history', // Social determinants medical collection - isolated by practice database, no practiceId field
      'chronic_disease_management', // Chronic disease management medical collection - isolated by practice database, no practiceId field
      'safety_alerts', // FDA recall alerts - GLOBAL database, no practiceId field needed
      'patient_recall_alerts', // Patient-specific FDA recall alerts - PRACTICE database, no practiceId field (isolated by db)
      'recall_processing_jobs', // Background job tracking - GLOBAL database
      'device_safety_alerts', // FDA device recall alerts - GLOBAL database
      'patient_device_recall_alerts', // Patient-specific device recall alerts - PRACTICE database (isolated by db)
      'roles',  // RBAC roles - isolated by practice database, no practiceId field
      'permission_requests',  // Permission requests - isolated by practice database, no practiceId field
      'patient_agent_memory'  // Per-patient cross-conversation agent memory - PRACTICE database, isolated by db, scoped by patientId
    ];

    // Check if this is a medical collection using the medical collections registry
    // Medical collections (850+) don't have practiceId field - they're isolated by database
    const medicalCollectionsService = require('./medicalCollectionsService');
    const isMedicalCollection = medicalCollectionsService.isMedicalCollection(collection);

    const skipClinicFilter = [...practiceIsolatedCollections];
    if (isMedicalCollection) {
      skipClinicFilter.push(collection);
    }

    // Add practice isolation (skip for global context and certain collections)
    // Note: Some collections use 'practiceSubdomain' field, not 'practiceId'
    // IMPORTANT: When querying a practice-specific database (not global), skip the practiceId filter
    // because the database itself provides the isolation
    const isPracticeDatabase = context.practiceId && context.practiceId !== 'global';
    const needsPracticeFilter = isPracticeDatabase && !skipClinicFilter.includes(collection);

    if (needsPracticeFilter) {
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
      'pendinguploads', // Pending uploads don't use soft delete
      'reminders',  // System/operational collection - no _deleted field
      'appointments',  // Appointments collection - no _deleted field
      // ALL medical collections - they don't have _deleted field
      'additional_notes', 'assessment_plans', 'chief_complaints',
      'family_history', 'history_present_illness', 'physical_examinations',
      'risk_factors', 'social_history', 'surgical_history',
      'lab_results', 'medication_safety',
        'medications', 'diagnoses', 'vital_signs',
      'allergies', 'consultation_notes', 'prescriptions',
      'past_medical_history', 'recommendations', 'diabetes_management_notes',
      'follow_up_appointments', 'follow_ups', 'imaging_reports', 'medical_images',
      'medical_alerts', 'medical_certificates', 'medical_procedures',
      'referrals', 'vaccination_records', 'brain_tumor_characteristics',
      'hospital_course',  // Hospital medical collection
      'functional_mri_studies',  // Neurology medical collection
      'tractography_studies',  // Neurosurgery/Radiology medical collection
      'neurosurgery_consultations',  // Neurosurgery medical collection
      'allergy_skin_testing',  // Allergy medical collection
      'specific_ige_tests',  // Allergy medical collection
      'component_allergen_testing',  // Allergy medical collection
      'pulmonary_function_tests',  // Pulmonology medical collection
      'patient_education_records',  // Patient education medical collection
      'medical_history',  // Medical history collection - no _deleted field
      'echo_reports',  // Cardiology medical collection - no _deleted field
      'chronic_disease_management',  // Chronic disease management medical collection - no _deleted field
      'psychosocial_assessments',  // Psychosocial assessments medical collection - no _deleted field
      'safety_alerts',  // FDA recall alerts - no _deleted field
      'patient_recall_alerts',  // Patient-specific FDA recall alerts - no _deleted field
      'recall_processing_jobs',  // FDA recall background job tracking - no _deleted field
      'device_safety_alerts',  // FDA device recall alerts - no _deleted field
      'patient_device_recall_alerts',  // Patient-specific device recall alerts - no _deleted field
      'drug_shortages',  // FDA drug shortage records - no _deleted field
      'patient_drug_shortage_alerts',  // Patient-specific drug shortage alerts - no _deleted field
      'drug_gene_interaction_report',  // Pharmacogenomic reports - no _deleted field
      'progress_notes',  // Progress notes - no _deleted field
      'cardiology_admission_notes',  // Cardiology admission notes - no _deleted field
      'ent_assessment',  // ENT assessment - no _deleted field
      'rehabilitation_goals',  // Rehabilitation goals - no _deleted field
      'trend_analysis',  // Trend analysis - no _deleted field
      'clinical_trial_documents',  // Clinical trial documents - no _deleted field
      'endocrine_lab_results',  // Endocrine lab results - no _deleted field
      'diabetes_supplies',  // Diabetes supplies - no _deleted field
      'basal_rate_adjustments',  // Basal rate adjustments - no _deleted field
      'bolus_adjustments',  // Bolus adjustments - no _deleted field
      'disease_activity_scores',  // Disease activity scores - no _deleted field
      'psc_management',  // PSC Management - no _deleted field
      'immune_function_tests',  // Immune function tests - no _deleted field
      'patient_visits',  // Patient visit recordings - uses isDeleted, not _deleted
      'roles'  // RBAC roles - uses isDeleted, not _deleted
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
    
    const DatabaseConnectionProvider = require('./databaseConnectionProvider');
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
    
    if (practiceId === 'global' || !practiceId) {
      dbName = 'intellicare_practice_global';
      if (!practiceId) {
        console.warn(`⚠️ [SecureDataAccess.getSecureDatabase] practiceId is falsy (${practiceId}), defaulting to global!`);
      }
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
        if (process.env.QUIET_LOGS !== 'true') console.log(`[SecureDataAccess] Connected to database: ${db.databaseName || db.name} for practiceId: ${practiceId}`);
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

    // CRITICAL: Declare enhancedFilter outside try block for retry logic
    // Collections that don't use soft delete
    const skipSoftDelete = [
      'chat_sessions',
      'chat_messages',
      'chatSessions',
      'chatMessages',
      'pendinguploads',
      'reminders',  // System/operational collection - no _deleted field
      'appointments',  // Appointments collection - no _deleted field
      'ServiceAccount',  // System collections
      'practices',
      'emailverifications',
      'hospital_discharge_summaries',  // Medical document collection
      'functional_mri_studies',  // Neurology medical collection
      'tractography_studies',  // Neurosurgery/Radiology medical collection
      'brain_tumor_characteristics',  // Oncology medical collection
      'neurosurgery_consultations',  // Neurosurgery medical collection
      'allergy_skin_testing',  // Allergy medical collection
      'specific_ige_tests',  // Allergy medical collection
      'component_allergen_testing',  // Allergy medical collection
      'pulmonary_function_tests',  // Pulmonology medical collection
      'patient_education_records',  // Patient education medical collection
      'medical_history',  // Medical history collection - no _deleted field
      'past_medical_history',  // Past medical history collection - no _deleted field
      'medication_safety',
        'medications',  // Medications collection - no _deleted field
      'echo_reports',  // Cardiology medical collection - no _deleted field
      'social_history',  // Social determinants medical collection - no _deleted field
      'chronic_disease_management',  // Chronic disease management medical collection - no _deleted field
      'psychosocial_assessments',  // Psychosocial assessments medical collection - no _deleted field
      'safety_alerts',  // FDA recall alerts - no _deleted field
      'patient_recall_alerts',  // Patient-specific FDA recall alerts - no _deleted field
      'recall_processing_jobs',  // FDA recall background job tracking - no _deleted field
      'device_safety_alerts',  // FDA device recall alerts - no _deleted field
      'patient_device_recall_alerts',  // Patient-specific device recall alerts - no _deleted field
      'drug_shortages',  // FDA drug shortage records - no _deleted field
      'patient_drug_shortage_alerts',  // Patient-specific drug shortage alerts - no _deleted field
      'drug_gene_interaction_report',  // Pharmacogenomic reports - no _deleted field
      'progress_notes',  // Progress notes - no _deleted field
      'cardiology_admission_notes',  // Cardiology admission notes - no _deleted field
      'ent_assessment',  // ENT assessment - no _deleted field
      'rehabilitation_goals',  // Rehabilitation goals - no _deleted field
      'trend_analysis',  // Trend analysis - no _deleted field
      'clinical_trial_documents',  // Clinical trial documents - no _deleted field
      'endocrine_lab_results',  // Endocrine lab results - no _deleted field
      'disease_activity_scores',  // Disease activity scores - no _deleted field
      'psc_management',  // PSC Management - no _deleted field
      'immune_function_tests',  // Immune function tests - no _deleted field
      'medical_images',  // Medical images - no _deleted field
      'patient_visits',  // Patient visit recordings - uses isDeleted, not _deleted
      'roles'  // RBAC roles - uses isDeleted, not _deleted
    ];

    // IMPORTANT: Exclude soft-deleted items unless explicitly requested
    // CRITICAL: Use Object.assign instead of spread to preserve ObjectId instances
    let enhancedFilter = Object.assign({}, filter);
    if (!filter._deleted && !skipSoftDelete.includes(collection)) {
      // For collections that use soft delete, exclude deleted items
      enhancedFilter = Object.assign({}, filter, {
        $or: [{ _deleted: false }, { _deleted: { $exists: false } }]
      });
    }

    try {
      // Handle both Mongoose connections and native MongoDB connections
      const nativeDb = db.db ? db.db : db; // If Mongoose connection, get native db

      // Debug logging for notifications
      if (collection === 'notifications') {
        console.log(`[SecureDataAccess] Querying notifications collection`);
        console.log(`[SecureDataAccess] Database: ${nativeDb.databaseName || db.name}`);
        console.log(`[SecureDataAccess] Enhanced filter:`, JSON.stringify(enhancedFilter));
      }

      // Debug hospital_discharge_summaries queries
      if (collection === 'hospital_discharge_summaries') {
        console.log(`[SecureDataAccess] Querying hospital_discharge_summaries`);
        console.log(`[SecureDataAccess] Database name: ${nativeDb.databaseName}`);
        console.log(`[SecureDataAccess] Original filter:`, JSON.stringify(filter));
        console.log(`[SecureDataAccess] Enhanced filter:`, JSON.stringify(enhancedFilter));
        console.log(`[SecureDataAccess] Skip soft delete:`, skipSoftDelete.includes(collection));
      }

      // Debug medications queries
      if (collection === 'medications') {
        const { ObjectId } = require('mongodb');
        console.log(`\n💊 [executeSecureQuery] Querying medications collection`);
        console.log(`   Database name: ${nativeDb.databaseName}`);
        console.log(`   Original filter:`, JSON.stringify(filter));
        console.log(`   Original filter._id type:`, typeof filter._id, filter._id instanceof ObjectId ? 'ObjectId' : 'NOT ObjectId', filter._id);
        console.log(`   Original filter.patientId type:`, typeof filter.patientId, filter.patientId);
        console.log(`   Enhanced filter:`, JSON.stringify(enhancedFilter));
        console.log(`   Enhanced filter._id type:`, typeof enhancedFilter._id, enhancedFilter._id instanceof ObjectId ? 'ObjectId' : 'NOT ObjectId');
        console.log(`   Skip soft delete:`, skipSoftDelete.includes(collection));
        console.log(`   Options:`, JSON.stringify(options));
      }

      // CRITICAL FIX: Handle count queries efficiently without materializing documents
      if (options.count) {
        const result = await nativeDb.collection(collection).countDocuments(enhancedFilter);
        return result; // Return count as number
      }

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

      // Log medications query results
      if (collection === 'medications') {
        console.log(`💊 [executeSecureQuery] MongoDB query returned ${result.length} results`);
        if (result.length > 0) {
          console.log(`   Sample IDs:`, result.slice(0, 3).map(r => r._id));
        }
      }

      // Debug: Log query results
      // Temporarily debug medical collections too
      const debugCollections = [
        'chat_sessions', 'pendinguploads',
        'additional_notes', 'assessment_plans', 'chief_complaints',
        'family_history', 'history_present_illness', 'physical_examinations',
        'risk_factors', 'social_history', 'surgical_history'
      ];
      // Disable verbose query logs when QUIET_LOGS=true
      if (process.env.QUIET_LOGS !== 'true' && process.env.NODE_ENV !== 'production' && debugCollections.includes(collection)) {
        console.log(`[SecureDataAccess] Query ${collection} with ORIGINAL filter:`, JSON.stringify(filter));
        console.log(`[SecureDataAccess] Query ${collection} with ENHANCED filter:`, JSON.stringify(enhancedFilter));
        console.log(`[SecureDataAccess] Database: ${nativeDb.databaseName || db.databaseName || db.name}`);
        console.log(`[SecureDataAccess] Found ${result.length} results`);
        if (result.length > 0 && result.length <= 3) {
          console.log(`[SecureDataAccess] Sample results:`, result.map(r => r.sessionId || r.uploadId || r._id));
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
      // Handle MongoDB connection errors with automatic reconnection and retry
      if (error.name === 'MongoNotConnectedError' ||
          error.message?.includes('Client must be connected') ||
          error.message?.includes('topology was destroyed')) {

        console.log('🔄 MongoDB connection lost, attempting to reconnect and retry...');

        // Clear the connection from cache to force a new one
        const dbName = db.name || db.databaseName || db.db?.databaseName;
        if (dbName) {
          const cacheKey = `db_${dbName.replace('intellicare_practice_', '')}`;
          this.connectionCache.delete(cacheKey);

          // Also clear from connection provider
          try {
            const provider = require('./databaseConnectionProvider');
            if (provider.databaseConnections) {
              provider.databaseConnections.delete(dbName);
            }
          } catch (e) {
            // Provider not available
          }

          // AUTOMATIC RETRY: Get fresh connection and retry the query ONCE
          try {
            console.log('🔄 Retrying query with fresh connection...');

            // Extract practice identifier from db name
            const practiceIdentifier = dbName.replace('intellicare_practice_', '');

            // Get fresh connection (will create new connection since cache was cleared)
            const freshDb = await this.getSecureDatabase(practiceIdentifier, 'secure-data-access');
            const nativeDb = freshDb.db ? freshDb.db : freshDb;

            // Rebuild and retry the query
            if (options.count) {
              const result = await nativeDb.collection(collection).countDocuments(enhancedFilter);
              console.log('✅ Retry succeeded - returning count');
              return result;
            }

            let query = nativeDb.collection(collection).find(enhancedFilter);

            if (options.projection) query = query.project(options.projection);
            if (options.sort) query = query.sort(options.sort);
            if (options.limit) query = query.limit(Math.min(options.limit, 1000));
            if (options.skip) query = query.skip(options.skip);

            const result = await query.toArray();
            console.log(`✅ Retry succeeded - returned ${result.length} results`);
            return result;

          } catch (retryError) {
            // Retry failed - now we give up
            console.error('❌ Retry failed after reconnection:', retryError.message);
            throw new Error('SECURITY: Database connection lost and retry failed - please refresh');
          }
        }

        // Couldn't determine database name - can't retry
        console.error('Query execution error (connection lost, no db name):', error.message);
        throw new Error('SECURITY: Database connection lost - please retry');
      }

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

    // Check rate limit - NO LIMIT for batch processing (production scale)
    // Production: Millions of documents from thousands of practices/hospitals daily
    // Batch processing: UNLIMITED (agent-service-v4, claude-batch-processor)
    // Regular operations: 10,000 queries/min for safety
    const isBatchProcessing = serviceId === 'agent-service-v4' || serviceId === 'claude-batch-processor';

    if (!isBatchProcessing) {
      const rateLimit = 10000;
      if (this.queryHistory[key].length >= rateLimit) {
        throw new Error('SECURITY: Rate limit exceeded');
      }
    }
    // No rate limit enforcement for batch processing services
    
    this.queryHistory[key].push(now);
  }

  /**
   * Encrypt sensitive fields
   */
  async encryptSensitiveFields(document, policy) {
    if (!policy?.sensitiveFields) return document;

    const { ObjectId } = require('mongodb');
    const encrypted = { ...document };

    for (const field of policy.sensitiveFields) {
      if (encrypted[field]) {
        // Check if the field is already encrypted (has encryption metadata)
        if (typeof encrypted[field] === 'object' &&
            (encrypted[field].encrypted === true || typeof encrypted[field].encrypted === 'string') &&
            encrypted[field].iv &&
            encrypted[field].authTag) {
          // Already encrypted by the caller, skip re-encryption
          process.env.NODE_ENV !== 'production' && console.log(`🔐 Field ${field} already encrypted, skipping re-encryption`);
          continue;
        }

        // CRITICAL: Don't encrypt ObjectId fields - they need to remain as ObjectIds for MongoDB queries
        // ObjectIds are not sensitive data (they're random identifiers), and encrypting them breaks queries
        if (encrypted[field] instanceof ObjectId) {
          console.log(`⚠️ Skipping encryption of ObjectId field: ${field}`);
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
module.exports = new SecureDataAccess();