/**
 * Universal Caching Wrapper for IntelliCare
 *
 * Automatically caches ANY function call with intelligent TTL and invalidation
 * Initializes on server startup for maximum performance
 */

const redis = require('redis');
const crypto = require('crypto');

class UniversalCache {
  constructor() {
    this.client = null;
    this.connected = false;
    this.initialized = false;
    this.enabled = false; // DEV: Cache disabled for debugging. Original: process.env.ENABLE_UNIVERSAL_CACHE !== 'false'

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      cached: 0,
      invalidated: 0,
      errors: 0
    };

    // Intelligent TTL based on operation type (in seconds)
    this.TTL_STRATEGY = {
      // READ operations - longer cache
      list: 300,          // 5 minutes for lists
      get: 600,           // 10 minutes for single items
      search: 180,        // 3 minutes for searches
      find: 180,          // 3 minutes for find operations
      count: 300,         // 5 minutes for counts

      // WRITE operations - invalidate related caches
      add: 0,             // Don't cache, invalidate lists
      create: 0,          // Don't cache, invalidate lists
      update: 0,          // Don't cache, invalidate specific + lists
      delete: 0,          // Don't cache, invalidate specific + lists

      // ANALYTICS - medium cache
      analytics: 900,     // 15 minutes
      statistics: 900,    // 15 minutes
      report: 1800,       // 30 minutes

      // DEFAULT
      default: 120        // 2 minutes default
    };

    // Operations that should invalidate caches
    this.INVALIDATION_RULES = {
      // Patient operations
      'addPatient': ['listAllPatients', 'searchPatients', 'countPatients'],
      'updatePatient': ['listAllPatients', 'searchPatients', 'getPatientDetails:${id}', 'countPatients'],
      'deletePatient': ['listAllPatients', 'searchPatients', 'getPatientDetails:${id}', 'countPatients'],

      // Appointment operations
      'scheduleAppointment': ['getAppointments', 'getTodayAppointments', 'findAvailableSlots'],
      'cancelAppointment': ['getAppointments', 'getTodayAppointments', 'findAvailableSlots'],
      'rescheduleAppointment': ['getAppointments', 'getTodayAppointments', 'findAvailableSlots'],

      // Document operations
      'uploadDocument': ['getDocuments', 'searchDocuments'],
      'deleteDocument': ['getDocuments', 'searchDocuments'],

      // User operations
      'addUser': ['searchUsers', 'getPatientProvider', 'getAllUsers'],
      'updateUser': ['searchUsers', 'getPatientProvider', 'getAllUsers', 'getUserDetails:${id}'],
      'deleteUser': ['searchUsers', 'getPatientProvider', 'getAllUsers', 'getUserDetails:${id}']
    };
  }

  /**
   * Initialize on server startup
   */
  async initialize() {
    if (this.initialized) return true;

    // Check if cache is disabled via environment variable
    if (!this.enabled) {
      console.log('⚠️ Universal Cache is DISABLED via ENABLE_UNIVERSAL_CACHE=false');
      console.log('💡 All function calls will execute directly without caching');
      this.connected = false;
      this.initialized = true;
      return false;
    }

    console.log('🚀 Initializing Universal Cache Service...');

    try {
      // Try multiple common Redis ports
      const ports = [6379, 6380, 7000, 7001];
      let connected = false;

      for (const port of ports) {
        try {
          console.log(`🔴 Trying Redis on port ${port}...`);

          this.client = redis.createClient({
            socket: {
              host: 'localhost',
              port: port,
              connectTimeout: 2000,
              reconnectStrategy: (retries) => {
                if (retries > 3) return false;
                return Math.min(retries * 100, 1000);
              }
            },
            lazyConnect: false
          });

          // Set up event handlers
          this.client.on('error', (err) => {
            if (!connected) {
              console.log(`❌ Redis port ${port} error: ${err.message}`);
            }
          });

          this.client.on('ready', () => {
            console.log(`✅ Redis connected on port ${port}!`);
            this.connected = true;
            connected = true;
          });

          // Try to connect
          await this.client.connect();

          // Test connection
          const pong = await this.client.ping();
          if (pong === 'PONG') {
            console.log(`✅ Universal Cache initialized on Redis port ${port}`);
            this.initialized = true;
            this.connected = true;

            // Set up periodic stats logging
            setInterval(() => this.logStats(), 60000); // Every minute

            return true;
          }
        } catch (err) {
          console.log(`❌ Port ${port} failed: ${err.message}`);
          if (this.client) {
            try {
              await this.client.quit();
            } catch {}
            this.client = null;
          }
        }
      }

      // If no Redis found, work without cache
      console.warn('⚠️ Redis not available on any port. Running without cache.');
      this.connected = false;
      this.initialized = true; // Mark as initialized even without Redis
      return false;

    } catch (error) {
      console.error('Failed to initialize Universal Cache:', error);
      this.connected = false;
      this.initialized = true;
      return false;
    }
  }

  /**
   * Generate cache key for any function
   */
  generateKey(functionName, practiceId, params = {}) {
    const baseKey = `ic:${practiceId}:${functionName}`;

    // Create deterministic hash of parameters
    if (Object.keys(params).length > 0) {
      const paramHash = crypto
        .createHash('md5')
        .update(JSON.stringify(params))
        .digest('hex')
        .substring(0, 8);
      return `${baseKey}:${paramHash}`;
    }

    return baseKey;
  }

  /**
   * Wrap ANY async function with caching
   */
  async cacheableFunction(functionName, practiceId, params, executeFunction) {
    // If cache is disabled or not connected, execute directly
    if (!this.enabled || !this.connected) {
      // No cache available, execute directly
      return await executeFunction();
    }

    const cacheKey = this.generateKey(functionName, practiceId, params);

    // Check if this is a write operation (don't cache)
    const operation = functionName.toLowerCase();
    const isWriteOp = operation.includes('add') ||
                     operation.includes('create') ||
                     operation.includes('update') ||
                     operation.includes('delete') ||
                     operation.includes('import') ||
                     operation.includes('upload');

    if (isWriteOp) {
      // Execute write operation
      const result = await executeFunction();

      // Invalidate related caches
      await this.invalidateRelatedCaches(functionName, practiceId, params);

      return result;
    }

    // Try to get from cache for read operations
    try {
      const cached = await this.client.get(cacheKey);
      if (cached) {
        this.stats.hits++;
        console.log(`⚡ Cache HIT: ${functionName} (${this.stats.hits} total hits)`);
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error(`Cache GET error for ${functionName}:`, err);
      this.stats.errors++;
    }

    // Cache miss - execute function
    this.stats.misses++;
    console.log(`💭 Cache MISS: ${functionName} - executing...`);

    const result = await executeFunction();

    // Store in cache with intelligent TTL
    if (result && result.success !== false) {
      const ttl = this.getTTL(functionName);
      try {
        await this.client.setEx(cacheKey, ttl, JSON.stringify(result));
        this.stats.cached++;
        console.log(`💾 Cached ${functionName} for ${ttl}s (${this.stats.cached} total cached)`);
      } catch (err) {
        console.error(`Cache SET error for ${functionName}:`, err);
        this.stats.errors++;
      }
    }

    return result;
  }

  /**
   * Get intelligent TTL based on operation type
   */
  getTTL(functionName) {
    const operation = functionName.toLowerCase();

    // Check each TTL strategy
    for (const [key, ttl] of Object.entries(this.TTL_STRATEGY)) {
      if (operation.includes(key)) {
        return ttl;
      }
    }

    return this.TTL_STRATEGY.default;
  }

  /**
   * Invalidate related caches based on operation
   */
  async invalidateRelatedCaches(functionName, practiceId, params) {
    if (!this.connected) return;

    const rules = this.INVALIDATION_RULES[functionName];
    if (!rules) return;

    console.log(`🔄 Invalidating caches for ${functionName}...`);

    for (const pattern of rules) {
      try {
        // Replace placeholders with actual values
        let keyPattern = pattern;
        if (pattern.includes('${id}') && params.id) {
          keyPattern = pattern.replace('${id}', params.id);
        }

        // Generate the cache key to invalidate
        const cacheKey = this.generateKey(keyPattern, practiceId, {});

        // Delete the key
        const deleted = await this.client.del(cacheKey);
        if (deleted) {
          this.stats.invalidated++;
          console.log(`🗑️ Invalidated: ${keyPattern}`);
        }

        // Also delete pattern-based keys
        const patternKey = `ic:${practiceId}:${keyPattern.split(':')[0]}:*`;
        const keys = await this.client.keys(patternKey);
        if (keys.length > 0) {
          await this.client.del(keys);
          this.stats.invalidated += keys.length;
          console.log(`🗑️ Invalidated ${keys.length} keys matching ${patternKey}`);
        }

      } catch (err) {
        console.error(`Error invalidating cache for ${pattern}:`, err);
      }
    }
  }

  /**
   * Clear all cache for a practice
   */
  async clearPracticeCache(practiceId) {
    if (!this.connected) return false;

    try {
      const pattern = `ic:${practiceId}:*`;
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`🧹 Cleared ${keys.length} cache entries for practice: ${practiceId}`);
      }

      return true;
    } catch (error) {
      console.error('Error clearing practice cache:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      total,
      connected: this.connected
    };
  }

  /**
   * Log statistics periodically
   */
  logStats() {
    const stats = this.getStats();
    if (stats.total > 0) {
      console.log(`📊 Cache Stats: ${stats.hitRate} hit rate | ${stats.hits} hits | ${stats.misses} misses | ${stats.cached} cached | ${stats.invalidated} invalidated`);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.connected || !this.client) return false;

    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch (error) {
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.client && this.connected) {
      this.logStats(); // Final stats
      await this.client.quit();
      console.log('🔴 Universal Cache disconnected gracefully');
    }
  }
}

// Create singleton instance
const universalCache = new UniversalCache();

module.exports = universalCache;