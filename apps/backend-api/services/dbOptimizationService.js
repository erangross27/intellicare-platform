const serviceAccountManager = require('./serviceAccountManager');
// Database Query Optimization Service
// Provides connection pooling, caching, and performance monitoring

const mongoose = require('mongoose');
const crypto = require('crypto');
const SecureDataAccess = require('./secureDataAccess');
const { LRUCache } = require('lru-cache');

class DBOptimizationService {
  constructor() {
    // Connection pool settings
    this.poolSettings = {
      minPoolSize: 5,
      maxPoolSize: 20,
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    };
    
    // Query cache configuration
    this.queryCache = new LRUCache({
      max: 1000, // Maximum number of cached queries
      ttl: 1000 * 60 * 5, // 5 minutes TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });
    
    // Read preference settings
    this.readPreferences = {
      primary: 'primary',
      primaryPreferred: 'primaryPreferred',
      secondary: 'secondary',
      secondaryPreferred: 'secondaryPreferred',
      nearest: 'nearest'
    };
    
    // Performance monitoring
    this.queryMetrics = new Map();
    this.slowQueryThreshold = 100; // ms
    this.slowQueries = [];
    this.queryStats = {
      total: 0,
      cached: 0,
      slow: 0,
      failed: 0
    };
    
    // Index recommendations
    this.indexRecommendations = new Map();
    
    // Connection pools by practice
    this.connectionPools = new Map();
    
    // Read/write split connections
    this.readConnections = new Map();
    this.writeConnections = new Map();
  }
  
  /**
   * Create optimized connection with pooling
   */
  async createOptimizedConnection(uri, options = {}) {
    try {
      const poolOptions = {
        ...this.poolSettings,
        ...options,
        // Connection pool optimization
        maxPoolSize: options.maxPoolSize || this.poolSettings.maxPoolSize,
        minPoolSize: options.minPoolSize || this.poolSettings.minPoolSize,
        // Performance options
        compressors: ['zlib'],
        zlibCompressionLevel: 6,
        // Read concern for consistency
        readConcern: { level: 'majority' },
        // Write concern for durability
        writeConcern: {
          w: 'majority',
          j: true,
          wtimeout: 5000
        }
      };
      
      const connection = await mongoose.createConnection(uri, poolOptions).asPromise();
      
      // this.setupConnectionMonitoring(connection);  // REMOVED - causing memory leaks
      
      console.log(`🔗 Optimized connection created with pool size: ${poolOptions.minPoolSize}-${poolOptions.maxPoolSize}`);
      
      return connection;
    } catch (error) {
      console.error('Connection creation error:', error);
      throw error;
    }
  }
  
  
  /**
   * Execute query with caching
   */
  async executeWithCache(model, operation, query, options = {}) {
    // Generate cache key
    const cacheKey = this.generateCacheKey(model.modelName, operation, query, options);
    
    // Check cache first
    if (options.cache !== false) {
      const cached = this.queryCache.get(cacheKey);
      if (cached) {
        this.queryStats.cached++;
        console.log(`💾 Cache hit for ${model.modelName}.${operation}`);
        return cached;
      }
    }
    
    // Execute query
    const startTime = Date.now();
    this.queryStats.total++;
    
    try {
      let result;
      
      // Execute based on operation type
      switch (operation) {
        case 'find':
          result = await model.find(query, null, options);
          break;
        case 'findOne':
          result = await model.findOne(query, null, options);
          break;
        case 'findById':
          result = await model.findById(query, null, options);
          break;
        case 'count':
          result = await model.countDocuments(query);
          break;
        case 'aggregate':
          result = await model.aggregate(query);
          break;
        default:
          result = await model[operation](query, options);
      }
      
      const duration = Date.now() - startTime;
      
      // Track slow queries
      if (duration > this.slowQueryThreshold) {
        this.recordSlowQuery(model.modelName, operation, query, duration);
      }
      
      // Cache the result if cacheable
      if (options.cache !== false && result !== null) {
        this.queryCache.set(cacheKey, result);
      }
      
      // Analyze for index recommendations
      this.analyzeQueryForIndexing(model.modelName, query, duration);
      
      return result;
    } catch (error) {
      this.queryStats.failed++;
      console.error(`Query error on ${model.modelName}.${operation}:`, error);
      throw error;
    }
  }
  
  /**
   * Generate cache key for query
   */
  generateCacheKey(modelName, operation, query, options) {
    const queryString = JSON.stringify({ modelName, operation, query, options });
    return crypto.createHash('md5').update(queryString).digest('hex');
  }
  
  /**
   * Record slow query
   */
  recordSlowQuery(model, operation, query, duration) {
    this.queryStats.slow++;
    
    const slowQuery = {
      model,
      operation,
      query: JSON.stringify(query),
      duration,
      timestamp: new Date()
    };
    
    this.slowQueries.push(slowQuery);
    
    // Keep only last 100 slow queries
    if (this.slowQueries.length > 100) {
      this.slowQueries.shift();
    }
    
    console.warn(`🐌 Slow query detected: ${model}.${operation} took ${duration}ms`);
  }
  
  /**
   * Analyze query for indexing recommendations
   */
  analyzeQueryForIndexing(modelName, query, duration) {
    if (duration < this.slowQueryThreshold) return;
    
    // Extract fields used in query
    const queryFields = Object.keys(query);
    
    if (queryFields.length === 0) return;
    
    // Generate index recommendation
    const indexKey = `${modelName}_${queryFields.sort().join('_')}`;
    
    if (!this.indexRecommendations.has(indexKey)) {
      this.indexRecommendations.set(indexKey, {
        collection: modelName,
        fields: queryFields,
        queryCount: 0,
        totalDuration: 0,
        avgDuration: 0
      });
    }
    
    const recommendation = this.indexRecommendations.get(indexKey);
    recommendation.queryCount++;
    recommendation.totalDuration += duration;
    recommendation.avgDuration = recommendation.totalDuration / recommendation.queryCount;
  }
  
  /**
   * Create indexes based on recommendations
   */
  async createRecommendedIndexes(connection) {
    const recommendations = Array.from(this.indexRecommendations.values())
      .filter(r => r.queryCount > 5 && r.avgDuration > this.slowQueryThreshold)
      .sort((a, b) => b.avgDuration - a.avgDuration);
    
    const created = [];
    
    for (const rec of recommendations) {
      try {
        const collection = connection.collection(rec.collection);
        const indexSpec = {};
        
        rec.fields.forEach(field => {
          indexSpec[field] = 1; // Ascending index
        });
        
        await collection.createIndex(indexSpec, {
          background: true,
          name: `idx_${rec.fields.join('_')}`
        });
        
        created.push({
          collection: rec.collection,
          index: indexSpec,
          improvement: `${rec.avgDuration}ms average query time`
        });
        
        console.log(`📈 Created index on ${rec.collection}: ${JSON.stringify(indexSpec)}`);
      } catch (error) {
        console.error(`Failed to create index on ${rec.collection}:`, error);
      }
    }
    
    return created;
  }
  
  /**
   * Setup read/write splitting
   */
  async setupReadWriteSplit(primaryUri, secondaryUris = []) {
    try {
      // Create write connection (primary)
      const writeConnection = await this.createOptimizedConnection(primaryUri, {
        readPreference: 'primary'
      });
      
      this.writeConnections.set('default', writeConnection);
      
      // Create read connections (secondaries)
      if (secondaryUris.length > 0) {
        for (let i = 0; i < secondaryUris.length; i++) {
          const readConnection = await this.createOptimizedConnection(secondaryUris[i], {
            readPreference: 'secondaryPreferred'
          });
          
          this.readConnections.set(`secondary_${i}`, readConnection);
        }
      } else {
        // Use primary for reads if no secondaries
        this.readConnections.set('primary', writeConnection);
      }
      
      console.log(`✅ Read/write splitting configured: 1 write, ${this.readConnections.size} read connections`);
      
      return {
        write: writeConnection,
        read: Array.from(this.readConnections.values())
      };
    } catch (error) {
      console.error('Read/write split setup error:', error);
      throw error;
    }
  }
  
  /**
   * Get connection for operation type
   */
  getConnectionForOperation(operationType) {
    const isWrite = ['insert', 'update', 'delete', 'save', 'create'].includes(operationType);
    
    if (isWrite) {
      return this.writeConnections.get('default') || null;
    } else {
      // Round-robin read connections
      const readConns = Array.from(this.readConnections.values());
      if (readConns.length === 0) return null;
      
      const index = Math.floor(Math.random() * readConns.length);
      return readConns[index];
    }
  }
  
  /**
   * Invalidate cache for model
   */
  invalidateCache(modelName = null) {
    if (modelName) {
      // Invalidate specific model caches
      const keys = [];
      for (const key of this.queryCache.keys()) {
        if (key.includes(modelName)) {
          keys.push(key);
        }
      }
      
      keys.forEach(key => this.queryCache.delete(key));
      console.log(`🗑️ Invalidated ${keys.length} cache entries for ${modelName}`);
    } else {
      // Clear all cache
      this.queryCache.clear();
      console.log('🗑️ Cleared all query cache');
    }
  }
  
  /**
   * Get query statistics
   */
  getQueryStats() {
    return {
      ...this.queryStats,
      cacheHitRate: this.queryStats.total > 0 
        ? ((this.queryStats.cached / this.queryStats.total) * 100).toFixed(2) + '%'
        : '0%',
      slowQueryRate: this.queryStats.total > 0
        ? ((this.queryStats.slow / this.queryStats.total) * 100).toFixed(2) + '%'
        : '0%',
      failureRate: this.queryStats.total > 0
        ? ((this.queryStats.failed / this.queryStats.total) * 100).toFixed(2) + '%'
        : '0%',
      cacheSize: this.queryCache.size,
      slowQueries: this.slowQueries.length,
      recommendations: this.indexRecommendations.size
    };
  }
  
  /**
   * Get slow query report
   */
  getSlowQueryReport() {
    return {
      threshold: this.slowQueryThreshold,
      count: this.slowQueries.length,
      queries: this.slowQueries.slice(-10).map(q => ({
        ...q,
        query: JSON.parse(q.query)
      }))
    };
  }
  
  /**
   * Get index recommendations
   */
  getIndexRecommendations() {
    return Array.from(this.indexRecommendations.values())
      .filter(r => r.queryCount > 3)
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);
  }
  
  /**
   * Optimize existing connection
   */
  async optimizeConnection(connection) {
    try {
      // Get database statistics
      const stats = await /* REMOVED: admin access */null.serverStatus();
      
      // Analyze and adjust pool size
      const currentConnections = stats.connections?.current || 0;
      const availableConnections = stats.connections?.available || 100;
      
      if (currentConnections > availableConnections * 0.8) {
        console.warn('⚠️ Connection pool near capacity, consider increasing pool size');
      }
      
      // Run database optimizer
      await /* REMOVED: admin access */null.command({ compact: 1 });
      
      // Update statistics
      await /* REMOVED: admin access */null.command({ 
        collMod: 'patients',
        validator: { $jsonSchema: {} }
      });
      
      console.log('✅ Database connection optimized');
      
      return {
        optimized: true,
        connections: currentConnections,
        available: availableConnections
      };
    } catch (error) {
      console.error('Connection optimization error:', error);
      return { optimized: false, error: error.message };
    }
  }
  
  /**
   * Handle query completion
   */
  handleQueryComplete(requestId, duration) {
    const metric = this.queryMetrics.get(requestId);
    if (metric) {
      metric.duration = duration;
      metric.endTime = Date.now();
      
      if (duration > this.slowQueryThreshold) {
        console.warn(`🐌 Slow ${metric.command} on ${metric.database}: ${duration}ms`);
      }
      
      this.queryMetrics.delete(requestId);
    }
  }
  
  /**
   * Handle query failure
   */
  handleQueryFailed(requestId) {
    const metric = this.queryMetrics.get(requestId);
    if (metric) {
      this.queryStats.failed++;
      console.error(`❌ Query failed: ${metric.command} on ${metric.database}`);
      this.queryMetrics.delete(requestId);
    }
  }
  
  /**
   * Initialize service
   */
  async initialize() {
    // Database Optimization Service initialized with pooling and caching
    
    // Setup periodic cache cleanup
    setInterval(() => {
      this.queryCache.purgeStale();
    }, 60000); // Every minute
    
    return true;
  }
}

// Export singleton instance
module.exports = new DBOptimizationService();