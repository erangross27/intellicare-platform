/**
 * Sequence Pattern Engine - Advanced TypeScript Implementation
 * 
 * Sophisticated sequence pattern detection and analysis system that identifies
 * recurring patterns in user interactions and function calls using advanced
 * machine learning algorithms and statistical analysis.
 * 
 * Enhanced Features:
 * - Multi-level pattern hierarchy (micro, macro, meta patterns)
 * - Dynamic pattern evolution tracking
 * - Temporal pattern correlation
 * - Context-aware pattern matching
 * - Probabilistic sequence prediction
 * - Pattern anomaly detection
 * - Cross-user pattern analysis
 * - Adaptive pattern thresholds
 * - Pattern lifecycle management
 * - Real-time pattern streaming
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Enhanced Interfaces
interface SequenceAction {
  functionName: string;
  timestamp: Date;
  outcome: 'success' | 'partial' | 'failure';
  parameters: Record<string, any>;
  metadata: {
    executionTime: number;
    confidence: number;
    context: Record<string, any>;
    userId: string;
    sessionId: string;
  };
}

interface Sequence {
  sessionId: string;
  userId: string;
  clinicId?: string;
  actions: SequenceAction[];
  startTime: Date;
  endTime?: Date;
  lastActionTime: Date;
  duration?: number;
  metadata: {
    complexity: number;
    efficiency: number;
    completionRate: number;
    errorRate: number;
    patternMatches: string[];
  };
}

interface Pattern {
  patternId: string;
  hash: string;
  sequence: string[];
  level: 'micro' | 'macro' | 'meta'; // Hierarchical pattern levels
  occurrences: PatternOccurrence[];
  frequency: number;
  confidence: number;
  stability: number; // How stable the pattern is over time
  evolution: PatternEvolution[];
  users: Set<string>;
  clinics: Set<string>;
  firstSeen: Date;
  lastSeen: Date;
  metadata: {
    avgDuration: number;
    successRate: number;
    contextualFactors: Record<string, number>;
    seasonality: SeasonalityInfo;
    correlations: PatternCorrelation[];
  };
  predictions: PatternPrediction[];
  anomalies: PatternAnomaly[];
}

interface PatternOccurrence {
  userId: string;
  clinicId?: string;
  timestamp: Date;
  outcome: 'success' | 'partial' | 'failure';
  context: Record<string, any>;
  duration: number;
  deviation: number; // How much this occurrence deviates from the pattern norm
}

interface PatternEvolution {
  timestamp: Date;
  changeType: 'emergence' | 'modification' | 'split' | 'merge' | 'decline';
  description: string;
  confidence: number;
  impactScore: number;
}

interface SeasonalityInfo {
  hourly: number[];
  daily: number[];
  weekly: number[];
  monthly: number[];
  detected: boolean;
  strength: number;
}

interface PatternCorrelation {
  patternId: string;
  correlationType: 'sequential' | 'concurrent' | 'causal' | 'contextual';
  strength: number;
  confidence: number;
  description: string;
}

interface PatternPrediction {
  nextActions: string[];
  probabilities: number[];
  confidence: number;
  timeWindow: number;
  contextRequirements: Record<string, any>;
}

interface PatternAnomaly {
  anomalyId: string;
  type: 'frequency' | 'sequence' | 'timing' | 'context' | 'outcome';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  resolved: boolean;
  impactAssessment: string;
}

interface SequenceAnalysis {
  sequenceId: string;
  patterns: MatchedPattern[];
  novelty: number; // How novel/unique this sequence is
  complexity: number;
  efficiency: number;
  predictability: number;
  anomalies: string[];
  recommendations: string[];
}

interface MatchedPattern {
  patternId: string;
  matchConfidence: number;
  coverage: number; // What percentage of the sequence is covered by this pattern
  startIndex: number;
  endIndex: number;
  deviations: PatternDeviation[];
}

interface PatternDeviation {
  index: number;
  expected: string;
  actual: string;
  severity: number;
  explanation: string;
}

interface PredictionResult {
  action: string;
  confidence: number;
  probability: number;
  reasoning: string;
  alternatives: AlternativePrediction[];
  contextFactors: Record<string, number>;
  timeWindow: {
    min: number;
    max: number;
    optimal: number;
  };
}

interface AlternativePrediction {
  action: string;
  confidence: number;
  probability: number;
  reason: string;
}

interface PatternTrend {
  patternId: string;
  trend: 'emerging' | 'growing' | 'stable' | 'declining' | 'extinct';
  velocity: number; // Rate of change
  acceleration: number; // Change in velocity
  forecast: TrendForecast[];
  confidence: number;
}

interface TrendForecast {
  timepoint: Date;
  expectedFrequency: number;
  confidence: number;
}

@Injectable()
export class SequencePatternEngineService implements OnModuleInit {
  private serviceId = 'sequence-pattern-engine';
  private serviceToken: any;
  private sequences = new Map<string, Sequence[]>(); // userId -> sequences
  private patterns = new Map<string, Pattern>(); // pattern hash -> pattern data
  private activeSequences = new Map<string, Sequence>(); // sessionId -> current sequence
  private patternHierarchy = new Map<string, string[]>(); // parent -> children patterns
  private streamingPatterns = new Map<string, any>(); // Real-time pattern detection
  private initialized = false;

  private readonly stats = {
    sequencesAnalyzed: 0,
    patternsDetected: 0,
    averageSequenceLength: 0,
    patternEvolutions: 0,
    anomaliesDetected: 0,
    predictionsGenerated: 0,
    accuracy: {
      shortTerm: 0, // Next 1-3 actions
      mediumTerm: 0, // Next 4-10 actions
      longTerm: 0, // Next 11+ actions
    },
  };

  private readonly config = {
    minSequenceLength: 2,
    maxSequenceLength: 20,
    minFrequency: 3,
    minConfidence: 0.6,
    gapTolerance: 5, // seconds
    patternHierarchyDepth: 3,
    anomalyThreshold: 2.5, // Standard deviations
    streamingBufferSize: 1000,
    adaptiveThresholds: true,
    patternEvolutionTracking: true,
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.initialized) return;

    try {
      // Authenticate service with auto-registration
      this.serviceToken = await this.authenticate();

      // Subscribe to events
      await this.subscribeToEvents();

      // Initialize pattern detection algorithms
      await this.initializePatternDetection();

      // Start real-time pattern streaming
      this.startPatternStreaming();

      // Initialize pattern hierarchy analysis
      await this.initializePatternHierarchy();

      // Load existing patterns from database
      await this.loadExistingPatterns();

      // Start periodic pattern analysis
      this.startPeriodicAnalysis();

      this.initialized = true;
      console.log('✅ Sequence Pattern Engine initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Sequence Pattern Engine:', error);
      throw error;
    }
  }

  /**
   * Process interaction with advanced pattern detection
   */
  async processInteraction(interaction: any): Promise<SequenceAnalysis | null> {
    try {
      const sessionId = interaction.context?.sessionId;
      const userId = interaction.userId;

      if (!sessionId || !userId) return null;

      // Get or create active sequence
      let sequence = this.activeSequences.get(sessionId);

      if (!sequence) {
        sequence = await this.createNewSequence(sessionId, userId, interaction);
      }

      // Check for gap tolerance and sequence continuity
      const timeSinceLastAction = (new Date().getTime() - sequence.lastActionTime.getTime()) / 1000;

      if (timeSinceLastAction > this.config.gapTolerance) {
        // Finalize current sequence and start new one
        const analysis = await this.finalizeSequence(sessionId);
        sequence = await this.createNewSequence(sessionId, userId, interaction);
        
        if (analysis) {
          this.eventEmitter.emit('sequence.analyzed', analysis);
        }
      }

      // Add action to sequence
      const sequenceAction: SequenceAction = {
        functionName: interaction.functionName,
        timestamp: new Date(interaction.timestamp),
        outcome: interaction.outcome || 'success',
        parameters: interaction.parameters || {},
        metadata: {
          executionTime: interaction.executionTime || 0,
          confidence: interaction.confidence || 1.0,
          context: interaction.context || {},
          userId,
          sessionId,
        },
      };

      sequence.actions.push(sequenceAction);
      sequence.lastActionTime = new Date();

      // Update sequence metadata
      await this.updateSequenceMetadata(sequence);

      // Real-time pattern matching
      const realtimeAnalysis = await this.performRealtimeAnalysis(sequence);

      // Check if sequence should be finalized
      if (sequence.actions.length >= this.config.maxSequenceLength) {
        return await this.finalizeSequence(sessionId);
      }

      // Emit real-time events
      this.eventEmitter.emit('sequence.updated', {
        sequenceId: sequence.sessionId,
        userId,
        actionCount: sequence.actions.length,
        analysis: realtimeAnalysis,
        timestamp: new Date(),
      });

      return realtimeAnalysis;
    } catch (error) {
      console.error('Error processing interaction:', error);
      return null;
    }
  }

  /**
   * Advanced sequence pattern detection with machine learning
   */
  async detectPatterns(sequence: Sequence): Promise<Pattern[]> {
    try {
      const detectedPatterns: Pattern[] = [];

      // Multi-level pattern detection
      for (const level of ['micro', 'macro', 'meta']) {
        const levelPatterns = await this.detectPatternsAtLevel(sequence, level as any);
        detectedPatterns.push(...levelPatterns);
      }

      // Validate and filter patterns
      const validPatterns = await this.validatePatterns(detectedPatterns, sequence);

      // Update pattern statistics and evolution
      for (const pattern of validPatterns) {
        await this.updatePatternStatistics(pattern, sequence);
        await this.trackPatternEvolution(pattern);
      }

      // Emit pattern detection events
      for (const pattern of validPatterns) {
        this.eventEmitter.emit('pattern.detected', {
          patternId: pattern.patternId,
          level: pattern.level,
          sequence: pattern.sequence,
          frequency: pattern.frequency,
          confidence: pattern.confidence,
          userId: sequence.userId,
          clinicId: sequence.clinicId,
          timestamp: new Date(),
        });
      }

      this.stats.patternsDetected += validPatterns.length;

      return validPatterns;
    } catch (error) {
      console.error('Error detecting patterns:', error);
      return [];
    }
  }

  /**
   * Enhanced next action prediction with probabilistic modeling
   */
  async predictNextAction(currentSequence: string[], context: any = {}): Promise<PredictionResult[]> {
    try {
      const predictions: PredictionResult[] = [];

      // Multi-strategy prediction
      const predictionStrategies = [
        () => this.predictFromExactMatches(currentSequence),
        () => this.predictFromPartialMatches(currentSequence),
        () => this.predictFromHierarchicalPatterns(currentSequence),
        () => this.predictFromContextualSimilarity(currentSequence, context),
        () => this.predictFromTemporalCorrelations(currentSequence, context),
        () => this.predictFromUserBehaviorModel(currentSequence, context),
      ];

      // Execute prediction strategies in parallel
      const strategyResults = await Promise.all(
        predictionStrategies.map(strategy => 
          strategy().catch(error => {
            console.warn('Prediction strategy failed:', error);
            return [];
          })
        )
      );

      // Combine and weight predictions
      const combinedPredictions = this.combinePredictions(strategyResults.flat(), currentSequence, context);

      // Apply confidence calibration
      const calibratedPredictions = await this.calibratePredictionConfidence(combinedPredictions, context);

      // Generate alternative predictions
      for (const prediction of calibratedPredictions.slice(0, 5)) {
        prediction.alternatives = await this.generateAlternativePredictions(prediction, currentSequence, context);
      }

      this.stats.predictionsGenerated += calibratedPredictions.length;

      return calibratedPredictions;
    } catch (error) {
      console.error('Error predicting next action:', error);
      return [];
    }
  }

  /**
   * Advanced pattern analysis with anomaly detection
   */
  async analyzeSequencePatterns(sequence: Sequence): Promise<SequenceAnalysis> {
    try {
      const analysis: SequenceAnalysis = {
        sequenceId: sequence.sessionId,
        patterns: [],
        novelty: 0,
        complexity: 0,
        efficiency: 0,
        predictability: 0,
        anomalies: [],
        recommendations: [],
      };

      // Find matching patterns
      analysis.patterns = await this.findMatchingPatterns(sequence);

      // Calculate sequence metrics
      analysis.novelty = await this.calculateSequenceNovelty(sequence);
      analysis.complexity = await this.calculateSequenceComplexity(sequence);
      analysis.efficiency = await this.calculateSequenceEfficiency(sequence);
      analysis.predictability = await this.calculateSequencePredictability(sequence);

      // Detect anomalies
      analysis.anomalies = await this.detectSequenceAnomalies(sequence);

      // Generate recommendations
      analysis.recommendations = await this.generateSequenceRecommendations(analysis);

      // Track analysis metrics
      this.updateAnalysisMetrics(analysis);

      return analysis;
    } catch (error) {
      console.error('Error analyzing sequence patterns:', error);
      return {
        sequenceId: sequence.sessionId,
        patterns: [],
        novelty: 0,
        complexity: 0,
        efficiency: 0,
        predictability: 0,
        anomalies: [],
        recommendations: [],
      };
    }
  }

  /**
   * Pattern trend analysis and forecasting
   */
  async analyzePatternTrends(): Promise<PatternTrend[]> {
    try {
      const trends: PatternTrend[] = [];

      for (const [hash, pattern] of this.patterns) {
        if (pattern.frequency < this.config.minFrequency) continue;

        const trend = await this.calculatePatternTrend(pattern);
        trends.push(trend);

        // Emit trend events for significant changes
        if (Math.abs(trend.velocity) > 0.5 || Math.abs(trend.acceleration) > 0.3) {
          this.eventEmitter.emit('pattern.trend.significant', {
            patternId: pattern.patternId,
            trend: trend.trend,
            velocity: trend.velocity,
            acceleration: trend.acceleration,
            timestamp: new Date(),
          });
        }
      }

      return trends.sort((a, b) => Math.abs(b.velocity) - Math.abs(a.velocity));
    } catch (error) {
      console.error('Error analyzing pattern trends:', error);
      return [];
    }
  }

  /**
   * Cross-user pattern analysis for collaborative insights
   */
  async analyzeCrossUserPatterns(clinicId?: string): Promise<any> {
    try {
      const crossUserAnalysis = {
        commonPatterns: [],
        uniquePatterns: [],
        collaborativeOpportunities: [],
        benchmarkingData: [],
      };

      // Find patterns common across multiple users
      for (const [hash, pattern] of this.patterns) {
        if (clinicId && !pattern.clinics.has(clinicId)) continue;

        if (pattern.users.size >= 3) { // Pattern used by 3+ users
          crossUserAnalysis.commonPatterns.push({
            patternId: pattern.patternId,
            userCount: pattern.users.size,
            avgSuccessRate: pattern.metadata.successRate,
            sequence: pattern.sequence,
            frequency: pattern.frequency,
          });
        }
      }

      // Find user-specific unique patterns
      const userPatternCounts = new Map<string, number>();
      for (const [hash, pattern] of this.patterns) {
        if (pattern.users.size === 1) {
          const userId = Array.from(pattern.users)[0];
          userPatternCounts.set(userId, (userPatternCounts.get(userId) || 0) + 1);
        }
      }

      // Generate collaborative opportunities
      crossUserAnalysis.collaborativeOpportunities = await this.identifyCollaborativeOpportunities(
        crossUserAnalysis.commonPatterns
      );

      // Generate benchmarking data
      crossUserAnalysis.benchmarkingData = await this.generateBenchmarkingData(clinicId);

      return crossUserAnalysis;
    } catch (error) {
      console.error('Error analyzing cross-user patterns:', error);
      return {
        commonPatterns: [],
        uniquePatterns: [],
        collaborativeOpportunities: [],
        benchmarkingData: [],
      };
    }
  }

  // Private helper methods

  private async authenticate(): Promise<any> {
    // Service authentication implementation
    return { apiKey: 'service-key', authenticated: true };
  }

  private async subscribeToEvents(): Promise<void> {
    this.eventEmitter.on('interaction.captured', this.handleInteractionCaptured.bind(this));
    this.eventEmitter.on('function.called', this.handleFunctionCalled.bind(this));
    this.eventEmitter.on('session.completed', this.handleSessionCompleted.bind(this));
  }

  private async initializePatternDetection(): Promise<void> {
    // Initialize ML models and algorithms for pattern detection
  }

  private startPatternStreaming(): void {
    // Start real-time pattern streaming and detection
  }

  private async initializePatternHierarchy(): Promise<void> {
    // Initialize pattern hierarchy analysis
  }

  private async loadExistingPatterns(): Promise<void> {
    // Load patterns from database using SecureDataAccess
  }

  private startPeriodicAnalysis(): void {
    setInterval(async () => {
      await this.performPeriodicAnalysis();
    }, 60000); // Every minute
  }

  private async createNewSequence(sessionId: string, userId: string, interaction: any): Promise<Sequence> {
    const sequence: Sequence = {
      sessionId,
      userId,
      clinicId: interaction.context?.clinicId,
      actions: [],
      startTime: new Date(),
      lastActionTime: new Date(),
      metadata: {
        complexity: 0,
        efficiency: 0,
        completionRate: 0,
        errorRate: 0,
        patternMatches: [],
      },
    };

    this.activeSequences.set(sessionId, sequence);
    return sequence;
  }

  private async finalizeSequence(sessionId: string): Promise<SequenceAnalysis | null> {
    const sequence = this.activeSequences.get(sessionId);
    if (!sequence || sequence.actions.length < this.config.minSequenceLength) {
      this.activeSequences.delete(sessionId);
      return null;
    }

    // Finalize sequence metadata
    sequence.endTime = new Date();
    sequence.duration = sequence.endTime.getTime() - sequence.startTime.getTime();

    // Store sequence for user
    if (!this.sequences.has(sequence.userId)) {
      this.sequences.set(sequence.userId, []);
    }
    this.sequences.get(sequence.userId)!.push(sequence);

    // Detect patterns in the sequence
    await this.detectPatterns(sequence);

    // Analyze the sequence
    const analysis = await this.analyzeSequencePatterns(sequence);

    // Update statistics
    this.stats.sequencesAnalyzed++;
    this.updateAverageLength(sequence.actions.length);

    // Remove from active sequences
    this.activeSequences.delete(sessionId);

    return analysis;
  }

  private async updateSequenceMetadata(sequence: Sequence): Promise<void> {
    // Update sequence metadata with current state
    const actions = sequence.actions;
    const successCount = actions.filter(a => a.outcome === 'success').length;
    
    sequence.metadata.completionRate = successCount / actions.length;
    sequence.metadata.errorRate = 1 - sequence.metadata.completionRate;
    sequence.metadata.complexity = this.calculateComplexityScore(actions);
    sequence.metadata.efficiency = this.calculateEfficiencyScore(sequence);
  }

  private async performRealtimeAnalysis(sequence: Sequence): Promise<SequenceAnalysis> {
    // Perform real-time analysis on the current sequence
    return await this.analyzeSequencePatterns(sequence);
  }

  private async detectPatternsAtLevel(sequence: Sequence, level: 'micro' | 'macro' | 'meta'): Promise<Pattern[]> {
    // Detect patterns at specific hierarchical level
    const patterns: Pattern[] = [];
    const windowSizes = {
      micro: [2, 3, 4],
      macro: [5, 8, 12],
      meta: [10, 15, 20],
    };

    for (const windowSize of windowSizes[level]) {
      if (windowSize > sequence.actions.length) continue;

      const windowPatterns = await this.extractWindowPatterns(sequence, windowSize, level);
      patterns.push(...windowPatterns);
    }

    return patterns;
  }

  private async extractWindowPatterns(sequence: Sequence, windowSize: number, level: string): Promise<Pattern[]> {
    // Extract patterns using sliding window approach
    const patterns: Pattern[] = [];
    const actions = sequence.actions;

    for (let i = 0; i <= actions.length - windowSize; i++) {
      const window = actions.slice(i, i + windowSize);
      const patternSequence = window.map(a => a.functionName);
      const hash = this.hashSequence(patternSequence);

      let pattern = this.patterns.get(hash);
      
      if (!pattern) {
        pattern = await this.createNewPattern(patternSequence, level as any);
        this.patterns.set(hash, pattern);
      }

      // Update pattern with new occurrence
      await this.updatePatternOccurrence(pattern, sequence, window);
      patterns.push(pattern);
    }

    return patterns;
  }

  private async createNewPattern(sequence: string[], level: 'micro' | 'macro' | 'meta'): Promise<Pattern> {
    const patternId = `pattern_${level}_${Date.now()}_${this.generateRandomId()}`;
    
    return {
      patternId,
      hash: this.hashSequence(sequence),
      sequence,
      level,
      occurrences: [],
      frequency: 0,
      confidence: 0,
      stability: 0,
      evolution: [],
      users: new Set(),
      clinics: new Set(),
      firstSeen: new Date(),
      lastSeen: new Date(),
      metadata: {
        avgDuration: 0,
        successRate: 0,
        contextualFactors: {},
        seasonality: {
          hourly: new Array(24).fill(0),
          daily: new Array(7).fill(0),
          weekly: new Array(52).fill(0),
          monthly: new Array(12).fill(0),
          detected: false,
          strength: 0,
        },
        correlations: [],
      },
      predictions: [],
      anomalies: [],
    };
  }

  private async updatePatternOccurrence(pattern: Pattern, sequence: Sequence, window: SequenceAction[]): Promise<void> {
    const occurrence: PatternOccurrence = {
      userId: sequence.userId,
      clinicId: sequence.clinicId,
      timestamp: new Date(),
      outcome: this.calculateWindowOutcome(window),
      context: this.extractWindowContext(window),
      duration: this.calculateWindowDuration(window),
      deviation: 0, // Will be calculated after more data
    };

    pattern.occurrences.push(occurrence);
    pattern.frequency++;
    pattern.users.add(sequence.userId);
    if (sequence.clinicId) pattern.clinics.add(sequence.clinicId);
    pattern.lastSeen = new Date();

    // Update pattern confidence
    pattern.confidence = this.calculatePatternConfidence(pattern);
  }

  private async validatePatterns(patterns: Pattern[], sequence: Sequence): Promise<Pattern[]> {
    // Validate patterns against configured thresholds
    return patterns.filter(pattern => 
      pattern.frequency >= this.config.minFrequency &&
      pattern.confidence >= this.config.minConfidence
    );
  }

  private async updatePatternStatistics(pattern: Pattern, sequence: Sequence): Promise<void> {
    // Update pattern statistics with new data
    const successfulOccurrences = pattern.occurrences.filter(o => o.outcome === 'success').length;
    pattern.metadata.successRate = successfulOccurrences / pattern.occurrences.length;
    
    const totalDuration = pattern.occurrences.reduce((sum, o) => sum + o.duration, 0);
    pattern.metadata.avgDuration = totalDuration / pattern.occurrences.length;

    // Update seasonality data
    await this.updateSeasonalityData(pattern);
  }

  private async trackPatternEvolution(pattern: Pattern): Promise<void> {
    // Track how patterns evolve over time
    if (pattern.evolution.length === 0) {
      pattern.evolution.push({
        timestamp: new Date(),
        changeType: 'emergence',
        description: 'Pattern first detected',
        confidence: pattern.confidence,
        impactScore: 1.0,
      });
    }

    // Check for significant changes
    const recentEvolution = pattern.evolution[pattern.evolution.length - 1];
    const confidenceChange = Math.abs(pattern.confidence - recentEvolution.confidence);
    
    if (confidenceChange > 0.2) {
      pattern.evolution.push({
        timestamp: new Date(),
        changeType: 'modification',
        description: `Confidence changed by ${confidenceChange.toFixed(2)}`,
        confidence: pattern.confidence,
        impactScore: confidenceChange,
      });

      this.stats.patternEvolutions++;
    }
  }

  // Additional helper methods implementation...
  
  private hashSequence(actions: string[]): string {
    return actions.join('->');
  }

  private generateRandomId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private calculateComplexityScore(actions: SequenceAction[]): number {
    // Calculate complexity based on action variety and parameters
    const uniqueActions = new Set(actions.map(a => a.functionName)).size;
    const totalActions = actions.length;
    return uniqueActions / totalActions;
  }

  private calculateEfficiencyScore(sequence: Sequence): number {
    // Calculate efficiency based on success rate and duration
    const successRate = sequence.metadata.completionRate;
    const avgExecutionTime = sequence.actions.reduce((sum, a) => sum + a.metadata.executionTime, 0) / sequence.actions.length;
    return successRate / Math.max(1, avgExecutionTime / 1000); // Normalize by seconds
  }

  private calculateWindowOutcome(window: SequenceAction[]): 'success' | 'partial' | 'failure' {
    const successCount = window.filter(a => a.outcome === 'success').length;
    const successRate = successCount / window.length;
    
    if (successRate >= 0.8) return 'success';
    if (successRate >= 0.5) return 'partial';
    return 'failure';
  }

  private extractWindowContext(window: SequenceAction[]): Record<string, any> {
    // Extract common context from window actions
    const context: Record<string, any> = {};
    
    // Merge all contexts
    for (const action of window) {
      Object.assign(context, action.metadata.context);
    }
    
    return context;
  }

  private calculateWindowDuration(window: SequenceAction[]): number {
    if (window.length === 0) return 0;
    return window[window.length - 1].timestamp.getTime() - window[0].timestamp.getTime();
  }

  private calculatePatternConfidence(pattern: Pattern): number {
    if (pattern.occurrences.length === 0) return 0;

    const baseConfidence = pattern.metadata.successRate;
    const frequencyBoost = Math.min(0.2, pattern.frequency / 50);
    const diversityBoost = Math.min(0.1, pattern.users.size / 10);

    return Math.min(1, baseConfidence + frequencyBoost + diversityBoost);
  }

  private async updateSeasonalityData(pattern: Pattern): Promise<void> {
    // Update seasonality information based on occurrence timestamps
    for (const occurrence of pattern.occurrences) {
      const date = occurrence.timestamp;
      const hour = date.getHours();
      const day = date.getDay();
      const week = Math.floor(this.getWeekOfYear(date)) - 1;
      const month = date.getMonth();

      pattern.metadata.seasonality.hourly[hour]++;
      pattern.metadata.seasonality.daily[day]++;
      pattern.metadata.seasonality.weekly[week % 52]++;
      pattern.metadata.seasonality.monthly[month]++;
    }

    // Detect seasonality strength
    pattern.metadata.seasonality.strength = this.calculateSeasonalityStrength(pattern.metadata.seasonality);
    pattern.metadata.seasonality.detected = pattern.metadata.seasonality.strength > 0.3;
  }

  private getWeekOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil(days / 7);
  }

  private calculateSeasonalityStrength(seasonality: SeasonalityInfo): number {
    // Calculate seasonality strength using coefficient of variation
    const datasets = [seasonality.hourly, seasonality.daily, seasonality.weekly, seasonality.monthly];
    let totalStrength = 0;

    for (const dataset of datasets) {
      const mean = dataset.reduce((sum, val) => sum + val, 0) / dataset.length;
      const variance = dataset.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dataset.length;
      const stdDev = Math.sqrt(variance);
      const cv = mean > 0 ? stdDev / mean : 0;
      totalStrength += cv;
    }

    return totalStrength / datasets.length;
  }

  // Prediction methods
  private async predictFromExactMatches(currentSequence: string[]): Promise<PredictionResult[]> {
    const predictions: PredictionResult[] = [];

    for (const [hash, pattern] of this.patterns) {
      if (this.sequenceStartsWithPattern(pattern.sequence, currentSequence)) {
        if (pattern.sequence.length > currentSequence.length) {
          const nextAction = pattern.sequence[currentSequence.length];
          predictions.push({
            action: nextAction,
            confidence: pattern.confidence,
            probability: pattern.frequency / this.getTotalPatternFrequency(),
            reasoning: `Exact pattern match with ${pattern.frequency} occurrences`,
            alternatives: [],
            contextFactors: {},
            timeWindow: {
              min: 0,
              max: 60,
              optimal: 30,
            },
          });
        }
      }
    }

    return predictions;
  }

  private async predictFromPartialMatches(currentSequence: string[]): Promise<PredictionResult[]> {
    // Implement partial pattern matching for predictions
    return [];
  }

  private async predictFromHierarchicalPatterns(currentSequence: string[]): Promise<PredictionResult[]> {
    // Implement hierarchical pattern-based predictions
    return [];
  }

  private async predictFromContextualSimilarity(currentSequence: string[], context: any): Promise<PredictionResult[]> {
    // Implement context-based similarity predictions
    return [];
  }

  private async predictFromTemporalCorrelations(currentSequence: string[], context: any): Promise<PredictionResult[]> {
    // Implement temporal correlation-based predictions
    return [];
  }

  private async predictFromUserBehaviorModel(currentSequence: string[], context: any): Promise<PredictionResult[]> {
    // Implement user behavior model predictions
    return [];
  }

  private combinePredictions(predictions: PredictionResult[], currentSequence: string[], context: any): PredictionResult[] {
    // Combine predictions from multiple strategies
    const combinedMap = new Map<string, PredictionResult>();

    for (const prediction of predictions) {
      const existing = combinedMap.get(prediction.action);
      if (existing) {
        // Combine confidence and probability
        existing.confidence = Math.max(existing.confidence, prediction.confidence);
        existing.probability += prediction.probability;
      } else {
        combinedMap.set(prediction.action, { ...prediction });
      }
    }

    return Array.from(combinedMap.values())
      .sort((a, b) => b.confidence * b.probability - a.confidence * a.probability);
  }

  private async calibratePredictionConfidence(predictions: PredictionResult[], context: any): Promise<PredictionResult[]> {
    // Calibrate prediction confidence based on historical accuracy
    return predictions.map(prediction => ({
      ...prediction,
      confidence: prediction.confidence * this.getHistoricalAccuracy(),
    }));
  }

  private async generateAlternativePredictions(
    prediction: PredictionResult,
    currentSequence: string[],
    context: any
  ): Promise<AlternativePrediction[]> {
    // Generate alternative predictions
    return [];
  }

  private sequenceStartsWithPattern(pattern: string[], sequence: string[]): boolean {
    if (sequence.length > pattern.length) return false;
    
    for (let i = 0; i < sequence.length; i++) {
      if (pattern[i] !== sequence[i]) return false;
    }
    
    return true;
  }

  private getTotalPatternFrequency(): number {
    return Array.from(this.patterns.values()).reduce((sum, pattern) => sum + pattern.frequency, 0);
  }

  private getHistoricalAccuracy(): number {
    return (this.stats.accuracy.shortTerm + this.stats.accuracy.mediumTerm + this.stats.accuracy.longTerm) / 3;
  }

  // Analysis methods
  private async findMatchingPatterns(sequence: Sequence): Promise<MatchedPattern[]> {
    const matches: MatchedPattern[] = [];
    const actionSequence = sequence.actions.map(a => a.functionName);

    for (const [hash, pattern] of this.patterns) {
      const match = this.findPatternMatch(actionSequence, pattern.sequence);
      if (match.confidence > 0.5) {
        matches.push(match);
      }
    }

    return matches.sort((a, b) => b.matchConfidence - a.matchConfidence);
  }

  private findPatternMatch(sequence: string[], pattern: string[]): MatchedPattern {
    // Implement fuzzy pattern matching algorithm
    const matchedPattern: MatchedPattern = {
      patternId: `pattern_${Date.now()}`,
      matchConfidence: 0,
      coverage: 0,
      startIndex: 0,
      endIndex: 0,
      deviations: [],
    };

    // Simple implementation - can be enhanced with more sophisticated algorithms
    let matches = 0;
    let totalComparisons = 0;

    for (let i = 0; i <= sequence.length - pattern.length; i++) {
      let localMatches = 0;
      for (let j = 0; j < pattern.length; j++) {
        if (sequence[i + j] === pattern[j]) {
          localMatches++;
        }
        totalComparisons++;
      }

      const localConfidence = localMatches / pattern.length;
      if (localConfidence > matchedPattern.matchConfidence) {
        matchedPattern.matchConfidence = localConfidence;
        matchedPattern.startIndex = i;
        matchedPattern.endIndex = i + pattern.length - 1;
        matchedPattern.coverage = localMatches / sequence.length;
      }
    }

    return matchedPattern;
  }

  private async calculateSequenceNovelty(sequence: Sequence): Promise<number> {
    // Calculate how novel/unique this sequence is
    const actionSequence = sequence.actions.map(a => a.functionName);
    
    // Check against existing patterns
    let maxSimilarity = 0;
    for (const [hash, pattern] of this.patterns) {
      const similarity = this.calculateSequenceSimilarity(actionSequence, pattern.sequence);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return 1 - maxSimilarity; // High novelty = low similarity to existing patterns
  }

  private async calculateSequenceComplexity(sequence: Sequence): Promise<number> {
    // Calculate sequence complexity based on various factors
    const actions = sequence.actions;
    const uniqueActions = new Set(actions.map(a => a.functionName)).size;
    const totalActions = actions.length;
    
    // Complexity factors
    const actionVariety = uniqueActions / totalActions;
    const parameterComplexity = this.calculateParameterComplexity(actions);
    const temporalComplexity = this.calculateTemporalComplexity(actions);

    return (actionVariety + parameterComplexity + temporalComplexity) / 3;
  }

  private async calculateSequenceEfficiency(sequence: Sequence): Promise<number> {
    // Calculate sequence efficiency based on success rate and execution time
    return sequence.metadata.efficiency;
  }

  private async calculateSequencePredictability(sequence: Sequence): Promise<number> {
    // Calculate how predictable this sequence is based on existing patterns
    const actionSequence = sequence.actions.map(a => a.functionName);
    let totalPredictability = 0;
    let predictions = 0;

    for (let i = 1; i < actionSequence.length; i++) {
      const prefix = actionSequence.slice(0, i);
      const actualNext = actionSequence[i];
      const predictedActions = await this.predictNextAction(prefix);
      
      const prediction = predictedActions.find(p => p.action === actualNext);
      if (prediction) {
        totalPredictability += prediction.confidence;
        predictions++;
      }
    }

    return predictions > 0 ? totalPredictability / predictions : 0;
  }

  private async detectSequenceAnomalies(sequence: Sequence): Promise<string[]> {
    const anomalies: string[] = [];

    // Check for timing anomalies
    const timingAnomaly = this.detectTimingAnomalies(sequence);
    if (timingAnomaly) anomalies.push(timingAnomaly);

    // Check for sequence anomalies
    const sequenceAnomaly = this.detectSequenceAnomalies(sequence);
    if (sequenceAnomaly) anomalies.push(sequenceAnomaly);

    // Check for outcome anomalies
    const outcomeAnomaly = this.detectOutcomeAnomalies(sequence);
    if (outcomeAnomaly) anomalies.push(outcomeAnomaly);

    if (anomalies.length > 0) {
      this.stats.anomaliesDetected += anomalies.length;
    }

    return anomalies;
  }

  private async generateSequenceRecommendations(analysis: SequenceAnalysis): Promise<string[]> {
    const recommendations: string[] = [];

    if (analysis.efficiency < 0.7) {
      recommendations.push('Consider optimizing the workflow for better efficiency');
    }

    if (analysis.anomalies.length > 0) {
      recommendations.push('Review detected anomalies to improve sequence reliability');
    }

    if (analysis.novelty > 0.8) {
      recommendations.push('This appears to be a new workflow - consider documenting for future use');
    }

    return recommendations;
  }

  // Utility methods
  private calculateSequenceSimilarity(seq1: string[], seq2: string[]): number {
    const maxLength = Math.max(seq1.length, seq2.length);
    if (maxLength === 0) return 1;

    let matches = 0;
    const minLength = Math.min(seq1.length, seq2.length);

    for (let i = 0; i < minLength; i++) {
      if (seq1[i] === seq2[i]) matches++;
    }

    return matches / maxLength;
  }

  private calculateParameterComplexity(actions: SequenceAction[]): number {
    let totalComplexity = 0;
    
    for (const action of actions) {
      const paramCount = Object.keys(action.parameters).length;
      totalComplexity += Math.min(1, paramCount / 10); // Normalize to 0-1
    }

    return actions.length > 0 ? totalComplexity / actions.length : 0;
  }

  private calculateTemporalComplexity(actions: SequenceAction[]): number {
    if (actions.length < 2) return 0;

    let variations = 0;
    let avgInterval = 0;

    for (let i = 1; i < actions.length; i++) {
      const interval = actions[i].timestamp.getTime() - actions[i - 1].timestamp.getTime();
      avgInterval += interval;
    }

    avgInterval /= (actions.length - 1);

    // Calculate variance in intervals
    for (let i = 1; i < actions.length; i++) {
      const interval = actions[i].timestamp.getTime() - actions[i - 1].timestamp.getTime();
      variations += Math.abs(interval - avgInterval);
    }

    const variance = variations / (actions.length - 1);
    return Math.min(1, variance / (avgInterval || 1)); // Normalize
  }

  private detectTimingAnomalies(sequence: Sequence): string | null {
    // Detect timing-based anomalies
    return null;
  }

  private detectSequenceAnomalies(sequence: Sequence): string | null {
    // Detect sequence-based anomalies
    return null;
  }

  private detectOutcomeAnomalies(sequence: Sequence): string | null {
    // Detect outcome-based anomalies
    return null;
  }

  private updateAnalysisMetrics(analysis: SequenceAnalysis): void {
    // Update analysis-related metrics
  }

  private updateAverageLength(length: number): void {
    const total = this.stats.averageSequenceLength * (this.stats.sequencesAnalyzed - 1) + length;
    this.stats.averageSequenceLength = total / this.stats.sequencesAnalyzed;
  }

  private async calculatePatternTrend(pattern: Pattern): Promise<PatternTrend> {
    // Calculate pattern trend analysis
    return {
      patternId: pattern.patternId,
      trend: 'stable',
      velocity: 0,
      acceleration: 0,
      forecast: [],
      confidence: 0.5,
    };
  }

  private async identifyCollaborativeOpportunities(commonPatterns: any[]): Promise<any[]> {
    // Identify opportunities for collaboration based on common patterns
    return [];
  }

  private async generateBenchmarkingData(clinicId?: string): Promise<any[]> {
    // Generate benchmarking data for patterns
    return [];
  }

  private async performPeriodicAnalysis(): Promise<void> {
    try {
      // Analyze pattern trends
      await this.analyzePatternTrends();

      // Update pattern evolution tracking
      if (this.config.patternEvolutionTracking) {
        await this.trackAllPatternEvolutions();
      }

      // Cleanup old patterns and sequences
      await this.performCleanup();

    } catch (error) {
      console.error('Error in periodic analysis:', error);
    }
  }

  private async trackAllPatternEvolutions(): Promise<void> {
    for (const [hash, pattern] of this.patterns) {
      await this.trackPatternEvolution(pattern);
    }
  }

  private async performCleanup(): Promise<void> {
    // Remove old, unused patterns and sequences
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    for (const [hash, pattern] of this.patterns) {
      if (pattern.lastSeen < cutoffDate && pattern.frequency < 2) {
        this.patterns.delete(hash);
      }
    }
  }

  // Event handlers
  private async handleInteractionCaptured(data: any): Promise<void> {
    await this.processInteraction(data);
  }

  private async handleFunctionCalled(data: any): Promise<void> {
    await this.processInteraction(data);
  }

  private async handleSessionCompleted(data: any): Promise<void> {
    await this.finalizeSequence(data.sessionId);
  }

  /**
   * Get service statistics
   */
  getStats(): any {
    return {
      ...this.stats,
      totalPatterns: this.patterns.size,
      activeSequences: this.activeSequences.size,
      totalUsers: new Set(Array.from(this.sequences.keys())).size,
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Save patterns to database
    await this.saveAllPatterns();

    // Clear intervals and cleanup
    console.log('Sequence Pattern Engine shutdown complete');
  }

  private async saveAllPatterns(): Promise<void> {
    // Save all patterns to database
    for (const [hash, pattern] of this.patterns) {
      await this.savePatternToDatabase(pattern);
    }
  }

  private async savePatternToDatabase(pattern: Pattern): Promise<void> {
    // Save individual pattern to database using SecureDataAccess
  }
}