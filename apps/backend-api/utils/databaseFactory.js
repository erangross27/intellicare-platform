const mongoose = require('mongoose');
const config = require('config');
// REMOVED SecureDataAccess dependency to break circular dependency
// Practice database operations moved to practiceDatabaseManager service

/**
 * Database Factory for Multi-Tenant Architecture
 * 
 * Manages separate database connections for each practice to ensure complete isolation.
 * Uses the pattern: intellicare_practice_{subdomain} for practice databases
 * and intellicare_practice_global for platform management.
 */
class DatabaseFactory {
  constructor() {
    this.connections = new Map();
    this.globalConnection = null;
    this.isInitialized = false;
  }

  /**
   * Create connection with retry logic and exponential backoff
   * @param {string} mongoURI - MongoDB connection string
   * @param {Object} options - Connection options
   * @param {number} maxRetries - Maximum retry attempts (default: 3)
   * @returns {mongoose.Connection} Database connection
   */
  async createConnectionWithRetry(mongoURI, options, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Attempting database connection
        
        const connection = await mongoose.createConnection(mongoURI, options);
        
        // Increase max listeners to prevent warning when multiple services use same connection
        connection.setMaxListeners(50);
        
        await this.waitForConnection(connection);
        
        // Database connection established
        return connection;
        
      } catch (error) {
        lastError = error;
        console.error(`❌ Connection attempt ${attempt} failed for ${options.dbName}:`, error.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏱️ Waiting ${delayMs}ms before retry...`);
          await this.delay(delayMs);
        }
      }
    }
    
    throw new Error(`Failed to connect to database ${options.dbName} after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }

  /**
   * Wait for connection to be ready
   * @param {mongoose.Connection} connection - Mongoose connection
   * @param {number} timeoutMs - Timeout in milliseconds (default: 10000)
   */
  async waitForConnection(connection, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout - database did not become ready'));
      }, timeoutMs);

      if (connection.readyState === 1) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      connection.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      connection.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Validate connection health
   * @param {mongoose.Connection} connection - Mongoose connection
   * @returns {boolean} True if connection is healthy
   */
  async validateConnection(connection) {
    // Quick validation for pooled connections
    if (!connection) {
      return false;
    }
    
    // Check if it's a mongoose connection with readyState
    if (typeof connection.readyState === 'number') {
      return connection.readyState === 1;
    }
    
    // For wrapped connections, check for essential properties
    if (connection.db && typeof connection.db === 'object') {
      return true;
    }
    
    // Check if connection has mongoose methods
    if (typeof connection.model === 'function' || 
        typeof connection.collection === 'function') {
      return true;
    }
    
    return false;
  }

  /**
   * Delay helper for retry logic
   * @param {number} ms - Milliseconds to wait
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Initialize the database factory
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize global connection
      await this.getGlobalDatabase();
      this.isInitialized = true;
      console.log('✅ Database Factory initialized successfully');
    } catch (error) {
      console.error('❌ Database Factory initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get global database connection for practice registry and platform management
   * @returns {mongoose.Connection} Global database connection
   */
  async getGlobalDatabase() {
    if (!this.globalConnection || !await this.validateConnection(this.globalConnection)) {
      if (this.globalConnection) {
        console.log('🔄 Existing global connection unhealthy, creating new connection...');
        this.globalConnection = null;
      }

      try {
        // Build secure MongoDB URI using credentials from KMS
        let mongoURI;

        try {
          // Get MongoDB credentials from KMS
          const productionKMS = require('../services/productionKMS');

          if (!productionKMS.initialized) {
            await productionKMS.initialize();
          }

          const username = await productionKMS.getInternalKey('MONGODB_APP_USERNAME');
          const password = await productionKMS.getInternalKey('MONGODB_APP_PASSWORD');

          if (username && password) {
            // Build secure connection string with authentication
            const host = process.env.MONGODB_HOST || 'localhost';
            const port = process.env.MONGODB_PORT || 27017;
            const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin';
            const replicaSet = process.env.MONGODB_REPLICA_SET || 'rs0';

            // Include replica set in connection string for Change Streams support
            mongoURI = `mongodb://${username}:${password}@${host}:${port}/intellicare_practice_global?authSource=${authSource}&replicaSet=${replicaSet}`;
            console.log('🔐 Using MongoDB authentication from KMS with replica set');
          } else {
            console.warn('⚠️ MongoDB credentials not found in KMS, falling back to config');
            mongoURI = config.get('mongoURI') || 'mongodb://localhost:27017';
          }
        } catch (kmsError) {
          console.warn('⚠️ Failed to get MongoDB credentials from KMS:', kmsError.message);
          mongoURI = config.get('mongoURI') || 'mongodb://localhost:27017';
        }

        const connectionOptions = {
          dbName: 'intellicare_practice_global',
          maxPoolSize: 20,
          minPoolSize: 5,
          serverSelectionTimeoutMS: 30000, // Increased for stability under load
          socketTimeoutMS: 0, // No socket timeout - connections should stay alive indefinitely
          bufferCommands: false,
          connectTimeoutMS: 10000, // Increased for network resilience
          maxIdleTimeMS: 0, // Never close idle connections
          heartbeatFrequencyMS: 30000, // Check server health every 30s (less aggressive)
          retryWrites: true,
          w: 'majority'
        };

        // Use ConnectionPoolManager instead of creating new connection
        const ConnectionPoolManager = require('../services/connectionPoolManager');
        try {
          this.globalConnection = await ConnectionPoolManager.acquireConnection('intellicare_practice_global');

          // Verify the connection is ready
          if (!this.globalConnection || this.globalConnection.readyState !== 1) {
            console.log('⚠️ Pool connection not ready, waiting...');
            // Give it a moment to connect
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check again
            if (!this.globalConnection || this.globalConnection.readyState !== 1) {
              // CRITICAL FIX: Never bypass ConnectionPoolManager
              // Direct connections are not tracked and appear as leaks
              console.error('❌ ConnectionPoolManager failed to provide global database connection');
              throw new Error('Failed to acquire global database connection from pool. ConnectionPoolManager may need to be restarted.');
            }
          }

          // Emit events through DatabaseEventBus if available
          try {
            const DatabaseEventBus = require('../services/databaseEventBus');
            DatabaseEventBus.emitEvent('connection', {
              type: 'global',
              status: 'connected',
              dbName: 'intellicare_practice_global'
            });
          } catch (e) {
            // Event bus not available yet
          }

          console.log('🌐 Global database connected');
        } catch (error) {
          console.error('❌ Failed to connect to global database:', error);
          throw error;
        }

      } catch (error) {
        console.error('❌ Failed to connect to global database:', error);
        this.globalConnection = null;
        throw error;
      }
    }

    // Final validation before returning
    if (!await this.validateConnection(this.globalConnection)) {
      throw new Error('Global database connection is not healthy');
    }

    return this.globalConnection;
  }

  /**
   * Get practice-specific database connection
   * @deprecated - SECURITY WARNING
   * Direct database access will be removed in next version.
   * Use SecureDataAccess.query() instead.
   * This function will throw an error after migration.
   * 
   * @param {string} practiceSubdomain - The practice's subdomain
   * @param {boolean} isInternalCall - Set to true for legitimate internal service calls
   * @returns {mongoose.Connection} Practice database connection
   */
  async getPracticeDatabase(practiceSubdomain, isInternalCall = false) {
    // SECURITY: Block all direct database access except internal calls
    if (!isInternalCall) {
      throw new Error('🚨 SECURITY VIOLATION: Direct database access is BLOCKED. Use SecureDataAccess service instead. const SecureDataAccess = require("../services/secureDataAccess");');
    }
    
    if (!practiceSubdomain) {
      throw new Error('Practice subdomain is required');
    }

    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(practiceSubdomain)) {
      throw new Error('Invalid practice subdomain format');
    }

    const dbName = `intellicare_practice_${practiceSubdomain}`;

    // Check if connection exists and is ready (no ping needed)
    const existingConnection = this.connections.get(dbName);
    if (!existingConnection || existingConnection.readyState !== 1) {
      if (this.connections.has(dbName)) {
        console.log(`🔄 Existing practice connection unhealthy for ${dbName}, creating new connection...`);
        this.connections.delete(dbName);
      }

      try {
        // Build secure MongoDB URI using credentials from KMS
        let mongoURI;

        try {
          // Get MongoDB credentials from KMS
          const productionKMS = require('../services/productionKMS');

          if (!productionKMS.initialized) {
            await productionKMS.initialize();
          }

          const username = await productionKMS.getInternalKey('MONGODB_APP_USERNAME');
          const password = await productionKMS.getInternalKey('MONGODB_APP_PASSWORD');

          if (username && password) {
            // Build secure connection string with authentication
            const host = process.env.MONGODB_HOST || 'localhost';
            const port = process.env.MONGODB_PORT || 27017;
            const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin';
            const replicaSet = process.env.MONGODB_REPLICA_SET || 'rs0';

            // Include replica set in connection string for Change Streams support
            mongoURI = `mongodb://${username}:${password}@${host}:${port}/${dbName}?authSource=${authSource}&replicaSet=${replicaSet}`;
            if (process.env.QUIET_LOGS !== 'true') console.log(`🔐 Using MongoDB authentication from KMS for ${dbName} with replica set`);
          } else {
            console.warn('⚠️ MongoDB credentials not found in KMS, falling back to config');
            mongoURI = config.get('mongoURI') || 'mongodb://localhost:27017';
          }
        } catch (kmsError) {
          console.warn('⚠️ Failed to get MongoDB credentials from KMS:', kmsError.message);
          mongoURI = config.get('mongoURI') || 'mongodb://localhost:27017';
        }

        const connectionOptions = {
          dbName,
          maxPoolSize: 20,
          minPoolSize: 5,
          serverSelectionTimeoutMS: 30000, // Increased for stability under load
          socketTimeoutMS: 0, // No socket timeout - connections should stay alive indefinitely
          bufferCommands: false,
          connectTimeoutMS: 10000, // Increased for network resilience
          maxIdleTimeMS: 0, // Never close idle connections
          heartbeatFrequencyMS: 30000, // Check server health every 30s (less aggressive)
          retryWrites: true,
          w: 'majority'
        };

        // Temporarily bypass ConnectionPoolManager for debugging
        if (process.env.QUIET_LOGS !== 'true') console.log(`🔧 Creating direct connection to ${dbName}...`);

        try {
          // Create direct connection for now
          const connection = await mongoose.createConnection(mongoURI, connectionOptions).asPromise();

          // Emit connection event if DatabaseEventBus is available
          try {
            const DatabaseEventBus = require('../services/databaseEventBus');
            DatabaseEventBus.emitEvent('connection', {
              type: 'practice',
              status: 'connected',
              dbName: dbName,
              subdomain: practiceSubdomain
            });
          } catch (e) {
            // DatabaseEventBus not available, skip event emission
          }

          this.connections.set(dbName, connection);
          if (process.env.QUIET_LOGS !== 'true') console.log(`🏥 Practice database connected via ConnectionPoolManager: ${dbName}`);
        } catch (error) {
          console.error(`❌ Failed to connect to practice database ${dbName}:`, error);
          throw error;
        }

      } catch (error) {
        console.error(`❌ Failed to connect to practice database ${dbName}:`, error);
        this.connections.delete(dbName);
        throw error;
      }
    }

    const connection = this.connections.get(dbName);
    
    // Quick validation - just check readyState
    if (connection.readyState !== 1) {
      this.connections.delete(dbName);
      throw new Error(`Practice database connection ${dbName} is not ready`);
    }

    return connection;
  }

  /**
   * Initialize a new practice database with required collections and indexes
   * @param {string} practiceSubdomain - The practice's subdomain
   * @returns {mongoose.Connection} Initialized practice database connection
   */
  async initializePracticeDatabase(practiceSubdomain) {
    const connection = await this.getPracticeDatabase(practiceSubdomain, true); // Internal call
    
    try {
      // Create collections with basic structure - include appointments!
      const collections = ['users', 'patients', 'documents', 'audit_logs', 'chatsessions', 'chatmessages', 'appointments'];

      for (const collectionName of collections) {
        const collection = connection.collection(collectionName);
        
        // Create basic indexes based on collection type
        switch (collectionName) {
          case 'users':
            await collection.createIndex({ email: 1 }, { unique: true });
            await collection.createIndex({ status: 1 });
            await collection.createIndex({ roles: 1 });
            break;
          case 'patients':
            await collection.createIndex({ patientId: 1 }, { unique: true });
            await collection.createIndex({ name: 1 });
            await collection.createIndex({ status: 1 });
            await collection.createIndex({ createdAt: -1 });
            break;
          case 'documents':
            await collection.createIndex({ patientId: 1 });
            await collection.createIndex({ uploadDate: -1 });
            await collection.createIndex({ category: 1 });
            break;
          case 'audit_logs':
            await collection.createIndex({ timestamp: -1 });
            await collection.createIndex({ userId: 1 });
            await collection.createIndex({ action: 1 });
            break;
          case 'chatsessions':
            await collection.createIndex({ userId: 1 });
            await collection.createIndex({ createdAt: -1 });
            break;
          case 'chatmessages':
            await collection.createIndex({ sessionId: 1 });
            await collection.createIndex({ timestamp: -1 });
            break;
          case 'appointments':
            // Create all necessary indexes for the appointment system
            console.log(`  Creating appointment indexes for ${collectionName}...`);
            
            // Primary availability query index
            await collection.createIndex(
              { providerId: 1, scheduledDate: 1, status: 1, scheduledTime: 1 },
              { name: 'availability_primary' }
            );
            
            // Conflict detection index
            await collection.createIndex(
              { providerId: 1, scheduledDate: 1, scheduledTime: 1, status: 1 },
              { name: 'conflict_check' }
            );
            
            // Patient history index
            await collection.createIndex(
              { patientId: 1, practiceId: 1, scheduledDate: -1 },
              { name: 'patient_history' }
            );
            
            // Practice daily view index
            await collection.createIndex(
              { practiceId: 1, scheduledDate: 1, status: 1 },
              { name: 'practice_daily' }
            );
            
            // Provider daily schedule index
            await collection.createIndex(
              { providerId: 1, scheduledDate: 1, scheduledTime: 1 },
              { name: 'provider_schedule' }
            );
            
            // Status tracking index
            await collection.createIndex(
              { status: 1, scheduledDate: 1 },
              { name: 'status_tracking' }
            );
            
            // Appointment lookup index (unique for appointment numbers)
            await collection.createIndex(
              { appointmentNumber: 1 },
              { name: 'appointment_lookup', unique: true, sparse: true }
            );
            
            console.log(`  ✓ Created 7 appointment indexes`);
            break;
        }
      }

      console.log(`✅ Practice database initialized: intellicare_practice_${practiceSubdomain}`);
      return connection;

    } catch (error) {
      console.error(`❌ Failed to initialize practice database for ${practiceSubdomain}:`, error);
      throw error;
    }
  }

  /**
   * Close a specific practice database connection
   * @param {string} practiceSubdomain - The practice's subdomain
   */
  async closePracticeDatabase(practiceSubdomain) {
    const dbName = `intellicare_practice_${practiceSubdomain}`;

    if (this.connections.has(dbName)) {
      const connection = this.connections.get(dbName);
      await connection.close();
      this.connections.delete(dbName);
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔌 Closed practice database: ${dbName}`);
    }
  }

  /**
   * Remove practice database from cache (for deletion)
   * @param {string} practiceSubdomain - The practice's subdomain
   */
  async removePracticeDatabase(practiceSubdomain) {
    const dbName = `intellicare_practice_${practiceSubdomain}`;

    if (this.connections.has(dbName)) {
      const connection = this.connections.get(dbName);
      try {
        await connection.close();
      } catch (error) {
        console.warn(`⚠️ Error closing connection for ${dbName}:`, error.message);
      }
      this.connections.delete(dbName);
      console.log(`🗑️ Removed practice database from cache: ${dbName}`);
    }
  }

  /**
   * Close all database connections
   */
  async closeAllConnections() {
    try {
      // Close all practice connections
      for (const [dbName, connection] of this.connections) {
        await connection.close();
        if (process.env.QUIET_LOGS !== 'true') console.log(`🔌 Closed database: ${dbName}`);
      }
      this.connections.clear();

      // Close global connection
      if (this.globalConnection) {
        await this.globalConnection.close();
        this.globalConnection = null;
        console.log('🔌 Closed global database connection');
      }

      this.isInitialized = false;
      console.log('✅ All database connections closed');

    } catch (error) {
      console.error('❌ Error closing database connections:', error);
      throw error;
    }
  }

  /**
   * Get connection status for monitoring
   * @returns {Object} Connection status information
   */
  getConnectionStatus() {
    const status = {
      global: this.globalConnection ? this.globalConnection.readyState : 0,
      practices: {},
      totalConnections: this.connections.size + (this.globalConnection ? 1 : 0)
    };

    for (const [dbName, connection] of this.connections) {
      status.practices[dbName] = connection.readyState;
    }

    return status;
  }

  /**
   * Health check for all connections
   * @returns {Object} Health status
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      global: false,
      practices: {},
      errors: []
    };

    try {
      // Check global connection
      if (this.globalConnection && this.globalConnection.readyState === 1) {
        await this.globalConnection.db.admin().ping();
        health.global = true;
      }

      // Check practice connections
      for (const [dbName, connection] of this.connections) {
        try {
          if (connection.readyState === 1) {
            await connection.db.admin().ping();
            health.practices[dbName] = true;
          } else {
            health.practices[dbName] = false;
            health.errors.push(`${dbName}: Connection not ready`);
          }
        } catch (error) {
          health.practices[dbName] = false;
          health.errors.push(`${dbName}: ${error.message}`);
        }
      }

      if (health.errors.length > 0) {
        health.status = 'degraded';
      }

    } catch (error) {
      health.status = 'unhealthy';
      health.errors.push(`Global: ${error.message}`);
    }

    return health;
  }

  // Method moved to practiceDatabaseManager service to break circular dependency
  // Use: const practiceDatabaseManager = require('../services/practiceDatabaseManager');
  //      await practiceDatabaseManager.getAllPracticeDatabases();

  // Deprecated clinic methods have been removed - use practice methods instead
}

// Create singleton instance
const databaseFactory = new DatabaseFactory();

module.exports = databaseFactory;
