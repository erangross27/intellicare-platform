// 🎯 CRITICAL PERFORMANCE FIX: API Response Caching Service
// Implements intelligent caching strategies to reduce network requests

class CacheService {
  constructor() {
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
    
    // Different TTL for different types of data
    this.ttlConfig = {
      patients: 2 * 60 * 1000,      // 2 minutes - frequently updated
      patient: 5 * 60 * 1000,       // 5 minutes - individual patient data
      documents: 10 * 60 * 1000,    // 10 minutes - documents change less frequently
      translations: 60 * 60 * 1000, // 1 hour - translations rarely change
      deletedPatients: 30 * 1000,   // 30 seconds - very dynamic data
    };
  }

  /**
   * Generate cache key from URL and parameters
   */
  generateKey(url, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    return `${url}${paramString ? `?${paramString}` : ''}`;
  }

  /**
   * Get TTL for specific cache type
   */
  getTTL(cacheType) {
    return this.ttlConfig[cacheType] || this.defaultTTL;
  }

  /**
   * Check if cache entry is still valid
   */
  isValid(key, cacheType) {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    
    const ttl = this.getTTL(cacheType);
    return Date.now() - timestamp < ttl;
  }

  /**
   * Get cached response if valid
   */
  get(key, cacheType) {
    if (this.isValid(key, cacheType)) {
      process.env.NODE_ENV !== 'production' && console.log(`🎯 Cache HIT: ${key}`);
      return this.cache.get(key);
    }
    
    process.env.NODE_ENV !== 'production' && console.log(`❌ Cache MISS: ${key}`);
    this.delete(key); // Clean up expired entry
    return null;
  }

  /**
   * Store response in cache
   */
  set(key, data, cacheType) {
    process.env.NODE_ENV !== 'production' && console.log(`💾 Cache SET: ${key} (TTL: ${this.getTTL(cacheType)}ms)`);
    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());
    
    // Prevent memory leaks by limiting cache size
    if (this.cache.size > 100) {
      this.cleanup();
    }
  }

  /**
   * Delete specific cache entry
   */
  delete(key) {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
  }

  /**
   * Clear all cache entries for a specific type
   */
  clearType(cacheType) {
    const keysToDelete = [];
    
    for (const [key] of this.cache) {
      if (key.includes(cacheType)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key));
    process.env.NODE_ENV !== 'production' && console.log(`🧹 Cleared ${keysToDelete.length} cache entries for type: ${cacheType}`);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    process.env.NODE_ENV !== 'production' && console.log('🧹 Cache cleared completely');
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, timestamp] of this.cacheTimestamps) {
      // Use default TTL for cleanup
      if (now - timestamp > this.defaultTTL) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key));
    process.env.NODE_ENV !== 'production' && console.log(`🧹 Cleaned up ${keysToDelete.length} expired cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      timestamps: Array.from(this.cacheTimestamps.entries())
    };
  }

  /**
   * Invalidate cache entries that match a pattern
   */
  invalidatePattern(pattern) {
    const keysToDelete = [];
    
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key));
    process.env.NODE_ENV !== 'production' && console.log(`🧹 Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
  }
}

// Create singleton instance
const cacheService = new CacheService();

// Auto cleanup every 10 minutes
setInterval(() => {
  cacheService.cleanup();
}, 10 * 60 * 1000);

export default cacheService;
