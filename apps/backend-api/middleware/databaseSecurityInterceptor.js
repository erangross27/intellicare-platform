/**
 * 🛡️ DATABASE ACCESS INTERCEPTOR
 * This middleware blocks all unauthorized database access attempts.
 * It runs BEFORE any database operation and cannot be bypassed.
 * 
 * SECURITY CRITICAL: This interceptor prevents direct MongoDB/Mongoose access
 * All database operations MUST go through SecureDataAccess service
 */

const mongoose = require('mongoose');
const immutableAuditService = require('../services/immutableAuditService');
const { blockchainAuditService } = require('../services/blockchainAuditService');

class DatabaseSecurityInterceptor {
  constructor() {
    this.originalMethods = new Map();
    this.violationCount = new Map();
    this.initialized = false;
    this.allowedCallers = new Set([
      'secureDataAccess.js',
      'ServiceAccount.js',
      'DataAccessPolicy.js',
      'databaseFactory.js',  // Required for initial connection setup
      'server.js',  // Required for server initialization
      'practiceContext.js'  // Required for practice verification during request routing
    ]);
    
    // Track stack traces to identify bypass attempts
    this.bypassAttempts = [];
    
    // Initialize interception
    this.initialize();
  }

  /**
   * Initialize database access interception
   */
  initialize() {
    if (this.initialized) return;
    
    // Initializing Database Security Interceptor
    
    // Intercept Mongoose connection methods
    this.interceptMongooseConnection();
    
    // Intercept Model methods
    this.interceptModelMethods();
    
    // Intercept direct MongoDB operations
    this.interceptDirectMongoDB();
    
    // Monitor for new connections
    this.monitorNewConnections();
    
    this.initialized = true;
    // Database Security Interceptor initialized
  }

  /**
   * Intercept Mongoose connection methods
   */
  interceptMongooseConnection() {
    const self = this;
    
    // Store original connection method
    const originalConnect = mongoose.connect;
    const originalCreateConnection = mongoose.createConnection;
    
    // Override connect method
    mongoose.connect = async function(...args) {
      const stack = new Error().stack;
      
      if (!self.isAuthorizedCaller(stack)) {
        await self.logViolation('UNAUTHORIZED_CONNECT', {
          method: 'mongoose.connect',
          stack: stack
        });
        throw new Error('🔒 SECURITY VIOLATION: Direct database connection not allowed. Use SecureDataAccess service.');
      }
      
      return originalConnect.apply(this, args);
    };
    
    // Override createConnection method
    mongoose.createConnection = function(...args) {
      const stack = new Error().stack;
      
      if (!self.isAuthorizedCaller(stack)) {
        self.logViolation('UNAUTHORIZED_CREATE_CONNECTION', {
          method: 'mongoose.createConnection',
          stack: stack
        });
        throw new Error('🔒 SECURITY VIOLATION: Direct database connection not allowed. Use SecureDataAccess service.');
      }
      
      return originalCreateConnection.apply(this, args);
    };
  }

  /**
   * Intercept Model methods for all Mongoose models
   */
  interceptModelMethods() {
    const self = this;
    const methodsToIntercept = [
      'find', 'findOne', 'findById', 'findOneAndUpdate', 
      'findByIdAndUpdate', 'findOneAndDelete', 'findByIdAndDelete',
      'create', 'insertMany', 'updateOne', 'updateMany',
      'deleteOne', 'deleteMany', 'replaceOne', 'aggregate',
      'countDocuments', 'estimatedDocumentCount', 'distinct'
    ];
    
    // Hook into Mongoose's model compilation
    const originalModel = mongoose.model;
    mongoose.model = function(name, schema, ...args) {
      const Model = originalModel.call(this, name, schema, ...args);
      
      // Intercept each method
      methodsToIntercept.forEach(method => {
        if (typeof Model[method] === 'function') {
          const originalMethod = Model[method];
          
          Model[method] = function(...methodArgs) {
            const stack = new Error().stack;
            
            // Check if caller is authorized
            if (!self.isAuthorizedCaller(stack)) {
              // Log the violation with details
              self.logViolation('UNAUTHORIZED_MODEL_ACCESS', {
                model: name,
                method: method,
                stack: stack
              });
              
              // Audit every attempt
              immutableAuditService.logSecurityEvent({
                type: 'DATABASE_ACCESS_VIOLATION',
                severity: 'HIGH',
                details: {
                  model: name,
                  method: method,
                  caller: self.extractCaller(stack)
                }
              });
              
              throw new Error(`🔒 SECURITY VIOLATION: Direct ${method} on model ${name} not allowed. Use SecureDataAccess.query() instead.`);
            }
            
            // If authorized, proceed with audit logging
            const startTime = Date.now();
            const result = originalMethod.apply(this, methodArgs);
            
            // Log authorized access for monitoring
            if (result && typeof result.then === 'function') {
              return result.then(data => {
                self.auditAuthorizedAccess({
                  model: name,
                  method: method,
                  duration: Date.now() - startTime,
                  recordCount: Array.isArray(data) ? data.length : 1
                });
                return data;
              });
            }
            
            return result;
          };
        }
      });
      
      return Model;
    };
  }

  /**
   * Intercept direct MongoDB operations
   */
  interceptDirectMongoDB() {
    const self = this;
    
    // Intercept db.collection() calls
    const interceptCollection = (db) => {
      const originalCollection = db.collection;
      
      db.collection = function(name) {
        const stack = new Error().stack;
        
        if (!self.isAuthorizedCaller(stack)) {
          self.logViolation('DIRECT_MONGODB_ACCESS', {
            collection: name,
            stack: stack
          });
          
          throw new Error(`🔒 SECURITY VIOLATION: Direct MongoDB collection access not allowed. Use SecureDataAccess service.`);
        }
        
        const collection = originalCollection.call(this, name);
        
        // Intercept collection methods
        self.interceptCollectionMethods(collection, name);
        
        return collection;
      };
      
      // Block admin operations completely
      Object.defineProperty(db, 'admin', {
        get: function() {
          const stack = new Error().stack;
          self.logViolation('ADMIN_ACCESS_ATTEMPT', {
            stack: stack,
            severity: 'CRITICAL'
          });
          
          // This is a critical violation - block and alert
          self.handleCriticalViolation('Database admin access attempted');
          
          throw new Error('🔒 CRITICAL SECURITY VIOLATION: Database admin access is strictly prohibited.');
        }
      });
      
      // Block dropDatabase
      db.dropDatabase = function() {
        const stack = new Error().stack;
        self.logViolation('DROP_DATABASE_ATTEMPT', {
          stack: stack,
          severity: 'CRITICAL'
        });
        
        self.handleCriticalViolation('Database drop attempted');
        
        throw new Error('🔒 CRITICAL SECURITY VIOLATION: Database drop operations are strictly prohibited.');
      };
    };
    
    // Hook into mongoose connection to intercept db access
    // Use 'once' to prevent multiple listeners when connection is re-established
    if (mongoose.connection.readyState === 1) {
      // Already connected
      if (mongoose.connection.db) {
        interceptCollection(mongoose.connection.db);
      }
    } else {
      // Not yet connected, wait for connection
      mongoose.connection.once('connected', () => {
        if (mongoose.connection.db) {
          interceptCollection(mongoose.connection.db);
        }
      });
    }
  }

  /**
   * Intercept collection methods
   */
  interceptCollectionMethods(collection, collectionName) {
    const self = this;
    const methodsToIntercept = [
      'find', 'findOne', 'insertOne', 'insertMany',
      'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
      'replaceOne', 'aggregate', 'countDocuments', 'distinct',
      'createIndex', 'dropIndex', 'drop'
    ];
    
    methodsToIntercept.forEach(method => {
      if (typeof collection[method] === 'function') {
        const originalMethod = collection[method];
        
        collection[method] = function(...args) {
          const stack = new Error().stack;
          
          if (!self.isAuthorizedCaller(stack)) {
            self.logViolation('UNAUTHORIZED_COLLECTION_METHOD', {
              collection: collectionName,
              method: method,
              stack: stack
            });
            
            throw new Error(`🔒 SECURITY VIOLATION: Direct ${method} on collection ${collectionName} not allowed. Use SecureDataAccess service.`);
          }
          
          // Audit the operation
          const startTime = Date.now();
          const result = originalMethod.apply(this, args);
          
          if (result && typeof result.then === 'function') {
            return result.then(data => {
              self.auditAuthorizedAccess({
                collection: collectionName,
                method: method,
                duration: Date.now() - startTime
              });
              return data;
            });
          }
          
          return result;
        };
      }
    });
  }

  /**
   * Monitor for new database connections
   */
  monitorNewConnections() {
    const self = this;
    
    // Monitor mongoose connections
    const originalConnection = mongoose.Connection;
    
    mongoose.Connection = function(...args) {
      const conn = new originalConnection(...args);
      
      // Intercept when connection is established
      // Use 'once' to prevent multiple listeners
      conn.once('connected', () => {
        if (conn.db) {
          self.interceptDirectMongoDB();
        }
      });
      
      return conn;
    };
  }

  /**
   * Check if the caller is authorized based on stack trace
   */
  isAuthorizedCaller(stack) {
    if (!stack) return false;
    
    // Allow initialization and setup
    if (stack.includes('server.js') && stack.includes('initializeDatabase')) {
      return true;
    }
    
    // Check if any allowed file is in the stack
    for (const allowedFile of this.allowedCallers) {
      if (stack.includes(allowedFile)) {
        return true;
      }
    }
    
    // Allow specific initialization patterns
    if (stack.includes('mongoose.model') && stack.includes('Schema')) {
      // Allow model definition but not execution
      return true;
    }
    
    return false;
  }

  /**
   * Extract caller information from stack trace
   */
  extractCaller(stack) {
    if (!stack) return 'unknown';
    
    const lines = stack.split('\n');
    
    // Find the first line that's not from this interceptor
    for (const line of lines) {
      if (!line.includes('databaseSecurityInterceptor') && 
          !line.includes('node_modules') &&
          line.includes('.js')) {
        
        const match = line.match(/at .* \((.*\.js):(\d+):(\d+)\)/);
        if (match) {
          return {
            file: match[1],
            line: match[2],
            column: match[3]
          };
        }
      }
    }
    
    return 'unknown';
  }

  /**
   * Log security violation
   */
  async logViolation(type, details) {
    const violation = {
      type,
      timestamp: new Date(),
      details,
      caller: this.extractCaller(details.stack)
    };
    
    // Track violations
    this.bypassAttempts.push(violation);
    
    // Count violations per type
    const count = (this.violationCount.get(type) || 0) + 1;
    this.violationCount.set(type, count);
    
    // Log to audit system
    try {
      await immutableAuditService.logSecurityEvent({
        type: 'DATABASE_SECURITY_VIOLATION',
        subtype: type,
        severity: details.severity || 'HIGH',
        details: violation
      });
      
      // For critical violations, also log to blockchain
      if (details.severity === 'CRITICAL') {
        await blockchainAuditService.logCriticalEvent({
          event: 'DATABASE_SECURITY_CRITICAL',
          type,
          details: violation
        });
      }
    } catch (error) {
      console.error('Failed to log security violation:', error);
    }
    
    console.error(`🔒 DATABASE SECURITY VIOLATION [${type}]:`, violation);
    
    // If too many violations, escalate
    if (count > 10) {
      this.handleRepeatedViolations(type);
    }
  }

  /**
   * Audit authorized access for monitoring
   */
  async auditAuthorizedAccess(details) {
    try {
      // Log successful authorized access for monitoring patterns
      await immutableAuditService.logServiceDataAccess({
        authorized: true,
        ...details,
        timestamp: new Date()
      });
    } catch (error) {
      // Don't fail the operation if audit fails
      console.error('Audit logging failed:', error);
    }
  }

  /**
   * Handle critical security violations
   */
  handleCriticalViolation(message) {
    console.error('🚨 CRITICAL SECURITY VIOLATION:', message);
    
    // Log to blockchain for immutability
    blockchainAuditService.logCriticalEvent({
      event: 'CRITICAL_DATABASE_VIOLATION',
      message,
      timestamp: new Date(),
      action: 'BLOCKED'
    }).catch(console.error);
    
    // Could trigger additional security measures:
    // - Send alerts to security team
    // - Lock down the system
    // - Initiate incident response
  }

  /**
   * Handle repeated violations from same source
   */
  handleRepeatedViolations(type) {
    console.error(`🚨 REPEATED VIOLATIONS: ${type} occurred ${this.violationCount.get(type)} times`);
    
    // Could implement:
    // - IP blocking
    // - Service suspension
    // - Automatic incident creation
  }

  /**
   * Get violation statistics
   */
  getViolationStats() {
    return {
      totalViolations: this.bypassAttempts.length,
      violationsByType: Object.fromEntries(this.violationCount),
      recentViolations: this.bypassAttempts.slice(-10),
      criticalViolations: this.bypassAttempts.filter(v => v.details.severity === 'CRITICAL')
    };
  }

  /**
   * Reset violation tracking (for testing)
   */
  resetViolations() {
    this.bypassAttempts = [];
    this.violationCount.clear();
  }
}

// Create and export singleton instance
const interceptor = new DatabaseSecurityInterceptor();

// Export for use in other modules
module.exports = interceptor;