/**
 * Claude Response Cache
 *
 * Caches responses for common queries to eliminate API calls
 * Saves 3-4 seconds per cached hit
 * Now uses Redis for persistent caching across sessions
 */

const crypto = require('crypto');
const redis = require('redis');

class ClaudeResponseCache {
  constructor() {
    // DEBUGGING MODE - DISABLE CACHE
    this.CACHING_DISABLED = true; // Set to false to re-enable

    this.client = null;
    this.connected = false;
    this.ttl = 10 * 60; // 10 minutes TTL in seconds (for Redis)

    // Track hit rate
    this.stats = {
      hits: 0,
      misses: 0,
      totalSaved: 0,
      invalidations: 0
    };

    // Common variations that should map to the same response
    this.normalizations = [
      { pattern: /show\s+me\s+(?:the\s+)?(?:list\s+of\s+)?(?:all\s+)?patie?n[tc]s?/i, normalized: 'list_patients' },
      { pattern: /list\s+(?:all\s+)?(?:the\s+)?patie?n[tc]s?/i, normalized: 'list_patients' },
      { pattern: /(?:get|fetch|display|show)\s+(?:all\s+)?patie?n[tc]s?/i, normalized: 'list_patients' },
      { pattern: /patie?n[tc]s?\s+list/i, normalized: 'list_patients' },
      { pattern: /הצג\s+(?:את\s+)?(?:רשימת\s+)?(?:כל\s+)?המטופלים/i, normalized: 'list_patients_he' },
      { pattern: /רשימת\s+מטופלים/i, normalized: 'list_patients_he' },
      { pattern: /(?:schedule|book|create)\s+(?:an?\s+)?appointment/i, normalized: 'schedule_appointment' },
      { pattern: /קבע\s+תור/i, normalized: 'schedule_appointment_he' },
      { pattern: /(?:add|create|new)\s+patie?n[tc]/i, normalized: 'add_patient' },
      { pattern: /הוסף\s+מטופל/i, normalized: 'add_patient_he' }
    ];

    // Initialize Redis connection
    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    // DEBUGGING - Skip Redis connection
    if (this.CACHING_DISABLED) {
      console.log('🚫 ClaudeResponseCache DISABLED for debugging');
      return;
    }

    if (this.connected) return;

    try {
      this.client = redis.createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error (ClaudeResponseCache):', err);
      });

      this.client.on('connect', () => {
        console.log('🔴 ClaudeResponseCache: Connecting to Redis...');
      });

      this.client.on('ready', () => {
        console.log('✅ ClaudeResponseCache: Connected to Redis');
        this.connected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.warn('⚠️ ClaudeResponseCache: Redis not available, responses won\'t be cached:', error.message);
      this.connected = false;
    }
  }

  /**
   * Generate cache key from query with smart normalization
   * Handles common variations while avoiding false positives
   */
  getCacheKey(query, sessionId, language) {
    // Handle null or undefined query
    if (!query) {
      console.warn('⚠️ Cache: query is null/undefined in getCacheKey');
      return null;
    }

    // Smart normalization to handle variations:
    let normalizedQuery = query
      .toLowerCase()           // Convert to lowercase
      .trim()                  // Remove leading/trailing whitespace
      .replace(/\s+/g, ' ')    // Normalize multiple spaces to single space
      .replace(/[.,!?]+$/g, '') // Remove trailing punctuation
      .replace(/^[.,!?]+/g, '') // Remove leading punctuation
      .replace(/\s*[.,!?]+\s*/g, ' ') // Replace punctuation with space in middle
      .replace(/\bthe\s+/g, '') // Remove common articles
      .replace(/\ba\s+/g, '')
      .replace(/\ban\s+/g, '')
      .replace(/\s+/g, ' ')    // Normalize spaces again
      .trim();                 // Final trim

    // Common typo corrections for medical terms
    const typoCorrections = {
      'patinet': 'patient',
      'patinets': 'patients',
      'paitent': 'patient',
      'paitents': 'patients',
      'patietn': 'patient',
      'patietns': 'patients',
      'apointment': 'appointment',
      'apointments': 'appointments',
      'appointmnet': 'appointment',
      'appointmnets': 'appointments',
      'mediacl': 'medical',
      'hisotry': 'history',
      'prescrition': 'prescription',
      'prescritions': 'prescriptions',
      'diagnosi': 'diagnosis',
      'symptom': 'symptoms',  // Normalize singular to plural
      'patient list': 'patients list',
      'show me patient': 'show me patients',
      'list patient': 'list patients',
      'get patient': 'get patients'
    };

    // Apply typo corrections
    for (const [typo, correct] of Object.entries(typoCorrections)) {
      const regex = new RegExp(`\\b${typo}\\b`, 'g');
      normalizedQuery = normalizedQuery.replace(regex, correct);
    }

    // Log the normalization for debugging
    if (query !== normalizedQuery) {
      console.log(`📝 Cache Key Normalization: "${query}" → "${normalizedQuery}"`);
    }

    // Create key data with normalized query
    const keyData = `claude:response:${normalizedQuery}:${language}`;

    // Create hash for consistent key
    return `claude:response:${crypto.createHash('md5').update(keyData).digest('hex')}`;
  }

  /**
   * DEPRECATED: Normalize query to catch variations
   * We now use the embedding server for semantic understanding
   * Keeping for reference only
   */
  normalizeQuery(query) {
    // Handle null or undefined query
    if (!query) {
      console.warn('⚠️ Cache: query is null/undefined in normalizeQuery');
      return '';
    }

    // NO LONGER USED - regex patterns caused cache collisions
    // The embedding server handles semantic similarity
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Check if response can be cached
   */
  isCacheable(query, actionTaken) {
    // Handle null or undefined query or actionTaken
    if (!query) {
      console.warn('⚠️ Cache: query is null/undefined, skipping cache');
      return false;
    }

    if (!actionTaken) {
      console.warn('⚠️ Cache: actionTaken is null/undefined, skipping cache');
      return false;
    }

    // NEVER cache chat-related operations - they change constantly
    const chatRelatedPatterns = [
      /chat/i,
      /message/i,
      /conversation/i,
      /reply/i,
      /respond/i,
      /שיחה/i,
      /הודעה/i,
      /תגובה/i
    ];

    // Check if it's a chat-related query
    const isChatRelated = chatRelatedPatterns.some(pattern =>
      pattern.test(query) || pattern.test(actionTaken)
    );

    if (isChatRelated) {
      console.log(`⏭️ Skipping cache for chat-related query: "${query.substring(0, 30)}..."`);
      return false;
    }

    // Pattern-based caching for ~933 functions (69% of all 1,352 functions)
    // Instead of maintaining a static list, use prefix patterns

    // Read-only operation prefixes (should be cacheable)
    const readOnlyPrefixes = [
      'get', 'list', 'search', 'find', 'retrieve', 'fetch',
      'check', 'view', 'display', 'show', 'count', 'calculate',
      'analyze', 'interpret', 'validate', 'verify', 'lookup',
      'query', 'extract', 'read', 'discover', 'detect',
      'identify', 'recognize', 'evaluate', 'assess', 'review',
      'inspect', 'examine', 'scan', 'browse', 'explore'
    ];

    // Write operation prefixes (should NOT be cacheable)
    const writeOperationPrefixes = [
      'create', 'add', 'insert', 'update', 'edit', 'modify',
      'delete', 'remove', 'schedule', 'book', 'cancel',
      'send', 'notify', 'generate', 'process', 'submit',
      'approve', 'reject', 'assign', 'unassign', 'transfer',
      'import', 'export', 'sync', 'merge', 'split',
      'enable', 'disable', 'activate', 'deactivate', 'toggle',
      'start', 'stop', 'pause', 'resume', 'reset',
      'register', 'unregister', 'subscribe', 'unsubscribe',
      'upload', 'download', 'save', 'restore', 'backup',
      'setup', 'configure', 'initialize', 'destroy', 'clear'
    ];

    // Normalize the action name for comparison
    const actionLower = actionTaken.toLowerCase();

    // Check if it's explicitly a write operation (never cache these)
    const isWriteOperation = writeOperationPrefixes.some(prefix =>
      actionLower.startsWith(prefix)
    );

    if (isWriteOperation) {
      return false;
    }

    // Check if it's a read-only operation (cache these)
    const isReadOnly = readOnlyPrefixes.some(prefix =>
      actionLower.startsWith(prefix)
    );

    // If not matching our patterns, default to not caching
    if (!isReadOnly) {
      return false;
    }

    // Don't cache if query contains specific IDs, dates, or session-specific content
    const noCachePatterns = [
      /\d{4}-\d{2}-\d{2}/, // Dates
      /[0-9a-f]{24}/i, // MongoDB ObjectIds
      /patient[_\s]?id/i,
      /today|tomorrow|yesterday/i,
      /next\s+week|last\s+week/i,
      /session[_\s]?id/i, // Session IDs
      /current\s+session/i, // Current session references
      /active\s+chat/i, // Active chat references
      /latest\s+message/i, // Latest message references
      /recent\s+conversation/i // Recent conversation references
    ];

    return !noCachePatterns.some(pattern => pattern.test(query));
  }

  /**
   * Check if a query should be excluded from caching
   */
  shouldExcludeFromCache(query) {
    if (!query) return false;

    const queryLower = query.toLowerCase();

    // Collections that should never be cached due to high change frequency
    const excludedTerms = [
      'session',           // Sessions collection
      'metrics',           // Any metrics collections
      'learning',          // Learning performance metrics
      'api_gateway',       // API gateway metrics
      'agent_memor',       // Agent memories
      'function_usage',    // Function usage stats
      'cache_metric',      // Cache metrics
      'performance_log',   // Performance logs
      'chat',              // Chat messages/sessions
      'message',           // Messages
      'conversation'       // Conversations
    ];

    // Check if query contains any excluded terms
    for (const term of excludedTerms) {
      if (queryLower.includes(term)) {
        console.log(`⏭️ Cache: Skipping cache for high-frequency collection query: ${term}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Get cached response from Redis
   */
  async get(query, sessionId, language) {
    // DEBUGGING - Skip cache
    if (this.CACHING_DISABLED) {
      return null;
    }

    if (!this.connected) return null;

    // Handle null or undefined query
    if (!query) {
      console.warn('⚠️ Cache: query is null/undefined in get');
      return null;
    }

    // Check if this query should be excluded from caching
    if (this.shouldExcludeFromCache(query)) {
      return null;
    }

    try {
      // When getting, we don't know the action yet, so we check without it
      const key = this.getCacheKey(query, sessionId, language);

      // Handle null key (from null query)
      if (!key) {
        return null;
      }
      const cached = await this.client.get(key);

      if (!cached) {
        this.stats.misses++;
        console.log(`❌ CACHE MISS for query: "${query ? query.substring(0, 50) : 'null'}..." (key: ${key.substring(0, 20)}...)`);
        return null;
      }

      const parsedCache = JSON.parse(cached);
      this.stats.hits++;
      this.stats.totalSaved += parsedCache.processingTime || 3000;

      console.log(`✅ REDIS CACHE HIT! Saved ${parsedCache.processingTime}ms`);
      console.log(`   Original query: "${query ? query.substring(0, 50) : 'null'}..."`);
      console.log(`   Cache key: ${key.substring(0, 30)}...`);

      // Return response with cache metadata
      return {
        ...parsedCache.response,
        fromCache: true,
        cachedAt: parsedCache.timestamp,
        originalProcessingTime: parsedCache.processingTime
      };
    } catch (error) {
      console.error('Redis get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Store response in Redis cache
   */
  async set(query, sessionId, language, response, processingTime) {
    // DEBUGGING - Skip cache
    if (this.CACHING_DISABLED) {
      return;
    }

    if (!this.connected) return;

    // Handle null or undefined query
    if (!query) {
      console.warn('⚠️ Cache: query is null/undefined in set');
      return;
    }

    // Check if this query should be excluded from caching
    if (this.shouldExcludeFromCache(query)) {
      return;
    }

    // Handle null or undefined response
    if (!response) {
      console.warn('⚠️ Cache: response is null/undefined in set');
      return;
    }

    // CRITICAL: Never cache actual error responses
    // Check for explicit error flag or success=false
    if (response.error === true || response.success === false) {
      console.log('⚠️ Skipping cache for error response (explicit error flag)');
      return;
    }

    // Only skip if message starts with error-indicating phrases
    if (response.message && typeof response.message === 'string') {
      const errorPhrases = [
        'Error:',
        'ERROR:',
        'Failed:',
        'FAILED:',
        'Security violation',
        'SECURITY VIOLATION',
        'Authentication failed',
        'Authorization failed'
      ];

      const hasErrorPhrase = errorPhrases.some(phrase =>
        response.message.startsWith(phrase) ||
        response.message.includes(`\n${phrase}`)
      );

      if (hasErrorPhrase) {
        console.log('⚠️ Skipping cache for error response (error phrase detected)');
        return;
      }
    }

    // Check if cacheable
    if (!this.isCacheable(query, response.actionTaken)) {
      return;
    }

    try {
      // Generate cache key from exact query (no normalization)
      const key = this.getCacheKey(query, sessionId, language);

      // Handle null key (from null query)
      if (!key) {
        return;
      }

      const cacheData = {
        response: {
          message: response.message,
          actionTaken: response.actionTaken,
          actionResult: response.actionResult,
          selectedFunctions: response.selectedFunctions,
          // CRITICAL: Include displayData and displayType for frontend rendering
          displayData: response.displayData,
          displayType: response.displayType
        },
        processingTime,
        timestamp: Date.now()
      };

      // Serialize the data to check size
      const serializedData = JSON.stringify(cacheData);
      const sizeInBytes = Buffer.byteLength(serializedData, 'utf8');
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

      // Log size for debugging
      console.log(`📊 Cache size for query "${query.substring(0, 30)}...": ${sizeInKB} KB (${sizeInBytes} bytes)`);

      // Warn if response is very large (over 5MB)
      if (sizeInBytes > 5 * 1024 * 1024) {
        console.warn(`⚠️ Large cache entry: ${sizeInMB} MB - This may impact performance`);
      }

      // Redis has a 512MB limit for string values, but we'll set a practical limit of 50MB
      const maxCacheSizeBytes = 50 * 1024 * 1024; // 50MB
      if (sizeInBytes > maxCacheSizeBytes) {
        console.error(`❌ Cache entry too large: ${sizeInMB} MB exceeds 50MB limit. Not caching.`);
        return;
      }

      // Store in Redis with TTL
      await this.client.setEx(key, this.ttl, serializedData);

      // Enhanced logging with size info
      const tokenEstimate = Math.round(sizeInBytes / 4); // Rough estimate: 1 token ≈ 4 bytes
      console.log(`💾 Redis cached [${response.actionTaken}]: "${query.substring(0, 30)}..." (${processingTime}ms, ${sizeInKB} KB, ~${tokenEstimate} tokens, TTL: ${this.ttl}s)`);

      // Log if this is a newly supported function (not in old static list)
      const oldStaticList = [
        'listAllPatients', 'getPatients', 'searchPatients', 'getPatientById',
        'getPatientDetails', 'getPatientHistory', 'getPatientCount'
      ];
      if (!oldStaticList.includes(response.actionTaken)) {
        console.log(`   ✨ Pattern-based caching enabled for: ${response.actionTaken}`);
      }
    } catch (error) {
      console.error('❌ Redis cache set failed:', error.message);
      console.error('   Full error:', error);

      // Log more details about what failed
      if (error.message.includes('ERR')) {
        console.error('   Redis error - might be a size or format issue');
      }
      if (error.message.includes('JSON')) {
        console.error('   JSON serialization error - response might contain circular references');
      }
    }
  }

  /**
   * Invalidate cache by collection name (will be called by Change Streams)
   */
  async invalidateByCollection(collectionName) {
    if (!this.connected) return;

    // Skip chat collections - they're never cached and don't need invalidation
    const chatCollections = [
      'chat_sessions', 'chat_messages', 'chatsessions', 'chatmessages',
      'conversations', 'messages', 'replies'
    ];

    if (chatCollections.includes(collectionName)) {
      // Silent skip - these aren't cached anyway
      return;
    }

    // Skip high-frequency collections that are never cached
    const highFrequencyCollections = [
      'sessions',
      'learning_performance_metrics',
      'api_gateway_metrics',
      'agent_memories',
      'function_usage_stats',
      'cache_metrics',
      'performance_logs'
    ];

    if (highFrequencyCollections.includes(collectionName)) {
      // Silent skip - these aren't cached anyway
      return;
    }

    try {
      // Map collection names to cache patterns - comprehensive coverage
      const collectionPatterns = {
        // Core user/patient collections
        'users': '*user*|*license*|*provider*|*role*|*profile*',
        'Users': '*user*|*license*|*provider*|*role*|*profile*',
        'patients': '*patient*|*medical*|*health*',

        // Appointment and scheduling
        'appointments': '*appointment*|*schedule*|*slot*|*meeting*',

        // Medical records and documents
        'documents': '*document*|*file*|*upload*|*pdf*',
        'medical_records': '*medical*|*record*|*history*',

        // Prescriptions and medications
        'prescriptions': '*prescription*|*medication*|*drug*|*rx*',
        'medications': '*medication*|*drug*|*medicine*',

        // Lab and diagnostic data
        'lab_results': '*lab*|*test*|*result*|*blood*',
        'diagnoses': '*diagnos*|*condition*|*icd*',
        'vitals': '*vital*|*pressure*|*temperature*|*pulse*',

        // Billing and financial
        'invoices': '*invoice*|*billing*|*charge*',
        'payments': '*payment*|*billing*|*transaction*',
        'insurance': '*insurance*|*claim*|*coverage*',

        // Provider and practice management
        'patient_provider': '*provider*|*doctor*|*physician*|*staff*',
        'practices': '*practice*|*clinic*|*facility*',

        // Communication and notes
        // NOTE: Chat collections excluded from caching entirely
        'notes': '*note*|*soap*|*progress*',

        // Referrals and care coordination
        'referrals': '*referral*|*refer*|*specialist*',
        'care_plans': '*care*|*plan*|*treatment*',

        // Allergies and conditions
        'allergies': '*allerg*|*reaction*|*sensitivity*',
        'conditions': '*condition*|*disease*|*disorder*',
        'problems': '*problem*|*issue*|*complaint*',

        // Immunizations and procedures
        'immunizations': '*immun*|*vaccine*|*shot*',
        'procedures': '*procedure*|*surgery*|*operation*',

        // Audit and compliance
        'audit_logs': '*audit*|*log*|*activity*',
        'consent_forms': '*consent*|*form*|*agreement*',

        // Service accounts and system
        'serviceaccounts': '*service*|*account*',
        'ServiceAccount': '*service*|*account*',

        // Action items and tasks
        'action_items': '*action*|*task*|*todo*',
        'reminders': '*remind*|*alert*|*notification*'
      };

      const pattern = collectionPatterns[collectionName] || `*${collectionName}*`;
      const patterns = pattern.split('|');

      let totalInvalidated = 0;
      for (const p of patterns) {
        const keys = await this.client.keys(`claude:response:${p}`);
        if (keys.length > 0) {
          await this.client.del(keys);
          totalInvalidated += keys.length;
        }
      }

      if (totalInvalidated > 0) {
        this.stats.invalidations += totalInvalidated;
        console.log(`🗑️ Change Stream: Invalidated ${totalInvalidated} cached responses after ${collectionName} change`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Clean expired entries (Redis handles this automatically with TTL)
   */
  cleanup() {
    // Redis handles expiration automatically with SETEX
    // This method is kept for compatibility but does nothing
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
      : 0;

    let size = 0;
    if (this.connected) {
      try {
        const keys = await this.client.keys('claude:response:*');
        size = keys.length;
      } catch (error) {
        console.error('Redis stats error:', error);
      }
    }

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size,
      connected: this.connected,
      ttlMinutes: this.ttl / 60,
      totalSavedSeconds: (this.stats.totalSaved / 1000).toFixed(1),
      cacheablePatterns: 30, // Number of read-only prefixes
      estimatedCacheableFunctions: 933, // ~69% of 1,352 functions
      coveragePercentage: '69%'
    };
  }

  /**
   * Clear cache
   */
  async clear() {
    if (!this.connected) return;

    try {
      const keys = await this.client.keys('claude:response:*');
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      console.log(`🗑️ Cleared ${keys.length} cached responses from Redis`);
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }
}

// Export singleton
module.exports = new ClaudeResponseCache();