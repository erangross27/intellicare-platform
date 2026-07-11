class BaseService {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.initialized = false;
    this.connections = new Map();

    // Auto-register with ServiceRegistry
    try {
      const ServiceRegistry = require('./serviceRegistry');
      ServiceRegistry.register(this.serviceName, this);
    } catch (e) {
      console.log(`ServiceRegistry not available for ${serviceName}`);
    }
  }

  async initialize() {
    if (this.initialized) return true;

    console.log(`🚀 Initializing ${this.serviceName}...`);

    try {
      // Pre-acquire global connection to ensure it's ready
      try {
        await this.getConnection('intellicare_practice_global');
      } catch (e) {
        // Not all services need global connection
        console.log(`ℹ️ ${this.serviceName} - global connection not required`);
      }

      // Override in subclass for specific initialization
      if (this.onInitialize) {
        await this.onInitialize();
      }

      this.initialized = true;
      console.log(`✅ ${this.serviceName} initialized`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to initialize ${this.serviceName}:`, error.message);
      throw error;
    }
  }

  async destroy() {
    if (process.env.QUIET_LOGS !== 'true') console.log(`🔌 Destroying ${this.serviceName}...`);

    // Release all connections
    await this.releaseAllConnections();

    // Override in subclass for cleanup
    if (this.onDestroy) {
      await this.onDestroy();
    }

    this.initialized = false;
    console.log(`✅ ${this.serviceName} destroyed`);
  }

  async getConnection(dbName) {
    // Check cache first
    if (this.connections.has(dbName)) {
      const conn = this.connections.get(dbName);
      if (conn && conn.readyState === 1) {
        return conn;
      }
      // Remove stale cached connection
      this.connections.delete(dbName);
    }

    try {
      const ServiceRegistry = require('./serviceRegistry');
      const connection = await ServiceRegistry.provideConnection(this.serviceName, dbName);
      
      if (connection && connection.readyState === 1) {
        this.connections.set(dbName, connection);
        return connection;
      } else {
        throw new Error(`Connection not ready for ${dbName}`);
      }

    } catch (error) {
      console.error(`❌ ${this.serviceName} failed to get connection for ${dbName}:`, error.message);
      
      // Last resort fallback - try direct pool
      try {
        const ConnectionPoolManager = require('./connectionPoolManager');
        const connection = await ConnectionPoolManager.acquireConnection(dbName);
        if (connection && connection.readyState === 1) {
          this.connections.set(dbName, connection);
          return connection;
        }
      } catch (poolError) {
        console.error(`❌ Fallback pool connection also failed:`, poolError.message);
      }
      
      throw error;
    }
  }

  async releaseConnection(connection) {
    try {
      const ServiceRegistry = require('./serviceRegistry');
      await ServiceRegistry.releaseConnection(this.serviceName, connection);
    } catch (e) {
      // Try direct release
      try {
        const ConnectionPoolManager = require('./connectionPoolManager');
        ConnectionPoolManager.releaseConnection(connection);
      } catch (poolError) {
        // Best effort
      }
    }
  }

  async releaseAllConnections() {
    for (const [dbName, connection] of this.connections.entries()) {
      await this.releaseConnection(connection);
    }
    this.connections.clear();
  }

  async healthCheck() {
    const health = {
      service: this.serviceName,
      initialized: this.initialized,
      connections: this.connections.size,
      status: 'healthy'
    };

    // Override in subclass for specific health checks
    if (this.onHealthCheck) {
      const customHealth = await this.onHealthCheck();
      Object.assign(health, customHealth);
    }

    return health;
  }
}

module.exports = BaseService;