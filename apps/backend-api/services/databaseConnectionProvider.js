class DatabaseConnectionProvider {
  constructor() {
    if (DatabaseConnectionProvider.instance) {
      return DatabaseConnectionProvider.instance;
    }

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

  async getConnection(serviceName, dbName, actualCallingService = null) {
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

    // Get ConnectionPoolManager
    let connectionSource;
    try {
      connectionSource = require('./connectionPoolManager');
    } catch (e) {
      // Fallback to databaseFactory if ConnectionPoolManager not ready
      const databaseFactory = require('../utils/databaseFactory');
      // Extract subdomain - handle both single and double prefixes
      let subdomain = dbName;
      while (subdomain.startsWith('intellicare_practice_')) {
        subdomain = subdomain.replace('intellicare_practice_', '');
      }
      return await databaseFactory.getPracticeDatabase(subdomain, true);
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

    // Don't immediately release to pool - let ConnectionPoolManager handle lifecycle
  }

  getServiceConnections(serviceName) {
    return this.serviceTracking.get(serviceName) || new Set();
  }

  getStatus() {
    const status = {
      totalConnections: this.databaseConnections.size,
      connectionsByDatabase: {},
      serviceUsage: {}
    };

    // Group connections by database
    for (const [dbName, conn] of this.databaseConnections.entries()) {
      const metadata = this.connectionMetadata.get(conn) || {};
      status.connectionsByDatabase[dbName] = {
        readyState: conn.readyState,
        usageCount: metadata.usageCount || 0,
        usedBy: metadata.usedBy ? Array.from(metadata.usedBy) : [],
        idle: metadata.idle || false
      };
    }

    // Group by service
    for (const [service, dbs] of this.serviceTracking.entries()) {
      status.serviceUsage[service] = Array.from(dbs);
    }

    return status;
  }

  // Cleanup idle connections (called periodically by ConnectionPoolManager)
  async cleanupIdleConnections(maxIdleTime = 5 * 60 * 1000) { // 5 minutes
    const now = Date.now();
    const toRemove = [];

    for (const [dbName, conn] of this.databaseConnections.entries()) {
      const metadata = this.connectionMetadata.get(conn);
      
      if (metadata && metadata.idle && (now - metadata.idleSince > maxIdleTime)) {
        toRemove.push(dbName);
      }
    }

    for (const dbName of toRemove) {
      const conn = this.databaseConnections.get(dbName);
      this.databaseConnections.delete(dbName);
      this.connectionMetadata.delete(conn);
      
      // Release back to pool
      try {
        const pool = require('./connectionPoolManager');
        pool.releaseConnection(conn);
      } catch (e) {
        // Pool not available
      }
    }

    if (toRemove.length > 0) {
      console.log(`🧹 Cleaned up ${toRemove.length} idle database connections`);
    }
  }
}

module.exports = DatabaseConnectionProvider.getInstance();