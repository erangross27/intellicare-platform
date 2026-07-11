# Task 3.10: Add Response Caching

## 📋 **Task Overview**
**Phase:** 3 (Utilities, Monitoring & Resilience)  
**Time Estimate:** 20 minutes  
**Risk Level:** LOW  
**Priority:** LOW  

Add intelligent response caching for common AI queries to reduce costs and improve response times.

## 🎯 **Objective**
Implement response caching that:
- Caches common medical questions and answers
- Reduces AI service costs for repeated queries
- Improves response times for cached content
- Implements intelligent cache invalidation

## 🚨 **Cost Risk**
**LOW:** Without caching, repeated identical queries increase AI service costs unnecessarily.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add intelligent response caching system**

## 🔍 **Current Caching Limitations**

### **Issue 1: No Response Caching**
```javascript
// CURRENT - NO CACHING
router.post('/chat', async (req, res) => {
  // Every request goes to AI service
  const result = await agent.processChatMessage(...);
  res.json(result);
});
```

### **Issue 2: Repeated Identical Queries**
```javascript
// CURRENT - WASTEFUL
// Same question asked multiple times = multiple AI calls
// "What is diabetes?" asked 100 times = 100 AI calls
```

### **Issue 3: No Cost Optimization**
```javascript
// CURRENT - NO COST CONTROL
// No tracking of repeated queries
// No optimization for common medical questions
```

## ✅ **Intelligent Response Caching System**

### **1. Cache Manager**
```javascript
// ADD at top of file after imports:
const crypto = require('crypto');

class ResponseCacheManager {
  constructor() {
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      saves: 0,
      evictions: 0
    };
    this.maxCacheSize = 1000; // Max cached responses
    this.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
    this.cleanupInterval = null;
    
    this.startCleanupSchedule();
    console.log('💾 Response cache manager initialized');
  }
  
  // Generate cache key from request
  generateCacheKey(type, data, practiceContext = null) {
    const keyData = {
      type: type,
      ...data
    };
    
    // Include practice-specific context for multi-tenancy
    if (practiceContext) {
      keyData.country = practiceContext.country;
      keyData.language = practiceContext.language;
      keyData.medicalSystem = practiceContext.practice?.medicalSystem;
    }
    
    const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }
  
  // Check if response is cacheable
  isCacheable(type, data, result) {
    // Don't cache errors or fallback responses
    if (!result || result.fallback || result.error) {
      return false;
    }
    
    // Don't cache patient-specific information
    if (data.patientName || data.patientId) {
      return false;
    }
    
    // Cache general medical questions
    if (type === 'chat') {
      const message = data.message?.toLowerCase() || '';
      
      // Cache common medical questions
      const cacheablePatterns = [
        /what is/,
        /how to/,
        /symptoms of/,
        /treatment for/,
        /causes of/,
        /prevention of/,
        /diagnosis of/,
        /medication for/,
        /side effects/,
        /normal range/
      ];
      
      return cacheablePatterns.some(pattern => pattern.test(message));
    }
    
    // Cache document analysis for common document types
    if (type === 'document_analysis') {
      return data.documentType && !data.patientSpecific;
    }
    
    return false;
  }
  
  // Get cached response
  get(cacheKey) {
    const cached = this.cache.get(cacheKey);
    
    if (!cached) {
      this.cacheStats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(cacheKey);
      this.cacheStats.evictions++;
      this.cacheStats.misses++;
      return null;
    }
    
    // Update access time
    cached.lastAccessed = Date.now();
    cached.accessCount++;
    
    this.cacheStats.hits++;
    
    console.log(`💾 Cache hit for key: ${cacheKey.substring(0, 16)}...`);
    
    return {
      ...cached.response,
      cached: true,
      cacheInfo: {
        cachedAt: cached.cachedAt,
        accessCount: cached.accessCount,
        lastAccessed: cached.lastAccessed
      }
    };
  }
  
  // Store response in cache
  set(cacheKey, response, ttl = null) {
    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }
    
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    const cacheEntry = {
      response: response,
      cachedAt: Date.now(),
      expiresAt: expiresAt,
      lastAccessed: Date.now(),
      accessCount: 0,
      ttl: ttl || this.defaultTTL
    };
    
    this.cache.set(cacheKey, cacheEntry);
    this.cacheStats.saves++;
    
    console.log(`💾 Cached response for key: ${cacheKey.substring(0, 16)}...`);
  }
  
  // Evict least recently used entries
  evictLeastRecentlyUsed() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.cacheStats.evictions++;
      console.log(`💾 Evicted LRU cache entry: ${oldestKey.substring(0, 16)}...`);
    }
  }
  
  // Clear expired entries
  clearExpired() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.cacheStats.evictions += expiredCount;
      console.log(`💾 Cleared ${expiredCount} expired cache entries`);
    }
    
    return expiredCount;
  }
  
  // Start cleanup schedule
  startCleanupSchedule() {
    // Clean up expired entries every hour
    this.cleanupInterval = setInterval(() => {
      this.clearExpired();
    }, 60 * 60 * 1000);
  }
  
  // Stop cleanup schedule
  stopCleanupSchedule() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  // Get cache statistics
  getStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0 ? 
      (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100 : 0;
    
    return {
      ...this.cacheStats,
      hitRate: Math.round(hitRate * 100) / 100,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize
    };
  }
  
  // Clear all cache
  clear() {
    const clearedCount = this.cache.size;
    this.cache.clear();
    console.log(`💾 Cleared ${clearedCount} cache entries`);
    return clearedCount;
  }
  
  // Get cache contents for debugging
  getCacheContents() {
    const contents = [];
    
    for (const [key, entry] of this.cache) {
      contents.push({
        key: key.substring(0, 16) + '...',
        cachedAt: entry.cachedAt,
        expiresAt: entry.expiresAt,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
        responseType: entry.response.action || 'unknown'
      });
    }
    
    return contents.sort((a, b) => b.lastAccessed - a.lastAccessed);
  }
}

// Create global cache manager
const responseCache = new ResponseCacheManager();
global.responseCache = responseCache;
```

### **2. Cached Chat Responses**
```javascript
// UPDATE: Chat route with caching
router.post('/chat',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    const logger = createLogger(req);
    
    try {
      const { message, sessionId = 'default', language = 'he' } = req.body;
      const clinicSessionId = createClinicSessionId(req.practiceSubdomain, sessionId);
      
      // ✅ CHECK: Cache for response
      const cacheKey = responseCache.generateCacheKey('chat', {
        message: message.toLowerCase().trim(),
        language: language
      }, req.practiceContext);
      
      const cachedResponse = responseCache.get(cacheKey);
      
      if (cachedResponse) {
        logger.info('Returning cached chat response', {
          messageLength: message.length,
          cacheKey: cacheKey.substring(0, 16),
          accessCount: cachedResponse.cacheInfo.accessCount
        });
        
        // Add request ID and return cached response
        cachedResponse.requestId = req.requestId;
        
        // Log cache hit
        await correlatedAuditLog(req, 'CHAT_CACHE_HIT', {
          messageLength: message.length,
          cacheKey: cacheKey.substring(0, 16),
          accessCount: cachedResponse.cacheInfo.accessCount
        });
        
        return res.json(cachedResponse);
      }
      
      // ✅ PROCESS: New request with AI
      logger.info('Processing new chat message (cache miss)', {
        messageLength: message.length,
        cacheKey: cacheKey.substring(0, 16)
      });
      
      const result = await aiCircuitBreakers.chat.execute(
        async () => {
          return await agent.processChatMessage(
            message, 
            clinicSessionId, 
            language, 
            req.practiceContext
          );
        },
        aiFallbacks.chat
      );
      
      // ✅ CACHE: Response if cacheable
      if (responseCache.isCacheable('chat', { message, language }, result)) {
        responseCache.set(cacheKey, result, 24 * 60 * 60 * 1000); // 24 hours
        
        logger.info('Cached chat response', {
          cacheKey: cacheKey.substring(0, 16),
          responseType: result.action
        });
        
        await correlatedAuditLog(req, 'CHAT_RESPONSE_CACHED', {
          messageLength: message.length,
          cacheKey: cacheKey.substring(0, 16),
          responseType: result.action
        });
      }
      
      result.requestId = req.requestId;
      res.json(result);
      
    } catch (error) {
      throw error;
    }
  })
);
```

### **3. Cached Document Analysis**
```javascript
// UPDATE: Document analysis with caching
router.post('/analyze-document',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    const logger = createLogger(req);
    
    try {
      const { documentText, documentId, patientId, language = 'he' } = req.body;
      
      // ✅ CHECK: Cache for common document types
      let cacheKey = null;
      let cachedResponse = null;
      
      // Only cache if no patient-specific information
      if (!patientId && documentText) {
        // Create hash of document content for caching
        const contentHash = crypto.createHash('md5')
          .update(documentText.toLowerCase().trim())
          .digest('hex');
        
        cacheKey = responseCache.generateCacheKey('document_analysis', {
          contentHash: contentHash,
          language: language
        }, req.practiceContext);
        
        cachedResponse = responseCache.get(cacheKey);
      }
      
      if (cachedResponse) {
        logger.info('Returning cached document analysis', {
          cacheKey: cacheKey.substring(0, 16),
          accessCount: cachedResponse.cacheInfo.accessCount
        });
        
        cachedResponse.requestId = req.requestId;
        
        await correlatedAuditLog(req, 'DOCUMENT_ANALYSIS_CACHE_HIT', {
          cacheKey: cacheKey.substring(0, 16),
          accessCount: cachedResponse.cacheInfo.accessCount
        });
        
        return res.json(cachedResponse);
      }
      
      // ✅ PROCESS: New analysis
      const result = await aiCircuitBreakers.documentAnalysis.execute(
        async () => {
          return await agent.analyzeDocument({
            documentText,
            documentId,
            patientId,
            language,
            practiceContext: req.practiceContext
          });
        },
        aiFallbacks.documentAnalysis
      );
      
      // ✅ CACHE: Analysis if cacheable
      if (cacheKey && responseCache.isCacheable('document_analysis', {
        documentText,
        patientSpecific: !!patientId
      }, result)) {
        responseCache.set(cacheKey, result, 7 * 24 * 60 * 60 * 1000); // 7 days
        
        logger.info('Cached document analysis', {
          cacheKey: cacheKey.substring(0, 16),
          analysisType: result.analysisType
        });
      }
      
      result.requestId = req.requestId;
      res.json(result);
      
    } catch (error) {
      throw error;
    }
  })
);
```

### **4. Cache Management Endpoints**
```javascript
// ADD: Cache management endpoints
router.get('/cache/stats',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      const stats = responseCache.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get cache stats'
      });
    }
  }
);

router.get('/cache/contents',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      // Only allow admin users to view cache contents
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      
      const contents = responseCache.getCacheContents();
      
      res.json({
        success: true,
        data: contents
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get cache contents'
      });
    }
  }
);

router.post('/cache/clear',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      // Only allow admin users to clear cache
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      
      const clearedCount = responseCache.clear();
      
      await correlatedAuditLog(req, 'CACHE_CLEARED', {
        clearedCount: clearedCount,
        clearedBy: req.user._id
      });
      
      res.json({
        success: true,
        data: {
          clearedCount: clearedCount
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);

router.post('/cache/cleanup',
  practiceAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const expiredCount = responseCache.clearExpired();
      
      await correlatedAuditLog(req, 'CACHE_CLEANUP', {
        expiredCount: expiredCount,
        triggeredBy: req.user._id
      });
      
      res.json({
        success: true,
        data: {
          expiredCount: expiredCount
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  })
);
```

### **5. Cache Monitoring and Metrics**
```javascript
// ADD: Cache monitoring
const monitorCachePerformance = () => {
  // Log cache stats periodically
  setInterval(() => {
    const stats = responseCache.getStats();
    
    console.log(`💾 Cache stats: ${stats.hitRate}% hit rate, ${stats.cacheSize}/${stats.maxCacheSize} entries`);
    
    // Emit metrics
    if (global.metrics) {
      global.metrics.emit('cache_stats', stats);
    }
    
    // Alert on low hit rate
    if (stats.hitRate < 20 && (stats.hits + stats.misses) > 100) {
      console.log('⚠️ Low cache hit rate detected');
      
      if (global.alertSystem) {
        global.alertSystem.triggerAlert('LOW_CACHE_HIT_RATE', {
          hitRate: stats.hitRate,
          totalRequests: stats.hits + stats.misses,
          severity: 'warning'
        });
      }
    }
    
  }, 5 * 60 * 1000); // Every 5 minutes
};

// Start cache monitoring
monitorCachePerformance();

// Add cache stats to health checks
if (global.healthChecks) {
  global.healthChecks.addCheck('response_cache', {
    name: 'Response Cache',
    timeout: 1000,
    critical: false,
    check: async () => {
      const stats = responseCache.getStats();
      
      return {
        cache_size: stats.cacheSize,
        max_cache_size: stats.maxCacheSize,
        hit_rate: stats.hitRate,
        total_hits: stats.hits,
        total_misses: stats.misses,
        status: stats.hitRate > 10 ? 'healthy' : 'low_hit_rate'
      };
    }
  });
}
```

### **6. Graceful Shutdown Integration**
```javascript
// ADD: Cache cleanup on shutdown
if (global.shutdownManager) {
  global.shutdownManager.addCleanupTask('response_cache', async () => {
    console.log('💾 Stopping response cache...');
    responseCache.stopCleanupSchedule();
    
    // Log final cache stats
    const finalStats = responseCache.getStats();
    console.log('💾 Final cache stats:', finalStats);
  }, 3000);
}
```

## ⚠️ **Caching Notes**
- **🚨 IMPORTANT:** Caching reduces AI service costs
- **🚨 IMPORTANT:** Cache invalidation prevents stale responses
- **🚨 IMPORTANT:** Multi-tenant cache isolation essential
- **❌ DON'T SKIP:** This provides significant cost savings

## 🧪 **Testing After Implementation**
1. **Test cache functionality:**
   - Send identical requests and verify caching
   - Test cache expiration and cleanup

2. **Test cache isolation:**
   - Verify practice-specific caching
   - Test language-specific cache keys

3. **Test performance:**
   - Measure response time improvements
   - Monitor cache hit rates

## ✅ **Success Criteria**
- [ ] Response caching system operational
- [ ] Cache hit rate monitoring working
- [ ] Multi-tenant cache isolation functional
- [ ] Cache management endpoints active
- [ ] Cost reduction from cached responses
- [ ] Performance improvement measurable

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 3.11:** Add Backup AI Provider

## 📝 **CRITICAL NOTES**
- **REDUCES AI COSTS** - caching saves money on repeated queries
- **IMPROVES PERFORMANCE** - cached responses are faster
- **MAINTAINS ACCURACY** - proper cache invalidation essential
- **TEST THOROUGHLY** - verify cache isolation and performance gains
