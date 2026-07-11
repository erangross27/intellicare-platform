class ServiceRegistry {
  constructor() {
    if (ServiceRegistry.instance) {
      return ServiceRegistry.instance;
    }

    this.services = new Map();
    this.connections = new Map(); // Track connections per service
    this.clinicDatabaseCache = null;
    this.cacheTimestamp = 0;
    this.CACHE_TTL = 60000; // 60 seconds

    ServiceRegistry.instance = this;
  }

  static getInstance() {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register(serviceName, serviceInstance) {
    this.services.set(serviceName, {
      instance: serviceInstance,
      registered: Date.now(),
      status: 'active'
    });
    if (process.env.QUIET_LOGS !== 'true') console.log(`✅ Registered service: ${serviceName}`);
  }

  get(serviceName) {
    const service = this.services.get(serviceName);
    return service ? service.instance : null;
  }

  // CRITICAL: Cached version of getAllClinicDatabases for Agent 3
  async getCachedClinicDatabases() {
    const clinicDatabaseManager = require('./clinicDatabaseManager');

    if (Date.now() - this.cacheTimestamp > this.CACHE_TTL || !this.clinicDatabaseCache) {
      console.log('🔄 Refreshing practice database cache...');
      this.clinicDatabaseCache = await clinicDatabaseManager.getAllClinicDatabases();
      this.cacheTimestamp = Date.now();
    }

    return this.clinicDatabaseCache;
  }

  listServices() {
    return Array.from(this.services.entries()).map(([name, data]) => ({
      name,
      status: data.status,
      registered: data.registered
    }));
  }

  async shutdownAll() {
    console.log('🔌 Shutting down all services...');
    for (const [name, data] of this.services.entries()) {
      if (data.instance && typeof data.instance.destroy === 'function') {
        await data.instance.destroy();
      }
    }
    this.services.clear();
    this.connections.clear();
  }

  async provideConnection(serviceName, dbName) {
    // Track connections per service
    if (!this.connections.has(serviceName)) {
      this.connections.set(serviceName, new Set());
    }

    try {
      // Try to use DatabaseConnectionProvider if available
      const DatabaseConnectionProvider = require('./databaseConnectionProvider');
      return await DatabaseConnectionProvider.getConnection(serviceName, dbName);
    } catch (e) {
      // Fallback to direct pool
      try {
        const ConnectionPoolManager = require('./connectionPoolManager');
        const conn = await ConnectionPoolManager.acquireConnection(dbName);
        this.connections.get(serviceName).add(conn);
        return conn;
      } catch (poolError) {
        console.error(`❌ Failed to get connection for ${serviceName}:`, poolError.message);
        throw poolError;
      }
    }
  }

  async releaseConnection(serviceName, connection) {
    try {
      const ConnectionPoolManager = require('./connectionPoolManager');
      ConnectionPoolManager.releaseConnection(connection);
      
      if (this.connections.has(serviceName)) {
        this.connections.get(serviceName).delete(connection);
      }
    } catch (e) {
      console.error(`Error releasing connection for ${serviceName}:`, e.message);
    }
  }
}

module.exports = ServiceRegistry.getInstance();