/**
 * Learning Configuration Service - Modular Version
 * 
 * Manages configuration for all learning analytics services.
 * No external dependencies - pure configuration management.
 * Provides thresholds, parameters, and feature flags.
 */

class LearningConfigService {
  constructor() {
    this.config = new Map();
    this.featureFlags = new Map();
    this.thresholds = new Map();
    this.parameters = new Map();
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    
    // Load default configuration
    this.loadDefaultConfig();
    
    // Load feature flags
    this.loadFeatureFlags();
    
    // Load thresholds
    this.loadThresholds();
    
    // Load parameters
    this.loadParameters();
    
    // Override with environment variables if present
    this.loadEnvironmentOverrides();
    
    this.initialized = true;
    console.log('✅ Learning Config Service initialized');
  }

  /**
   * Load default configuration
   */
  loadDefaultConfig() {
    this.config.set('learning', {
      enabled: true,
      mode: 'adaptive', // 'adaptive', 'fixed', 'experimental'
      debugMode: process.env.NODE_ENV === 'development',
      maxMemorySize: 10000, // Maximum memory entries per type
      cleanupInterval: 3600000, // 1 hour
      batchSize: 100,
      flushInterval: 5000 // 5 seconds
    });

    this.config.set('patterns', {
      minOccurrences: 3,
      confidenceThreshold: 0.6,
      maxPatternLength: 20,
      temporalWindow: 3600000, // 1 hour
      sequenceTimeout: 300000 // 5 minutes
    });

    this.config.set('automation', {
      enabled: true,
      minROI: 1.5,
      maxComplexity: 'medium',
      minRepetitions: 10,
      minTimeSaving: 300000 // 5 minutes
    });
  }

  /**
   * Load feature flags
   */
  loadFeatureFlags() {
    this.featureFlags.set('patternRecognition', true);
    this.featureFlags.set('automationSuggestions', true);
    this.featureFlags.set('efficiencyAnalysis', true);
    this.featureFlags.set('predictiveAnalytics', false); // Experimental
    this.featureFlags.set('realTimeOptimization', true);
    this.featureFlags.set('advancedMetrics', true);
    this.featureFlags.set('machineLearning', false); // Future feature
  }

  /**
   * Load thresholds
   */
  loadThresholds() {
    this.thresholds.set('efficiency', {
      excellent: 0.9,
      good: 0.75,
      average: 0.6,
      poor: 0.4
    });

    this.thresholds.set('automation', {
      highPotential: 0.8,
      mediumPotential: 0.5,
      lowPotential: 0.2
    });

    this.thresholds.set('patterns', {
      strongConfidence: 0.8,
      moderateConfidence: 0.6,
      weakConfidence: 0.4
    });
  }

  /**
   * Load parameters
   */
  loadParameters() {
    this.parameters.set('memory', {
      userMemoryLimit: 5000,
      proceduralMemoryLimit: 10000,
      temporalMemoryLimit: 50000,
      cleanupThreshold: 0.8
    });

    this.parameters.set('analysis', {
      lookbackDays: 30,
      minDataPoints: 10,
      maxAnalysisTime: 60000, // 1 minute
      batchAnalysisSize: 1000
    });

    this.parameters.set('rzero', {
      challengeDifficulty: 'adaptive',
      challengeIncrement: 0.1,
      maxChallengeLevel: 10,
      explorationRate: 0.2
    });
  }

  /**
   * Load environment overrides
   */
  loadEnvironmentOverrides() {
    // Override from environment variables
    if (process.env.LEARNING_ENABLED) {
      this.config.get('learning').enabled = process.env.LEARNING_ENABLED === 'true';
    }

    if (process.env.LEARNING_DEBUG) {
      this.config.get('learning').debugMode = process.env.LEARNING_DEBUG === 'true';
    }

    if (process.env.AUTOMATION_ENABLED) {
      this.config.get('automation').enabled = process.env.AUTOMATION_ENABLED === 'true';
    }
  }

  /**
   * Get configuration value
   */
  getConfig(section, key = null) {
    const sectionConfig = this.config.get(section);
    
    if (!sectionConfig) {
      return null;
    }

    if (key) {
      return sectionConfig[key];
    }

    return sectionConfig;
  }

  /**
   * Set configuration value
   */
  setConfig(section, key, value) {
    if (!this.config.has(section)) {
      this.config.set(section, {});
    }

    this.config.get(section)[key] = value;
  }

  /**
   * Get feature flag
   */
  getFeatureFlag(flag) {
    return this.featureFlags.get(flag) || false;
  }

  /**
   * Set feature flag
   */
  setFeatureFlag(flag, enabled) {
    this.featureFlags.set(flag, enabled);
  }

  /**
   * Get threshold
   */
  getThreshold(category, level = null) {
    const categoryThresholds = this.thresholds.get(category);
    
    if (!categoryThresholds) {
      return null;
    }

    if (level) {
      return categoryThresholds[level];
    }

    return categoryThresholds;
  }

  /**
   * Get parameters
   */
  getParameters(section) {
    return this.parameters.get(section) || {};
  }

  /**
   * Get all configuration
   */
  getAllConfig() {
    return {
      config: Object.fromEntries(this.config),
      featureFlags: Object.fromEntries(this.featureFlags),
      thresholds: Object.fromEntries(this.thresholds),
      parameters: Object.fromEntries(this.parameters)
    };
  }

  /**
   * Reset to defaults
   */
  resetToDefaults() {
    this.config.clear();
    this.featureFlags.clear();
    this.thresholds.clear();
    this.parameters.clear();
    
    this.loadDefaultConfig();
    this.loadFeatureFlags();
    this.loadThresholds();
    this.loadParameters();
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      configSections: this.config.size,
      featureFlags: this.featureFlags.size,
      thresholds: this.thresholds.size,
      parameters: this.parameters.size
    };
  }
}

// Singleton instance
const configService = new LearningConfigService();

// Manager class for singleton access
class LearningConfigManager {
  static getInstance() {
    configService.initialize();
    return configService;
  }
}

module.exports = { LearningConfigService, LearningConfigManager };