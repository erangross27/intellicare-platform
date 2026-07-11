/**
 * Sequence Pattern Engine
 * 
 * Detects sequential patterns in user interactions and function calls.
 * Identifies common workflows and function sequences.
 */

const { LearningEventBusManager, LEARNING_EVENTS } = require('./learningEventBus');
const { LearningConfigManager } = require('./learningConfigService');

const serviceAccountManager = require('../serviceAccountManager');

class SequencePatternEngine {
  constructor() {
    this.serviceId = 'sequence-pattern-engine';
    this.eventBus = null;
    this.config = null;
    this.sequences = new Map(); // userId -> sequences
    this.patterns = new Map(); // pattern hash -> pattern data
    this.activeSequences = new Map(); // sessionId -> current sequence
    this.initialized = false;
    this.stats = {
      sequencesAnalyzed: 0,
      patternsDetected: 0,
      averageSequenceLength: 0
    };
  }

  async initialize() {
    if (this.initialized) return;

        // Authenticate service
        try {
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
        } catch (error) {
            console.error(`Failed to authenticate ${this.serviceId}:`, error.message);
        }
    
    try {
      // Get singleton instances
      this.eventBus = LearningEventBusManager.getInstance();
      this.config = LearningConfigManager.getInstance();
      
      // Subscribe to interaction events
      this.subscribeToEvents();
      
      // Load configuration
      this.loadConfig();
      
      // Start pattern detection interval
      this.startPatternDetection();
      
      this.initialized = true;
      console.log('✅ Sequence Pattern Engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Sequence Pattern Engine:', error);
      throw error;
    }
  }

  /**
   * Load configuration
   */
  loadConfig() {
    const patternConfig = this.config.getConfig('patterns');
    this.minSequenceLength = patternConfig?.minSequenceLength || 2;
    this.maxSequenceLength = patternConfig?.maxSequenceLength || 10;
    this.minFrequency = patternConfig?.minFrequency || 3;
    this.minConfidence = patternConfig?.minConfidence || 0.6;
    this.gapTolerance = 5; // Max gap between actions in seconds
  }

  /**
   * Subscribe to events
   */
  subscribeToEvents() {
    // Listen for captured interactions
    this.eventBus.subscribe(LEARNING_EVENTS.INTERACTION_CAPTURED, async (event) => {
      await this.processInteraction(event.data);
    });
    
    // Listen for function calls
    this.eventBus.subscribe(LEARNING_EVENTS.FUNCTION_CALLED, async (event) => {
      await this.processFunctionCall(event.data);
    });
    
    // Listen for session completions
    this.eventBus.subscribe(LEARNING_EVENTS.SESSION_COMPLETED, async (event) => {
      await this.finalizeSequence(event.data.sessionId);
    });
  }

  /**
   * Process an interaction
   */
  async processInteraction(interaction) {
    try {
      const sessionId = interaction.context?.sessionId;
      const userId = interaction.userId;
      
      if (!sessionId || !userId) return;
      
      // Get or create active sequence
      let sequence = this.activeSequences.get(sessionId);
      
      if (!sequence) {
        sequence = {
          sessionId: sessionId,
          userId: userId,
          practiceId: interaction.context?.practiceId,
          actions: [],
          startTime: new Date(),
          lastActionTime: new Date()
        };
        this.activeSequences.set(sessionId, sequence);
      }
      
      // Check for gap tolerance
      const timeSinceLastAction = (new Date() - sequence.lastActionTime) / 1000;
      
      if (timeSinceLastAction > this.gapTolerance) {
        // Gap too large, finalize current sequence and start new one
        await this.finalizeSequence(sessionId);
        
        sequence = {
          sessionId: sessionId,
          userId: userId,
          practiceId: interaction.context?.practiceId,
          actions: [],
          startTime: new Date(),
          lastActionTime: new Date()
        };
        this.activeSequences.set(sessionId, sequence);
      }
      
      // Add action to sequence
      sequence.actions.push({
        functionName: interaction.functionName,
        timestamp: interaction.timestamp,
        outcome: interaction.outcome,
        parameters: interaction.parameters
      });
      
      sequence.lastActionTime = new Date();
      
      // Check if sequence is getting too long
      if (sequence.actions.length >= this.maxSequenceLength) {
        await this.finalizeSequence(sessionId);
      }
      
    } catch (error) {
      console.error('Error processing interaction:', error);
    }
  }

  /**
   * Process a function call
   */
  async processFunctionCall(functionCall) {
    // Similar to processInteraction but specifically for function calls
    await this.processInteraction(functionCall);
  }

  /**
   * Finalize a sequence and detect patterns
   */
  async finalizeSequence(sessionId) {
    try {
      const sequence = this.activeSequences.get(sessionId);
      
      if (!sequence || sequence.actions.length < this.minSequenceLength) {
        this.activeSequences.delete(sessionId);
        return;
      }
      
      // Store sequence for user
      if (!this.sequences.has(sequence.userId)) {
        this.sequences.set(sequence.userId, []);
      }
      
      this.sequences.get(sequence.userId).push({
        ...sequence,
        endTime: new Date(),
        duration: new Date() - sequence.startTime
      });
      
      // Detect patterns in the sequence
      await this.detectPatterns(sequence);
      
      // Update stats
      this.stats.sequencesAnalyzed++;
      this.updateAverageLength(sequence.actions.length);
      
      // Remove from active sequences
      this.activeSequences.delete(sessionId);
      
    } catch (error) {
      console.error('Error finalizing sequence:', error);
    }
  }

  /**
   * Detect patterns in a sequence
   */
  async detectPatterns(sequence) {
    try {
      // Extract all subsequences
      const subsequences = this.extractSubsequences(sequence.actions);
      
      for (const subseq of subsequences) {
        const patternHash = this.hashSequence(subseq);
        
        // Get or create pattern
        let pattern = this.patterns.get(patternHash);
        
        if (!pattern) {
          pattern = {
            patternId: `pattern_${Date.now()}_${Math.random()}`,
            hash: patternHash,
            sequence: subseq.map(a => a.functionName),
            occurrences: [],
            frequency: 0,
            confidence: 0,
            users: new Set(),
            practices: new Set(),
            firstSeen: new Date(),
            lastSeen: new Date()
          };
          this.patterns.set(patternHash, pattern);
        }
        
        // Update pattern data
        pattern.occurrences.push({
          userId: sequence.userId,
          practiceId: sequence.practiceId,
          timestamp: new Date(),
          outcome: this.calculateSequenceOutcome(subseq)
        });
        
        pattern.frequency++;
        pattern.users.add(sequence.userId);
        pattern.practices.add(sequence.practiceId);
        pattern.lastSeen = new Date();
        pattern.confidence = this.calculatePatternConfidence(pattern);
        
        // Check if pattern meets threshold
        if (pattern.frequency >= this.minFrequency && 
            pattern.confidence >= this.minConfidence) {
          
          // Emit pattern detected event
          await this.emitPatternDetected(pattern, sequence);
          
          this.stats.patternsDetected++;
        }
      }
      
    } catch (error) {
      console.error('Error detecting patterns:', error);
    }
  }

  /**
   * Extract all possible subsequences
   */
  extractSubsequences(actions) {
    const subsequences = [];
    
    for (let length = this.minSequenceLength; length <= Math.min(this.maxSequenceLength, actions.length); length++) {
      for (let i = 0; i <= actions.length - length; i++) {
        subsequences.push(actions.slice(i, i + length));
      }
    }
    
    return subsequences;
  }

  /**
   * Hash a sequence for pattern matching
   */
  hashSequence(actions) {
    return actions.map(a => a.functionName).join('->');
  }

  /**
   * Calculate sequence outcome
   */
  calculateSequenceOutcome(actions) {
    const outcomes = actions.map(a => a.outcome);
    const successCount = outcomes.filter(o => o === 'success').length;
    const successRate = successCount / outcomes.length;
    
    if (successRate >= 0.8) return 'success';
    if (successRate >= 0.5) return 'partial';
    return 'failure';
  }

  /**
   * Calculate pattern confidence
   */
  calculatePatternConfidence(pattern) {
    if (pattern.occurrences.length === 0) return 0;
    
    const successfulOccurrences = pattern.occurrences.filter(o => o.outcome === 'success').length;
    const baseConfidence = successfulOccurrences / pattern.occurrences.length;
    
    // Boost confidence based on frequency and user diversity
    const frequencyBoost = Math.min(0.1, pattern.frequency / 100);
    const diversityBoost = Math.min(0.1, pattern.users.size / 10);
    
    return Math.min(1, baseConfidence + frequencyBoost + diversityBoost);
  }

  /**
   * Emit pattern detected event
   */
  async emitPatternDetected(pattern, sequence) {
    const patternData = {
      patternId: pattern.patternId,
      type: 'sequence',
      sequence: pattern.sequence,
      frequency: pattern.frequency,
      confidence: pattern.confidence,
      userId: sequence.userId,
      practiceId: sequence.practiceId,
      metadata: {
        userCount: pattern.users.size,
        practiceCount: pattern.practices.size,
        averageDuration: this.calculateAverageDuration(pattern),
        commonParameters: this.extractCommonParameters(pattern)
      }
    };
    
    await this.eventBus.emit(LEARNING_EVENTS.PATTERN_DETECTED, patternData);
    await this.eventBus.emit(LEARNING_EVENTS.SEQUENCE_FOUND, patternData);
  }

  /**
   * Find common patterns for a user
   */
  async findUserPatterns(userId, minConfidence = 0.6) {
    const userPatterns = [];
    
    for (const [hash, pattern] of this.patterns) {
      if (pattern.users.has(userId) && pattern.confidence >= minConfidence) {
        userPatterns.push({
          sequence: pattern.sequence,
          frequency: pattern.occurrences.filter(o => o.userId === userId).length,
          confidence: pattern.confidence,
          lastUsed: pattern.lastSeen
        });
      }
    }
    
    return userPatterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Find patterns across practice
   */
  async findClinicPatterns(practiceId, minFrequency = 5) {
    const clinicPatterns = [];
    
    for (const [hash, pattern] of this.patterns) {
      if (pattern.practices.has(practiceId) && pattern.frequency >= minFrequency) {
        clinicPatterns.push({
          sequence: pattern.sequence,
          frequency: pattern.frequency,
          confidence: pattern.confidence,
          userCount: pattern.users.size,
          metadata: {
            mostCommonUser: this.findMostCommonUser(pattern),
            peakUsageTime: this.findPeakUsageTime(pattern)
          }
        });
      }
    }
    
    return clinicPatterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Predict next action in sequence
   */
  predictNextAction(currentSequence) {
    const predictions = new Map();
    
    // Look for patterns that start with the current sequence
    for (const [hash, pattern] of this.patterns) {
      const patternStart = pattern.sequence.slice(0, currentSequence.length);
      
      if (this.sequencesMatch(patternStart, currentSequence)) {
        // Found a matching pattern
        if (pattern.sequence.length > currentSequence.length) {
          const nextAction = pattern.sequence[currentSequence.length];
          
          if (!predictions.has(nextAction)) {
            predictions.set(nextAction, {
              action: nextAction,
              confidence: 0,
              frequency: 0
            });
          }
          
          const prediction = predictions.get(nextAction);
          prediction.frequency += pattern.frequency;
          prediction.confidence = Math.max(prediction.confidence, pattern.confidence);
        }
      }
    }
    
    // Sort by confidence and frequency
    return Array.from(predictions.values())
      .sort((a, b) => (b.confidence * b.frequency) - (a.confidence * a.frequency))
      .slice(0, 5); // Top 5 predictions
  }

  /**
   * Check if two sequences match
   */
  sequencesMatch(seq1, seq2) {
    if (seq1.length !== seq2.length) return false;
    
    for (let i = 0; i < seq1.length; i++) {
      if (seq1[i] !== seq2[i]) return false;
    }
    
    return true;
  }

  /**
   * Start pattern detection interval
   */
  startPatternDetection() {
    // Periodically analyze patterns for insights
    this.detectionInterval = setInterval(() => {
      this.analyzePatternTrends();
    }, 60000); // Every minute
  }

  /**
   * Analyze pattern trends
   */
  async analyzePatternTrends() {
    try {
      // Find emerging patterns
      const emergingPatterns = this.findEmergingPatterns();
      
      // Find declining patterns
      const decliningPatterns = this.findDecliningPatterns();
      
      // Emit insights if significant trends found
      if (emergingPatterns.length > 0 || decliningPatterns.length > 0) {
        await this.eventBus.emit('pattern.trends.analyzed', {
          emerging: emergingPatterns,
          declining: decliningPatterns,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error('Error analyzing pattern trends:', error);
    }
  }

  /**
   * Find emerging patterns
   */
  findEmergingPatterns() {
    const emerging = [];
    const recentThreshold = Date.now() - (24 * 60 * 60 * 1000); // Last 24 hours
    
    for (const [hash, pattern] of this.patterns) {
      const recentOccurrences = pattern.occurrences.filter(
        o => new Date(o.timestamp) > recentThreshold
      ).length;
      
      const recentRate = recentOccurrences / pattern.frequency;
      
      if (recentRate > 0.5 && pattern.frequency >= 5) {
        emerging.push({
          sequence: pattern.sequence,
          growthRate: recentRate,
          frequency: pattern.frequency
        });
      }
    }
    
    return emerging;
  }

  /**
   * Find declining patterns
   */
  findDecliningPatterns() {
    const declining = [];
    const recentThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    for (const [hash, pattern] of this.patterns) {
      if (new Date(pattern.lastSeen) < recentThreshold && pattern.frequency >= 10) {
        declining.push({
          sequence: pattern.sequence,
          daysSinceLastSeen: Math.floor((Date.now() - new Date(pattern.lastSeen)) / (24 * 60 * 60 * 1000)),
          frequency: pattern.frequency
        });
      }
    }
    
    return declining;
  }

  /**
   * Helper methods
   */
  updateAverageLength(length) {
    const total = this.stats.averageSequenceLength * (this.stats.sequencesAnalyzed - 1) + length;
    this.stats.averageSequenceLength = total / this.stats.sequencesAnalyzed;
  }

  calculateAverageDuration(pattern) {
    // Placeholder - would calculate from stored sequence durations
    return 0;
  }

  extractCommonParameters(pattern) {
    // Placeholder - would extract common parameters from occurrences
    return {};
  }

  findMostCommonUser(pattern) {
    // Count occurrences per user
    const userCounts = {};
    
    for (const occurrence of pattern.occurrences) {
      userCounts[occurrence.userId] = (userCounts[occurrence.userId] || 0) + 1;
    }
    
    return Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  findPeakUsageTime(pattern) {
    // Placeholder - would analyze timestamps for peak usage
    return 'morning';
  }

  /**
   * Get engine statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalPatterns: this.patterns.size,
      activeSequences: this.activeSequences.size,
      totalUsers: new Set(Array.from(this.sequences.keys())).size
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }
    
    console.log('Sequence Pattern Engine shutdown complete');
  }
}

module.exports = new SequencePatternEngine();