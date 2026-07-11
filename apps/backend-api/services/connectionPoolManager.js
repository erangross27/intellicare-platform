const mongoose = require('mongoose');
const secureConfigService = require('./secureConfigService');

class ConnectionPoolManager {
  constructor() {
    if (ConnectionPoolManager.instance) {
      return ConnectionPoolManager.instance;
    }

    this.pool = new Map(); // dbName -> connection
    this.connectionMetadata = new Map(); // connection -> metadata
    this.maxConnections = 50;
    this.minConnections = 5;

    ConnectionPoolManager.instance = this;
    
    // Start maintenance schedule
    this.startMaintenanceSchedule();
  }

  static getInstance() {
    if (!ConnectionPoolManager.instance) {
      ConnectionPoolManager.instance = new ConnectionPoolManager();
    }
    return ConnectionPoolManager.instance;
  }

  async acquireConnection(dbName) {
    // Check if connection exists and is healthy
    if (this.pool.has(dbName)) {
      const conn = this.pool.get(dbName);
      if (conn && conn.readyState === 1) {
        this.updateMetadata(conn, 'lastUsed', Date.now());
        this.updateMetadata(conn, 'usageCount', (this.getMetadata(conn, 'usageCount') || 0) + 1);
        return conn;
      } else {
        // Remove unhealthy connection
        console.log(`🔄 Removing unhealthy connection for ${dbName}`);
        this.pool.delete(dbName);
        if (conn) {
          this.connectionMetadata.delete(conn);
        }
      }
    }

    // Create new connection if under limit
    if (this.pool.size < this.maxConnections) {
      const conn = await this.createConnection(dbName);
      this.pool.set(dbName, conn);
      return conn;
    }

    // Try to free up a connection
    await this.cleanupStale();
    if (this.pool.size < this.maxConnections) {
      const conn = await this.createConnection(dbName);
      this.pool.set(dbName, conn);
      return conn;
    }

    throw new Error(`Connection pool exhausted (${this.pool.size}/${this.maxConnections})`);
  }

  async createConnection(dbName) {
    // Build secure MongoDB URI using credentials from KMS
    let mongoURI;

    try {
      // Get MongoDB credentials from KMS
      const productionKMS = require('./productionKMS');

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

        mongoURI = `mongodb://${username}:${password}@${host}:${port}/${dbName}?authSource=${authSource}&replicaSet=${replicaSet}`;
        if (process.env.QUIET_LOGS !== 'true') console.log(`🔐 ConnectionPoolManager: Using MongoDB auth from KMS for ${dbName}`);
      } else {
        console.warn('⚠️ MongoDB credentials not found in KMS, falling back to config');
        mongoURI = secureConfigService.get('MONGODB_URI', 'mongodb://localhost:27017');
      }
    } catch (kmsError) {
      console.warn('⚠️ Failed to get MongoDB credentials from KMS:', kmsError.message);
      mongoURI = secureConfigService.get('MONGODB_URI', 'mongodb://localhost:27017');
    }

    try {
      const conn = await mongoose.createConnection(mongoURI, {
        dbName,
        maxPoolSize: 20,
        minPoolSize: 5,
        socketTimeoutMS: 0,  // No socket timeout - connections should stay alive
        serverSelectionTimeoutMS: 30000, // Increased for stability under load
        bufferCommands: false,
        heartbeatFrequencyMS: 30000,  // Send heartbeat every 30 seconds (less aggressive)
        maxIdleTimeMS: 0,  // Never close idle connections
        connectTimeoutMS: 10000, // Increased for network resilience
        retryWrites: true,
        w: 'majority'
      });

      // Wait for connection to be ready
      if (conn.readyState !== 1) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Connection timeout for ${dbName}`));
          }, 5000);

          conn.once('connected', () => {
            clearTimeout(timeout);
            resolve();
          });

          conn.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });

          // If already connecting, wait a bit
          if (conn.readyState === 2) { // connecting
            setTimeout(() => {
              if (conn.readyState === 1) {
                clearTimeout(timeout);
                resolve();
              }
            }, 100);
          }
        });
      }

      // IMPORTANT: Set max listeners higher for multi-practice operations
      conn.setMaxListeners(100);

      // Store metadata
      this.connectionMetadata.set(conn, {
        dbName,
        created: Date.now(),
        lastUsed: Date.now(),
        usageCount: 0
      });

      if (process.env.QUIET_LOGS !== 'true') console.log(`✅ Created pooled connection for ${dbName} (readyState: ${conn.readyState})`);
      return conn;
      
    } catch (error) {
      console.error(`❌ Failed to create connection for ${dbName}:`, error.message);
      throw error;
    }
  }

  releaseConnection(connection) {
    // Just update metadata, keep connection in pool
    this.updateMetadata(connection, 'lastUsed', Date.now());
  }

  updateMetadata(conn, key, value) {
    const metadata = this.connectionMetadata.get(conn) || {};
    metadata[key] = value;
    this.connectionMetadata.set(conn, metadata);
  }

  getMetadata(conn, key) {
    const metadata = this.connectionMetadata.get(conn) || {};
    return metadata[key];
  }

  getStatus() {
    return {
      poolSize: this.pool.size,
      maxConnections: this.maxConnections,
      connections: Array.from(this.pool.entries()).map(([db, conn]) => ({
        database: db,
        state: conn.readyState,
        metadata: this.connectionMetadata.get(conn)
      }))
    };
  }

  // Clean up stale connections (idle > 5 minutes)
  async cleanupStale() {
    const now = Date.now();
    const staleTimeout = 5 * 60 * 1000; // 5 minutes

    for (const [dbName, conn] of this.pool.entries()) {
      // NEVER clean up the global database connection - it's critical for services
      if (dbName === 'intellicare_practice_global') {
        continue;
      }
      
      const metadata = this.connectionMetadata.get(conn);
      if (metadata && (now - metadata.lastUsed) > staleTimeout) {
        // Only close if connection is truly idle and not global
        if (conn.readyState === 1) {
          if (process.env.QUIET_LOGS !== 'true') console.log(`⚠️ Keeping healthy connection for ${dbName} despite idle time`);
          continue;
        }
        
        await conn.close();
        this.pool.delete(dbName);
        this.connectionMetadata.delete(conn);
        console.log(`Cleaned up stale connection for ${dbName}`);
      }
    }
  }

  startMaintenanceSchedule() {
    // Run cleanup every 5 minutes
    setInterval(async () => {
      await this.cleanupStale();

      // Log pool health
      const status = this.getStatus();
      if (status.poolSize > 20) {
        console.log(`⚠️ Connection pool size high: ${status.poolSize} connections`);
      }
    }, 5 * 60 * 1000);

    // Run deep cleanup every hour
    setInterval(async () => {
      console.log('🧹 Running deep connection pool cleanup...');
      const before = this.pool.size;

      // Close truly idle connections (not used in 30 minutes)
      const now = Date.now();
      const deepIdleTimeout = 30 * 60 * 1000;

      for (const [dbName, conn] of this.pool.entries()) {
        // NEVER clean up the global database connection
        if (dbName === 'intellicare_practice_global') {
          continue;
        }
        
        const metadata = this.connectionMetadata.get(conn);
        if (metadata && (now - metadata.lastUsed) > deepIdleTimeout) {
          await conn.close();
          this.pool.delete(dbName);
          this.connectionMetadata.delete(conn);
        }
      }

      const after = this.pool.size;
      if (before > after) {
        console.log(`✅ Deep cleanup: removed ${before - after} idle connections`);
      }
    }, 60 * 60 * 1000);
  }
}

module.exports = ConnectionPoolManager.getInstance();