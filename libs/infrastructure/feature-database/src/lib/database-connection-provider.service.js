/**
 * Database Connection Provider - Modular Version
 * Manages database connections with service tracking and connection pooling
 */

// Add this service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class DatabaseConnectionProvider {
  constructor() {
    if (DatabaseConnectionProvider.instance) {
      return DatabaseConnectionProvider.instance;
    }

    this.serviceToken = null;
    this.initialized = false;
    this.databaseConnections = new Map(); // dbName -> connection
    this.serviceTracking = new Map(); // serviceName -> Set of dbNames
    this.connectionMetadata = new Map(); // connection -> metadata

    DatabaseConnectionProvider.instance = this;
  }

  static getInstance() {
    if (!DatabaseConnectionProvider.instance) {
      DatabaseConnectionProvider.instance = new DatabaseConnectionProvider();
    }
    return DatabaseConnectionProvider.instance;
  }

  async initialize() {
    if (this.initialized) return this;

    try {
      // Get services through proxy to avoid circular dependencies
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      this.serviceToken = await serviceAccountManager.authenticate('database-connection-provider-service');
      this.initialized = true;
      console.log('✅ Database Connection Provider initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Database Connection Provider:', error);
      throw error;
    }

    return this;
  }

  async getConnection(serviceName, dbName, actualCallingService = null) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Track the real calling service, not just SecureDataAccess
    const trackingService = actualCallingService || serviceName;
    
    // Check if we already have a connection for this database
    if (this.databaseConnections.has(dbName)) {
      const existingConn = this.databaseConnections.get(dbName);
      
      // Verify connection is still healthy
      if (existingConn && existingConn.readyState === 1) {
        // Track which service is using this database
        if (!this.serviceTracking.has(trackingService)) {
          this.serviceTracking.set(trackingService, new Set());
        }
        this.serviceTracking.get(trackingService).add(dbName);
        
        // Update metadata
        const metadata = this.connectionMetadata.get(existingConn) || {};
        metadata.lastUsed = Date.now();
        metadata.usageCount = (metadata.usageCount || 0) + 1;
        metadata.usedBy = metadata.usedBy || new Set();
        metadata.usedBy.add(trackingService);
        this.connectionMetadata.set(existingConn, metadata);
        
        return existingConn; // REUSE existing connection
      } else {
        // Remove stale connection
        this.databaseConnections.delete(dbName);
      }
    }

    // Get ConnectionPoolManager through proxy to avoid circular dependencies
    let connectionSource;
    try {
      const proxy = getServiceProxy();
      connectionSource = proxy.getService('connectionPoolManager');
    } catch (e) {
      // Fallback to databaseFactory if ConnectionPoolManager not ready
      const proxy = getServiceProxy();
      const databaseFactory = proxy.getService('databaseFactory');
      return await databaseFactory.getClinicDatabase(dbName.replace('intellicare_practice_', ''), true);
    }

    // Get NEW connection from pool
    const conn = await connectionSource.acquireConnection(dbName);
    
    // Store connection for reuse
    this.databaseConnections.set(dbName, conn);
    
    // Track which service is using this database
    if (!this.serviceTracking.has(trackingService)) {
      this.serviceTracking.set(trackingService, new Set());
    }
    this.serviceTracking.get(trackingService).add(dbName);
    
    // Store metadata
    this.connectionMetadata.set(conn, {
      dbName,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
      usedBy: new Set([trackingService])
    });

    // NO auto-release - let connections persist for reuse
    // ConnectionPoolManager will handle cleanup of truly idle connections
    
    return conn;
  }

  releaseConnection(serviceName, connection) {
    // Update tracking
    const metadata = this.connectionMetadata.get(connection);
    if (metadata && metadata.usedBy) {
      metadata.usedBy.delete(serviceName);
      
      // If no services are using this connection, consider releasing it
      if (metadata.usedBy.size === 0) {
        // Mark as idle but don't immediately release
        metadata.idle = true;
        metadata.idleSince = Date.now();
      }
    }
  }

  getConnectionStats() {
    const stats = {
      totalConnections: this.databaseConnections.size,
      serviceTracking: {},
      connectionMetadata: []
    };

    // Convert service tracking to plain object
    for (const [service, dbNames] of this.serviceTracking) {
      stats.serviceTracking[service] = Array.from(dbNames);
    }

    // Convert connection metadata
    for (const [conn, metadata] of this.connectionMetadata) {
      stats.connectionMetadata.push({
        dbName: metadata.dbName,
        createdAt: metadata.createdAt,
        lastUsed: metadata.lastUsed,
        usageCount: metadata.usageCount,
        usedBy: Array.from(metadata.usedBy || []),
        idle: metadata.idle || false
      });
    }

    return stats;
  }

  async cleanupIdleConnections(maxIdleTime = 300000) { // 5 minutes
    const now = Date.now();
    const connectionsToRemove = [];

    for (const [conn, metadata] of this.connectionMetadata) {
      if (metadata.idle && metadata.idleSince && (now - metadata.idleSince) > maxIdleTime) {
        connectionsToRemove.push({ conn, metadata });
      }
    }

    for (const { conn, metadata } of connectionsToRemove) {
      try {
        if (conn && typeof conn.close === 'function') {
          await conn.close();
        }
        
        // Remove from tracking
        this.connectionMetadata.delete(conn);
        this.databaseConnections.delete(metadata.dbName);
        
        console.log(`🔄 Cleaned up idle connection for ${metadata.dbName}`);
      } catch (error) {
        console.error(`❌ Error cleaning up connection for ${metadata.dbName}:`, error);
      }
    }

    return connectionsToRemove.length;
  }

  // Start periodic cleanup
  startCleanupTimer(intervalMs = 600000) { // 10 minutes
    setInterval(async () => {
      await this.cleanupIdleConnections();
    }, intervalMs);
  }
}

// Register with service proxy manager
const databaseConnectionProvider = new DatabaseConnectionProvider();

if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('databaseConnectionProvider', () => {
    return databaseConnectionProvider;
  });
}

module.exports = DatabaseConnectionProvider;