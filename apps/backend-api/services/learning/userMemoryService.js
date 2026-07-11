/**
 * User Memory Service
 * 
 * Stores and manages user-specific learning patterns and preferences.
 * Personalizes the learning system for each individual user.
 */

const SecureDataAccess = require('../secureDataAccess');
const serviceAccountManager = require('../serviceAccountManager');
const learningDataAdapter = require('./learningDataAdapter');
const { LearningEventBusManager, LEARNING_EVENTS } = require('./learningEventBus');
const { LearningConfigManager } = require('./learningConfigService');

class UserMemoryService {
  constructor() {
    this.eventBus = null;
    this.config = null;
    this.dataAdapter = null;
    this.serviceToken = null;
    this.userMemories = new Map(); // userId -> memory data
    this.patternCache = new Map(); // userId -> cached patterns
    this.initialized = false;
    this.stats = {
      totalUsers: 0,
      totalPatterns: 0,
      averageConfidence: 0
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('user-memory-service');
      
      // Get singleton instances
      this.eventBus = LearningEventBusManager.getInstance();
      this.config = LearningConfigManager.getInstance();
      this.dataAdapter = learningDataAdapter;
      
      // Initialize data adapter
      await this.dataAdapter.initialize();
      
      // Subscribe to events
      this.subscribeToEvents();
      
      // Load existing user memories
      await this.loadUserMemories();
      
      // Start memory optimization
      this.startMemoryOptimization();
      
      this.initialized = true;
      console.log('✅ User Memory Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize User Memory Service:', error);
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  subscribeToEvents() {
    // Listen for all pattern detection events
    this.eventBus.subscribe(LEARNING_EVENTS.PATTERN_DETECTED, async (event) => {
      await this.storeUserPattern(event.data.userId, event.data);
    });
    
    this.eventBus.subscribe(LEARNING_EVENTS.SEQUENCE_FOUND, async (event) => {
      await this.updateSequencePattern(event.data.userId, event.data);
    });
    
    this.eventBus.subscribe(LEARNING_EVENTS.TEMPORAL_PATTERN_FOUND, async (event) => {
      await this.updateTemporalPattern(event.data.userId, event.data);
    });
    
    this.eventBus.subscribe(LEARNING_EVENTS.CONTEXT_PATTERN_FOUND, async (event) => {
      await this.updateContextPattern(event.data.userId, event.data);
    });
    
    // Listen for user interactions
    this.eventBus.subscribe(LEARNING_EVENTS.SUGGESTION_ACCEPTED, async (event) => {
      await this.reinforcePattern(event.data.userId, event.data.patternId);
    });
    
    this.eventBus.subscribe(LEARNING_EVENTS.SUGGESTION_REJECTED, async (event) => {
      await this.weakenPattern(event.data.userId, event.data.patternId);
    });
  }

  /**
   * Store a user pattern
   */
  async storeUserPattern(userId, pattern) {
    try {
      if (!userId) return;
      
      // Get or create user memory
      if (!this.userMemories.has(userId)) {
        this.userMemories.set(userId, {
          userId: userId,
          patterns: {
            sequences: [],
            temporal: [],
            contextual: [],
            procedural: []
          },
          preferences: {
            suggestionStyle: 'proactive', // 'proactive', 'reactive', 'minimal'
            learningSpeed: 'adaptive',
            automationLevel: 'medium'
          },
          statistics: {
            totalInteractions: 0,
            patternsLearned: 0,
            suggestionsAccepted: 0,
            suggestionsRejected: 0,
            averageConfidence: 0
          },
          metadata: {
            firstSeen: new Date(),
            lastActive: new Date(),
            practiceId: pattern.practiceId
          }
        });
      }
      
      const userMemory = this.userMemories.get(userId);
      
      // Store pattern based on type
      const patternData = {
        patternId: pattern.patternId || `pattern_${Date.now()}`,
        type: pattern.type,
        pattern: pattern.sequence || pattern.pattern,
        frequency: pattern.frequency || 1,
        confidence: pattern.confidence || 0.5,
        lastOccurrence: new Date(),
        metadata: pattern.metadata || {}
      };
      
      // Add to appropriate pattern category
      switch (pattern.type) {
        case 'sequence':
          userMemory.patterns.sequences.push(patternData);
          break;
        case 'temporal':
          userMemory.patterns.temporal.push(patternData);
          break;
        case 'contextual':
          userMemory.patterns.contextual.push(patternData);
          break;
        case 'procedural':
          userMemory.patterns.procedural.push(patternData);
          break;
        default:
          userMemory.patterns.sequences.push(patternData);
      }
      
      // Update statistics
      userMemory.statistics.patternsLearned++;
      userMemory.metadata.lastActive = new Date();
      
      // Clear cache for this user
      this.patternCache.delete(userId);
      
      // Persist to database
      await this.persistUserMemory(userId, userMemory);
      
      // Update global stats
      this.updateGlobalStats();
      
    } catch (error) {
      console.error(`Error storing pattern for user ${userId}:`, error);
    }
  }

  /**
   * Get user patterns
   */
  async getUserPatterns(userId, options = {}) {
    try {
      // Check cache first
      if (this.patternCache.has(userId)) {
        return this.patternCache.get(userId);
      }
      
      const userMemory = this.userMemories.get(userId);
      
      if (!userMemory) {
        return null;
      }
      
      // Filter and rank patterns
      const patterns = this.filterAndRankPatterns(userMemory.patterns, options);
      
      // Cache the result
      this.patternCache.set(userId, patterns);
      
      return patterns;
      
    } catch (error) {
      console.error(`Error getting patterns for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update pattern confidence
   */
  async updatePatternConfidence(patternId, confidence, userId = null) {
    try {
      if (userId) {
        const userMemory = this.userMemories.get(userId);
        if (userMemory) {
          // Find and update pattern
          for (const category of Object.values(userMemory.patterns)) {
            const pattern = category.find(p => p.patternId === patternId);
            if (pattern) {
              pattern.confidence = confidence;
              pattern.lastUpdated = new Date();
              break;
            }
          }
          
          // Clear cache
          this.patternCache.delete(userId);
          
          // Persist changes
          await this.persistUserMemory(userId, userMemory);
        }
      } else {
        // Update across all users
        for (const [uid, memory] of this.userMemories) {
          for (const category of Object.values(memory.patterns)) {
            const pattern = category.find(p => p.patternId === patternId);
            if (pattern) {
              pattern.confidence = confidence;
              pattern.lastUpdated = new Date();
              
              // Clear cache
              this.patternCache.delete(uid);
              
              // Persist changes
              await this.persistUserMemory(uid, memory);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error updating pattern confidence:', error);
    }
  }

  /**
   * Get user preferences
   */
  getUserPreferences(userId) {
    const userMemory = this.userMemories.get(userId);
    return userMemory?.preferences || {
      suggestionStyle: 'proactive',
      learningSpeed: 'adaptive',
      automationLevel: 'medium'
    };
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId, preferences) {
    try {
      const userMemory = this.userMemories.get(userId);
      
      if (userMemory) {
        userMemory.preferences = {
          ...userMemory.preferences,
          ...preferences
        };
        
        await this.persistUserMemory(userId, userMemory);
      }
      
    } catch (error) {
      console.error(`Error updating preferences for user ${userId}:`, error);
    }
  }

  /**
   * Get user learning statistics
   */
  getUserStatistics(userId) {
    const userMemory = this.userMemories.get(userId);
    
    if (!userMemory) {
      return null;
    }
    
    // Calculate additional statistics
    const stats = {
      ...userMemory.statistics,
      acceptanceRate: userMemory.statistics.suggestionsAccepted / 
                      (userMemory.statistics.suggestionsAccepted + userMemory.statistics.suggestionsRejected) || 0,
      patternTypes: {
        sequences: userMemory.patterns.sequences.length,
        temporal: userMemory.patterns.temporal.length,
        contextual: userMemory.patterns.contextual.length,
        procedural: userMemory.patterns.procedural.length
      },
      topPatterns: this.getTopPatterns(userMemory.patterns, 5)
    };
    
    return stats;
  }

  /**
   * Get personalized suggestions
   */
  async getPersonalizedSuggestions(userId, context) {
    try {
      const userMemory = this.userMemories.get(userId);
      
      if (!userMemory) {
        return [];
      }
      
      const suggestions = [];
      
      // Get relevant patterns based on context
      const relevantPatterns = this.findRelevantPatterns(userMemory.patterns, context);
      
      // Generate suggestions based on user preferences
      const preferences = userMemory.preferences;
      
      for (const pattern of relevantPatterns) {
        if (this.shouldSuggest(pattern, preferences)) {
          suggestions.push({
            type: pattern.type,
            action: this.formatSuggestion(pattern),
            confidence: pattern.confidence,
            reason: this.explainSuggestion(pattern, context),
            patternId: pattern.patternId
          });
        }
      }
      
      // Sort by confidence and relevance
      suggestions.sort((a, b) => b.confidence - a.confidence);
      
      // Limit based on user preference
      const maxSuggestions = preferences.suggestionStyle === 'proactive' ? 5 :
                            preferences.suggestionStyle === 'reactive' ? 3 : 1;
      
      return suggestions.slice(0, maxSuggestions);
      
    } catch (error) {
      console.error(`Error getting suggestions for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Update sequence pattern
   */
  async updateSequencePattern(userId, sequenceData) {
    await this.storeUserPattern(userId, {
      ...sequenceData,
      type: 'sequence'
    });
  }

  /**
   * Update temporal pattern
   */
  async updateTemporalPattern(userId, temporalData) {
    await this.storeUserPattern(userId, {
      ...temporalData,
      type: 'temporal'
    });
  }

  /**
   * Update context pattern
   */
  async updateContextPattern(userId, contextData) {
    await this.storeUserPattern(userId, {
      ...contextData,
      type: 'contextual'
    });
  }

  /**
   * Reinforce a pattern
   */
  async reinforcePattern(userId, patternId) {
    try {
      const userMemory = this.userMemories.get(userId);
      
      if (userMemory) {
        // Find pattern and increase confidence
        for (const category of Object.values(userMemory.patterns)) {
          const pattern = category.find(p => p.patternId === patternId);
          if (pattern) {
            pattern.confidence = Math.min(1, pattern.confidence * 1.1);
            pattern.frequency++;
            pattern.lastReinforced = new Date();
            break;
          }
        }
        
        // Update statistics
        userMemory.statistics.suggestionsAccepted++;
        
        // Clear cache
        this.patternCache.delete(userId);
        
        // Persist changes
        await this.persistUserMemory(userId, userMemory);
      }
      
    } catch (error) {
      console.error(`Error reinforcing pattern for user ${userId}:`, error);
    }
  }

  /**
   * Weaken a pattern
   */
  async weakenPattern(userId, patternId) {
    try {
      const userMemory = this.userMemories.get(userId);
      
      if (userMemory) {
        // Find pattern and decrease confidence
        for (const category of Object.values(userMemory.patterns)) {
          const pattern = category.find(p => p.patternId === patternId);
          if (pattern) {
            pattern.confidence = Math.max(0, pattern.confidence * 0.9);
            pattern.lastWeakened = new Date();
            break;
          }
        }
        
        // Update statistics
        userMemory.statistics.suggestionsRejected++;
        
        // Clear cache
        this.patternCache.delete(userId);
        
        // Persist changes
        await this.persistUserMemory(userId, userMemory);
      }
      
    } catch (error) {
      console.error(`Error weakening pattern for user ${userId}:`, error);
    }
  }

  /**
   * Load user memories from database
   */
  async loadUserMemories() {
    try {
      const context = {
        serviceId: 'user-memory-service',
        operation: 'load-memories',
        practiceId: 'global',
        apiKey: this.serviceToken?.apiKey
      };
      
      const memories = await this.dataAdapter.retrieveLearningData(
        'user_learning_patterns',
        {},
        { limit: 10000 },
        context
      );
      
      for (const memory of memories) {
        this.userMemories.set(memory.userId, memory);
      }
      
      console.log(`Loaded ${memories.length} user memories from database`);
      
      this.stats.totalUsers = memories.length;
      
    } catch (error) {
      console.error('Error loading user memories:', error);
    }
  }

  /**
   * Persist user memory to database
   */
  async persistUserMemory(userId, memory) {
    try {
      const context = {
        serviceId: 'user-memory-service',
        operation: 'store-memory',
        practiceId: memory.metadata?.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey
      };
      
      // Check if exists
      const existing = await this.dataAdapter.retrieveLearningData(
        'user_learning_patterns',
        { userId: userId },
        { limit: 1 },
        context
      );
      
      if (existing && existing.length > 0) {
        // Update existing
        await SecureDataAccess.update(
          'user_learning_patterns',
          { userId: userId },
          memory,
          context
        );
      } else {
        // Create new
        await this.dataAdapter.storeLearningData(
          'user_learning_patterns',
          memory,
          context
        );
      }
      
    } catch (error) {
      console.error(`Error persisting memory for user ${userId}:`, error);
    }
  }

  /**
   * Filter and rank patterns
   */
  filterAndRankPatterns(patterns, options) {
    const allPatterns = [
      ...patterns.sequences,
      ...patterns.temporal,
      ...patterns.contextual,
      ...patterns.procedural
    ];
    
    // Apply filters
    let filtered = allPatterns;
    
    if (options.minConfidence) {
      filtered = filtered.filter(p => p.confidence >= options.minConfidence);
    }
    
    if (options.type) {
      filtered = filtered.filter(p => p.type === options.type);
    }
    
    if (options.recentOnly) {
      const threshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
      filtered = filtered.filter(p => new Date(p.lastOccurrence) > threshold);
    }
    
    // Rank patterns
    filtered.sort((a, b) => {
      const scoreA = (a.confidence * 0.5) + (a.frequency * 0.3) + (this.recencyScore(a) * 0.2);
      const scoreB = (b.confidence * 0.5) + (b.frequency * 0.3) + (this.recencyScore(b) * 0.2);
      return scoreB - scoreA;
    });
    
    return filtered;
  }

  /**
   * Calculate recency score
   */
  recencyScore(pattern) {
    const daysSinceOccurrence = (Date.now() - new Date(pattern.lastOccurrence)) / (24 * 60 * 60 * 1000);
    return Math.max(0, 1 - daysSinceOccurrence / 30);
  }

  /**
   * Get top patterns
   */
  getTopPatterns(patterns, count = 5) {
    const allPatterns = [
      ...patterns.sequences,
      ...patterns.temporal,
      ...patterns.contextual,
      ...patterns.procedural
    ];
    
    return allPatterns
      .sort((a, b) => (b.confidence * b.frequency) - (a.confidence * a.frequency))
      .slice(0, count)
      .map(p => ({
        type: p.type,
        pattern: p.pattern,
        confidence: p.confidence,
        frequency: p.frequency
      }));
  }

  /**
   * Find relevant patterns
   */
  findRelevantPatterns(patterns, context) {
    const relevant = [];
    
    // Check each pattern category for relevance
    for (const sequence of patterns.sequences) {
      if (this.isSequenceRelevant(sequence, context)) {
        relevant.push(sequence);
      }
    }
    
    for (const temporal of patterns.temporal) {
      if (this.isTemporalRelevant(temporal, context)) {
        relevant.push(temporal);
      }
    }
    
    for (const contextual of patterns.contextual) {
      if (this.isContextualRelevant(contextual, context)) {
        relevant.push(contextual);
      }
    }
    
    return relevant;
  }

  /**
   * Check if sequence is relevant
   */
  isSequenceRelevant(sequence, context) {
    if (!context.currentSequence) return false;
    
    // Check if current sequence matches pattern start
    const patternStart = sequence.pattern.slice(0, context.currentSequence.length);
    return JSON.stringify(patternStart) === JSON.stringify(context.currentSequence);
  }

  /**
   * Check if temporal pattern is relevant
   */
  isTemporalRelevant(temporal, context) {
    if (!context.currentTime) return false;
    
    const currentHour = new Date(context.currentTime).getHours();
    const currentDay = new Date(context.currentTime).getDay();
    
    // Check if pattern matches current time
    return temporal.metadata?.preferredHours?.includes(currentHour) ||
           temporal.metadata?.preferredDays?.includes(currentDay);
  }

  /**
   * Check if contextual pattern is relevant
   */
  isContextualRelevant(contextual, context) {
    if (!contextual.metadata?.context) return false;
    
    // Check context similarity
    const similarity = this.calculateContextSimilarity(contextual.metadata.context, context);
    return similarity > 0.7;
  }

  /**
   * Calculate context similarity
   */
  calculateContextSimilarity(context1, context2) {
    const keys1 = Object.keys(context1);
    const keys2 = Object.keys(context2);
    const allKeys = new Set([...keys1, ...keys2]);
    
    let matches = 0;
    for (const key of allKeys) {
      if (context1[key] === context2[key]) matches++;
    }
    
    return matches / allKeys.size;
  }

  /**
   * Should suggest based on preferences
   */
  shouldSuggest(pattern, preferences) {
    // Check confidence threshold based on automation level
    const confidenceThreshold = preferences.automationLevel === 'high' ? 0.5 :
                                preferences.automationLevel === 'medium' ? 0.7 : 0.9;
    
    return pattern.confidence >= confidenceThreshold;
  }

  /**
   * Format suggestion for display
   */
  formatSuggestion(pattern) {
    if (pattern.type === 'sequence') {
      return `Continue with: ${pattern.pattern[pattern.pattern.length - 1]}`;
    } else if (pattern.type === 'temporal') {
      return `Common task for this time: ${pattern.pattern}`;
    } else {
      return `Suggested action: ${pattern.pattern}`;
    }
  }

  /**
   * Explain suggestion
   */
  explainSuggestion(pattern, context) {
    const frequency = pattern.frequency;
    const confidence = Math.round(pattern.confidence * 100);
    
    if (pattern.type === 'sequence') {
      return `You often follow this sequence (${frequency} times, ${confidence}% success)`;
    } else if (pattern.type === 'temporal') {
      return `You typically do this at ${context.currentTime} (${frequency} times)`;
    } else {
      return `Based on similar context (${confidence}% confidence)`;
    }
  }

  /**
   * Update global statistics
   */
  updateGlobalStats() {
    this.stats.totalUsers = this.userMemories.size;
    
    let totalPatterns = 0;
    let totalConfidence = 0;
    
    for (const [userId, memory] of this.userMemories) {
      const allPatterns = [
        ...memory.patterns.sequences,
        ...memory.patterns.temporal,
        ...memory.patterns.contextual,
        ...memory.patterns.procedural
      ];
      
      totalPatterns += allPatterns.length;
      totalConfidence += allPatterns.reduce((sum, p) => sum + p.confidence, 0);
    }
    
    this.stats.totalPatterns = totalPatterns;
    this.stats.averageConfidence = totalPatterns > 0 ? totalConfidence / totalPatterns : 0;
  }

  /**
   * Start memory optimization
   */
  startMemoryOptimization() {
    this.optimizationInterval = setInterval(() => {
      this.optimizeMemories();
    }, 3600000); // Every hour
  }

  /**
   * Optimize memories
   */
  async optimizeMemories() {
    try {
      for (const [userId, memory] of this.userMemories) {
        // Remove low-confidence patterns
        for (const category of Object.values(memory.patterns)) {
          const before = category.length;
          category = category.filter(p => p.confidence > 0.1);
          
          if (category.length < before) {
            console.log(`Removed ${before - category.length} low-confidence patterns for user ${userId}`);
          }
        }
        
        // Limit pattern count per category
        const maxPatternsPerCategory = 100;
        for (const [key, category] of Object.entries(memory.patterns)) {
          if (category.length > maxPatternsPerCategory) {
            // Keep only top patterns
            memory.patterns[key] = category
              .sort((a, b) => (b.confidence * b.frequency) - (a.confidence * a.frequency))
              .slice(0, maxPatternsPerCategory);
          }
        }
        
        // Clear stale cache
        this.patternCache.delete(userId);
      }
      
    } catch (error) {
      console.error('Error optimizing memories:', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.patternCache.size,
      memorySize: this.userMemories.size
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
    
    console.log('User Memory Service shutdown complete');
  }
}

module.exports = new UserMemoryService();