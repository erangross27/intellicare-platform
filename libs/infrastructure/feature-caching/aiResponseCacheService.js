// AI Response Cache Service for IntelliCare
// Provides intelligent caching for AI responses to improve performance and reduce costs
// Migrated to DDD NX architecture - Infrastructure Context - Caching Feature

const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../backend/services/secureDataAccess');
const crypto = require('crypto');

class AIResponseCacheService {
  constructor(options = {}) {
    this.serviceId = 'ai-response-cache-service';
    this.serviceToken = null;
    this.initialized = false;
    
    this.config = {
      maxCacheSize: options.maxCacheSize || 10000, // Maximum number of cached responses
      defaultTTL: options.defaultTTL || 3600, // 1 hour in seconds
      maxResponseSize: options.maxResponseSize || 100000, // 100KB max response size to cache
      enableCompression: options.enableCompression !== false,
      enableMetrics: options.enableMetrics !== false,
      cleanupInterval: options.cleanupInterval || 300000 // 5 minutes
    };
    
    // In-memory cache for hot data
    this.memoryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0,
      errors: 0,
      lastCleanup: Date.now()
    };
    
    // Cache key patterns that should have different TTLs
    this.ttlRules = new Map([
      ['patient-search', 300], // 5 minutes
      ['appointment-list', 600], // 10 minutes  
      ['medical-analysis', 1800], // 30 minutes
      ['diagnostic-suggestion', 3600], // 1 hour
      ['general-query', 7200] // 2 hours
    ]);
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Start cleanup timer
      this.startCleanupTimer();
      
      this.initialized = true;
      console.log('✅ AI Response Cache Service initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize AIResponseCacheService:', error);
      throw error;
    }
  }

  // Generate cache key from request parameters
  generateCacheKey(functionName, params, userId, practiceId) {
    const keyData = {
      function: functionName,
      params: this.normalizeParams(params),
      user: userId,
      practice: practiceId
    };
    
    const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  normalizeParams(params) {
    // Remove timestamp and other volatile parameters that shouldn't affect caching
    const normalized = { ...params };
    delete normalized.timestamp;
    delete normalized.requestId;
    delete normalized.sessionId;
    
    // Sort arrays for consistent hashing
    Object.keys(normalized).forEach(key => {
      if (Array.isArray(normalized[key])) {
        normalized[key] = [...normalized[key]].sort();
      }
    });
    
    return normalized;
  }

  determineTTL(functionName, params) {
    // Check for specific TTL rules
    for (const [pattern, ttl] of this.ttlRules) {
      if (functionName.toLowerCase().includes(pattern)) {
        return ttl;
      }
    }
    
    // Check if this is a patient-specific query (should cache shorter)
    if (params.patientId) {
      return 600; // 10 minutes for patient-specific data
    }
    
    // Default TTL
    return this.config.defaultTTL;
  }

  async get(functionName, params, userId, practiceId) {
    if (!this.initialized) await this.initialize();

    try {
      const cacheKey = this.generateCacheKey(functionName, params, userId, practiceId);
      
      // Check memory cache first
      if (this.memoryCache.has(cacheKey)) {
        const cached = this.memoryCache.get(cacheKey);
        if (cached.expires > Date.now()) {
          this.cacheStats.hits++;
          console.log(`🎯 Cache HIT (memory): ${functionName}`);
          return cached.data;
        } else {
          // Expired, remove from memory
          this.memoryCache.delete(cacheKey);
        }
      }
      
      // Check database cache
      const context = {
        serviceId: this.serviceId,
        operation: 'get-cached-response',
        practiceId: practiceId || 'global'
      };
      
      const cached = await SecureDataAccess.query('ai_response_cache', {
        cacheKey,
        expires: { $gt: new Date() }
      }, { limit: 1 }, context);
      
      if (cached.length > 0) {
        const cacheEntry = cached[0];
        this.cacheStats.hits++;
        
        // Add to memory cache for faster future access
        this.memoryCache.set(cacheKey, {
          data: cacheEntry.response,
          expires: cacheEntry.expires.getTime()
        });
        
        console.log(`🎯 Cache HIT (database): ${functionName}`);
        return cacheEntry.response;
      }
      
      // Cache miss
      this.cacheStats.misses++;
      console.log(`❌ Cache MISS: ${functionName}`);
      return null;
    } catch (error) {
      console.error('Error getting cached response:', error);
      this.cacheStats.errors++;
      return null;
    }
  }

  async set(functionName, params, userId, practiceId, response) {
    if (!this.initialized) await this.initialize();

    try {
      const cacheKey = this.generateCacheKey(functionName, params, userId, practiceId);
      const ttl = this.determineTTL(functionName, params);
      const expires = new Date(Date.now() + (ttl * 1000));
      
      // Don't cache if response is too large
      const responseSize = JSON.stringify(response).length;
      if (responseSize > this.config.maxResponseSize) {
        console.log(`⚠️ Response too large to cache: ${responseSize} bytes`);
        return false;
      }
      
      // Don't cache error responses
      if (response.success === false || response.error) {
        console.log('⚠️ Not caching error response');
        return false;
      }
      
      const context = {
        serviceId: this.serviceId,
        operation: 'set-cached-response',
        practiceId: practiceId || 'global'
      };
      
      // Store in database
      const cacheEntry = {
        cacheKey,
        functionName,
        userId,
        practiceId: practiceId || 'global',
        response,
        ttl,
        expires,
        createdAt: new Date(),
        responseSize
      };
      
      await SecureDataAccess.create('ai_response_cache', cacheEntry, context);
      
      // Store in memory cache
      this.memoryCache.set(cacheKey, {
        data: response,
        expires: expires.getTime()
      });
      
      this.cacheStats.writes++;
      console.log(`💾 Cached response: ${functionName} (TTL: ${ttl}s)`);
      
      // Check if we need to evict old entries
      await this.enforceMaxCacheSize();
      
      return true;
    } catch (error) {
      console.error('Error caching response:', error);
      this.cacheStats.errors++;
      return false;
    }
  }

  async enforceMaxCacheSize() {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'enforce-cache-size',
        practiceId: 'global'
      };
      
      // Count current cache entries
      const count = await SecureDataAccess.query('ai_response_cache', {}, { count: true }, context);
      
      if (count > this.config.maxCacheSize) {
        const excessCount = count - this.config.maxCacheSize;
        
        // Remove oldest entries
        const oldEntries = await SecureDataAccess.query('ai_response_cache', {}, {
          sort: { createdAt: 1 },
          limit: excessCount
        }, context);
        
        for (const entry of oldEntries) {
          await SecureDataAccess.delete('ai_response_cache', { _id: entry._id }, context);
          
          // Also remove from memory cache
          this.memoryCache.delete(entry.cacheKey);
          
          this.cacheStats.evictions++;
        }
        
        console.log(`🗑️ Evicted ${excessCount} old cache entries`);
      }
    } catch (error) {
      console.error('Error enforcing cache size limit:', error);
    }
  }

  async invalidate(pattern) {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'invalidate-cache',
        practiceId: 'global'
      };
      
      let filter = {};
      
      if (typeof pattern === 'string') {
        // Pattern-based invalidation
        filter.functionName = { $regex: pattern, $options: 'i' };
      } else if (pattern.userId) {
        filter.userId = pattern.userId;
      } else if (pattern.practiceId) {
        filter.practiceId = pattern.practiceId;
      } else if (pattern.functionName) {
        filter.functionName = pattern.functionName;
      }
      
      const deletedEntries = await SecureDataAccess.delete('ai_response_cache', filter, context);
      
      // Clear memory cache (simple approach - clear all)
      this.memoryCache.clear();
      
      console.log(`🗑️ Invalidated ${deletedEntries.length || 0} cache entries`);
      return deletedEntries.length || 0;
    } catch (error) {
      console.error('Error invalidating cache:', error);
      return 0;
    }
  }

  async cleanup() {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'cleanup-expired-cache',
        practiceId: 'global'
      };
      
      // Remove expired entries from database
      const expiredEntries = await SecureDataAccess.delete('ai_response_cache', {
        expires: { $lt: new Date() }
      }, context);
      
      // Clean memory cache
      const now = Date.now();
      for (const [key, entry] of this.memoryCache) {
        if (entry.expires <= now) {
          this.memoryCache.delete(key);
        }
      }
      
      this.cacheStats.lastCleanup = now;
      console.log(`🧹 Cleanup removed ${expiredEntries.length || 0} expired cache entries`);
      
      return expiredEntries.length || 0;
    } catch (error) {
      console.error('Error during cache cleanup:', error);
      return 0;
    }
  }

  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
    
    console.log(`🕐 Cache cleanup timer started (interval: ${this.config.cleanupInterval}ms)`);
  }

  getStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0 
      ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100 
      : 0;
    
    return {
      ...this.cacheStats,
      hitRate: hitRate.toFixed(2) + '%',
      memoryCacheSize: this.memoryCache.size,
      config: this.config
    };
  }

  async getDetailedStats() {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'get-cache-stats',
        practiceId: 'global'
      };
      
      const totalEntries = await SecureDataAccess.query('ai_response_cache', {}, { count: true }, context);
      const expiredEntries = await SecureDataAccess.query('ai_response_cache', {
        expires: { $lt: new Date() }
      }, { count: true }, context);
      
      return {
        ...this.getStats(),
        databaseEntries: totalEntries,
        expiredEntries: expiredEntries,
        activeEntries: totalEntries - expiredEntries
      };
    } catch (error) {
      console.error('Error getting detailed stats:', error);
      return this.getStats();
    }
  }

  async clear() {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'clear-all-cache',
        practiceId: 'global'
      };
      
      await SecureDataAccess.delete('ai_response_cache', {}, context);
      this.memoryCache.clear();
      
      // Reset stats
      this.cacheStats = {
        hits: 0,
        misses: 0,
        writes: 0,
        evictions: 0,
        errors: 0,
        lastCleanup: Date.now()
      };
      
      console.log('🗑️ Cache cleared completely');
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }
}

// Create and export singleton
const aiResponseCacheService = new AIResponseCacheService();
module.exports = aiResponseCacheService;