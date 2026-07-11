/**
 * Redis Service Compatibility Wrapper
 * Provides a unified interface for Redis operations across the application
 * This bridges the gap between redisCache and components expecting redisService
 */

const redisCache = require('./redisCache');

class RedisService {
  constructor() {
    this.redisCache = redisCache;
  }

  /**
   * Get the Redis client instance
   * @returns {Object} Redis client with status property
   */
  getClient() {
    // Return an object that matches the expected interface
    return {
      status: this.redisCache.connected ? 'ready' : 'disconnected',
      get: async (key) => {
        return await this.redisCache.get(key);
      },
      set: async (key, value, ttl) => {
        return await this.redisCache.set(key, value, ttl);
      },
      del: async (key) => {
        return await this.redisCache.del(key);
      },
      exists: async (key) => {
        return await this.redisCache.exists(key);
      },
      expire: async (key, seconds) => {
        return await this.redisCache.expire(key, seconds);
      },
      keys: async (pattern) => {
        if (!this.redisCache.client || !this.redisCache.connected) {
          return [];
        }
        return await this.redisCache.client.keys(pattern);
      },
      ping: async () => {
        return await this.redisCache.healthCheck() ? 'PONG' : null;
      },
      // Direct client access for advanced operations
      client: this.redisCache.client
    };
  }

  /**
   * Initialize the Redis connection
   */
  async initialize() {
    return await this.redisCache.initialize();
  }

  /**
   * Check if Redis is connected
   */
  isConnected() {
    return this.redisCache.connected;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.redisCache.getStats();
  }

  /**
   * Invalidate patient cache
   */
  async invalidatePatientCache(practiceId, patientId = null) {
    return await this.redisCache.invalidatePatientCache(practiceId, patientId);
  }

  /**
   * Clear all cache entries
   */
  async clearAll() {
    return await this.redisCache.clear();
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    return await this.redisCache.shutdown();
  }
}

// Create singleton instance
const redisService = new RedisService();

// Initialize on first import
redisService.initialize().catch(err => {
  console.error('Failed to initialize Redis service:', err);
});

module.exports = redisService;