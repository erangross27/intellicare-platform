/**
 * Redis Caching Service for IntelliCare
 *
 * Uses Redis/Memurai for Windows to cache frequently accessed data
 * Provides 10-100x performance improvement for common queries
 */

const redis = require('redis');

class RedisCache {
  constructor() {
    this.client = null;
    this.connected = false;

    // DEBUG MODE - DISABLE CACHING DURING DEVELOPMENT
    this.CACHING_DISABLED = true; // Set to false to re-enable caching

    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      avgResponseTime: 0
    };

    // TTL configurations (in seconds)
    this.TTL = {
      patientList: 300,      // 5 minutes for patient lists
      patientDetails: 600,   // 10 minutes for individual patient
      appointments: 120,     // 2 minutes for appointments (changes frequently)
      searchResults: 180,    // 3 minutes for search results
      userSessions: 3600,    // 1 hour for user sessions
      functionMappings: 1800 // 30 minutes for AI function mappings
    };
  }

  async initialize() {
    // DEBUGGING - Skip initialization when caching is disabled
    if (this.CACHING_DISABLED) {
      console.log('🚫 Redis Cache DISABLED for debugging - no connection needed');
      return true; // Pretend we're connected
    }

    if (this.connected) return true;

    try {
      // Create Redis client with automatic reconnection
      this.client = redis.createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('❌ Redis: Too many reconnection attempts');
              return new Error('Too many retries');
            }
            // Reconnect after delay
            return Math.min(retries * 100, 3000);
          }
        },
        // Connection pool settings
        lazyConnect: false,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      });

      // Error handling
      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.stats.errors++;
      });

      this.client.on('connect', () => {
        console.log('🔴 Redis: Connecting...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis: Connected and ready');
        this.connected = true;
      });

      this.client.on('end', () => {
        console.log('🔴 Redis: Connection closed');
        this.connected = false;
      });

      // Connect to Redis
      await this.client.connect();

      // Test connection
      await this.client.ping();

      console.log('✅ Redis Cache Service initialized');
      return true;

    } catch (error) {
      console.warn('⚠️ Redis not available, falling back to MongoDB only:', error.message);
      this.connected = false;
      return false;
    }
  }

  /**
   * Generate cache key with practice isolation
   */
  generateKey(operation, practiceId, params = {}) {
    // Include practice ID for multi-tenant isolation
    const baseKey = `intellicare:${practiceId}:${operation}`;

    // Add parameters to key for unique identification
    if (Object.keys(params).length > 0) {
      const paramStr = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(':');
      return `${baseKey}:${paramStr}`;
    }

    return baseKey;
  }

  /**
   * Get cached data
   */
  async get(key) {
    // DEBUGGING - Skip cache when disabled
    if (this.CACHING_DISABLED) {
      console.log(`🚫 Cache DISABLED (debugging mode) - skipping cache for: ${key}`);
      return null;
    }

    if (!this.connected) return null;

    const startTime = Date.now();

    try {
      const data = await this.client.get(key);

      const responseTime = Date.now() - startTime;
      this.updateStats(!!data, responseTime);

      if (data) {
        console.log(`⚡ Cache HIT: ${key} (${responseTime}ms)`);
        return JSON.parse(data);
      } else {
        console.log(`💭 Cache MISS: ${key}`);
        return null;
      }

    } catch (error) {
      console.error('Redis GET error:', error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set(key, value, ttlSeconds = null) {
    // DEBUGGING - Skip cache when disabled
    if (this.CACHING_DISABLED) {
      console.log(`🚫 Cache DISABLED (debugging mode) - not caching: ${key}`);
      return true; // Pretend success
    }

    if (!this.connected) return false;

    try {
      const serialized = JSON.stringify(value);

      if (ttlSeconds) {
        // Set with expiration
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        // Set without expiration
        await this.client.set(key, serialized);
      }

      console.log(`💾 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;

    } catch (error) {
      console.error('Redis SET error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete cached data (for invalidation)
   */
  async del(key) {
    if (!this.connected) return false;

    try {
      await this.client.del(key);
      console.log(`🗑️ Cache DEL: ${key}`);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  /**
   * Clear all cache for a practice (pattern-based)
   */
  async clearPracticeCache(practiceId) {
    if (!this.connected) return false;

    try {
      const pattern = `intellicare:${practiceId}:*`;
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`🧹 Cleared ${keys.length} cache entries for practice: ${practiceId}`);
      }

      return true;
    } catch (error) {
      console.error('Redis CLEAR error:', error);
      return false;
    }
  }

  /**
   * Invalidate patient-related cache
   */
  async invalidatePatientCache(practiceId, patientId = null) {
    if (!this.connected) return;

    try {
      // Always clear patient list cache
      const listKey = this.generateKey('listAllPatients', practiceId);
      await this.del(listKey);

      // Clear search results cache
      const searchPattern = `intellicare:${practiceId}:searchPatients:*`;
      const searchKeys = await this.client.keys(searchPattern);
      if (searchKeys.length > 0) {
        await this.client.del(searchKeys);
      }

      // If specific patient, clear their details
      if (patientId) {
        const detailKey = this.generateKey('getPatientDetails', practiceId, { patientId });
        await this.del(detailKey);
      }

      console.log(`🔄 Invalidated patient cache for practice: ${practiceId}`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Update statistics
   */
  updateStats(hit, responseTime) {
    if (hit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    // Update average response time
    const total = this.stats.hits + this.stats.misses;
    this.stats.avgResponseTime =
      (this.stats.avgResponseTime * (total - 1) + responseTime) / total;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      total
    };
  }

  /**
   * Cache wrapper for async functions
   */
  async cacheable(key, ttlSeconds, fetchFunction) {
    // Try to get from cache first
    const cached = await this.get(key);
    if (cached) {
      return cached;
    }

    // Fetch from source
    const data = await fetchFunction();

    // Store in cache for next time
    if (data) {
      await this.set(key, data, ttlSeconds);
    }

    return data;
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.connected) return false;

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
      await this.client.quit();
      console.log('🔴 Redis connection closed gracefully');
    }
  }
}

// Create singleton instance
const redisCache = new RedisCache();

// Initialize on first import
redisCache.initialize().catch(err => {
  console.error('Failed to initialize Redis cache:', err);
});

module.exports = redisCache;