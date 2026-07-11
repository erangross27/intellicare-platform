/**
 * Learning Configuration Service
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
      parallelProcessing: true
    });
    
    this.config.set('patterns', {
      minSequenceLength: 2,
      maxSequenceLength: 10,
      minFrequency: 3,
      minConfidence: 0.6,
      patternRetentionDays: 30,
      aggregationWindow: 86400000 // 24 hours
    });
    
    this.config.set('automation', {
      minTimeSaving: 300000, // 5 minutes
      minROI: 1.5,
      maxComplexity: 'medium',
      suggestionFrequency: 'weekly',
      autoImplement: false
    });
    
    this.config.set('user', {
      personalizedLearning: true,
      minInteractions: 10,
      learningRate: 0.1,
      forgettingFactor: 0.05,
      maxSuggestions: 5,
      suggestionCooldown: 300000 // 5 minutes
    });
    
    this.config.set('performance', {
      cacheEnabled: true,
      cacheTTL: 600000, // 10 minutes
      maxCacheSize: 1000,
      compressionEnabled: true,
      asyncProcessing: true
    });
  }

  /**
   * Load feature flags
   */
  loadFeatureFlags() {
    this.featureFlags.set('enableRZeroLearning', true);
    this.featureFlags.set('enableProceduralMemory', true);
    this.featureFlags.set('enableAutomationDiscovery', true);
    this.featureFlags.set('enablePersonalAssistant', true);
    this.featureFlags.set('enableCrossClinicLearning', false);
    this.featureFlags.set('enablePredictiveWorkflows', true);
    this.featureFlags.set('enableAdaptiveThresholds', true);
    this.featureFlags.set('enableRealTimeLearning', true);
    this.featureFlags.set('enableOfflineLearning', false);
    this.featureFlags.set('enableExperimentalFeatures', false);
  }

  /**
   * Load learning thresholds
   */
  loadThresholds() {
    // Pattern detection thresholds
    this.thresholds.set('pattern', {
      minSupport: 0.1,
      minConfidence: 0.6,
      minLift: 1.2,
      outlierZScore: 3.0,
      similarityThreshold: 0.8
    });
    
    // Sequence thresholds
    this.thresholds.set('sequence', {
      minLength: 2,
      maxLength: 20,
      minFrequency: 3,
      gapTolerance: 5,
      confidenceDecay: 0.9
    });
    
    // Temporal thresholds
    this.thresholds.set('temporal', {
      timeWindowMinutes: 30,
      minOccurrences: 5,
      seasonalityThreshold: 0.7,
      trendThreshold: 0.3
    });
    
    // Automation thresholds
    this.thresholds.set('automation', {
      minRepetitions: 10,
      minTimeSavingSeconds: 300,
      minSuccessRate: 0.8,
      complexityScore: 5.0,
      implementationCost: 1000
    });
    
    // Learning thresholds
    this.thresholds.set('learning', {
      convergenceThreshold: 0.01,
      maxIterations: 100,
      learningRate: 0.1,
      momentumFactor: 0.9,
      regularization: 0.001
    });
    
    // Memory thresholds
    this.thresholds.set('memory', {
      minStrength: 0.3,
      decayRate: 0.05,
      reinforcementBoost: 0.2,
      maxAge: 2147483647, // Max 32-bit int (~24.8 days)
      pruneThreshold: 0.1
    });
  }

  /**
   * Load algorithm parameters
   */
  loadParameters() {
    // R-Zero parameters
    this.parameters.set('rzero', {
      challengeDifficulty: 'adaptive',
      challengeIncrement: 0.1,
      maxChallengeLevel: 10,
      consensusThreshold: 0.7,
      validationSamples: 5,
      explorationRate: 0.2
    });
    
    // Clustering parameters
    this.parameters.set('clustering', {
      algorithm: 'kmeans',
      minClusters: 2,
      maxClusters: 10,
      distanceMetric: 'euclidean',
      maxIterations: 100,
      convergenceThreshold: 0.001
    });
    
    // Neural network parameters
    this.parameters.set('neural', {
      hiddenLayers: [64, 32],
      activation: 'relu',
      outputActivation: 'sigmoid',
      optimizer: 'adam',
      batchSize: 32,
      epochs: 50
    });
    
    // Time series parameters
    this.parameters.set('timeseries', {
      model: 'arima',
      seasonalPeriod: 7,
      forecastHorizon: 30,
      confidenceLevel: 0.95,
      smoothingFactor: 0.3
    });
    
    // Recommendation parameters
    this.parameters.set('recommendation', {
      algorithm: 'collaborative',
      similarityMetric: 'cosine',
      minSimilarity: 0.5,
      maxRecommendations: 10,
      diversityFactor: 0.3
    });
  }

  /**
   * Load environment variable overrides
   */
  loadEnvironmentOverrides() {
    // Check for environment variable overrides
    const envPrefix = 'LEARNING_';
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(envPrefix)) {
        const configPath = key.substring(envPrefix.length).toLowerCase().split('_');
        this.setNestedConfig(configPath, value);
      }
    }
  }

  /**
   * Get configuration value
   */
  getConfig(category, key = null) {
    if (!key) {
      return this.config.get(category);
    }
    
    const categoryConfig = this.config.get(category);
    return categoryConfig ? categoryConfig[key] : undefined;
  }

  /**
   * Set configuration value
   */
  setConfig(category, key, value) {
    const categoryConfig = this.config.get(category) || {};
    categoryConfig[key] = value;
    this.config.set(category, categoryConfig);
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
  setFeatureFlag(flag, value) {
    this.featureFlags.set(flag, value);
  }

  /**
   * Get threshold
   */
  getThreshold(category, key = null) {
    if (!key) {
      return this.thresholds.get(category);
    }
    
    const categoryThresholds = this.thresholds.get(category);
    return categoryThresholds ? categoryThresholds[key] : undefined;
  }

  /**
   * Set threshold
   */
  setThreshold(category, key, value) {
    const categoryThresholds = this.thresholds.get(category) || {};
    categoryThresholds[key] = value;
    this.thresholds.set(category, categoryThresholds);
  }

  /**
   * Get parameters
   */
  getParameters(algorithm) {
    return this.parameters.get(algorithm);
  }

  /**
   * Set parameters
   */
  setParameters(algorithm, params) {
    this.parameters.set(algorithm, params);
  }

  /**
   * Get learning parameters for specific context
   */
  getLearningParameters(context) {
    const baseParams = {
      patterns: this.getConfig('patterns'),
      thresholds: this.getThreshold('learning'),
      features: this.getActiveFeatures()
    };
    
    // Adjust based on context
    if (context.mode === 'fast') {
      baseParams.patterns.minFrequency = 1;
      baseParams.thresholds.minConfidence = 0.5;
    } else if (context.mode === 'accurate') {
      baseParams.patterns.minFrequency = 5;
      baseParams.thresholds.minConfidence = 0.8;
    }
    
    return baseParams;
  }

  /**
   * Get active features
   */
  getActiveFeatures() {
    const active = [];
    
    for (const [flag, enabled] of this.featureFlags) {
      if (enabled) {
        active.push(flag);
      }
    }
    
    return active;
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
    this.initialized = false;
    this.initialize();
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    const errors = [];
    
    // Validate required configurations
    const requiredConfigs = ['learning', 'patterns', 'automation', 'user'];
    for (const required of requiredConfigs) {
      if (!this.config.has(required)) {
        errors.push(`Missing required configuration: ${required}`);
      }
    }
    
    // Validate threshold ranges
    const patternThresholds = this.getThreshold('pattern');
    if (patternThresholds) {
      if (patternThresholds.minConfidence < 0 || patternThresholds.minConfidence > 1) {
        errors.push('Pattern confidence must be between 0 and 1');
      }
      if (patternThresholds.minSupport < 0 || patternThresholds.minSupport > 1) {
        errors.push('Pattern support must be between 0 and 1');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Helper: Set nested configuration
   */
  setNestedConfig(path, value) {
    if (path.length === 0) return;
    
    // Parse value from environment variable
    const parsedValue = this.parseEnvValue(value);
    
    if (path.length === 1) {
      // Direct configuration
      this.config.set(path[0], parsedValue);
    } else if (path.length === 2) {
      // Nested configuration
      const category = path[0];
      const key = path[1];
      this.setConfig(category, key, parsedValue);
    }
  }

  /**
   * Helper: Parse environment variable value
   */
  parseEnvValue(value) {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Try to parse as number
      const num = Number(value);
      if (!isNaN(num)) {
        return num;
      }
      
      // Try to parse as boolean
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
      
      // Return as string
      return value;
    }
  }

  /**
   * Export configuration for persistence
   */
  exportConfig() {
    return JSON.stringify(this.getAllConfig(), null, 2);
  }

  /**
   * Import configuration
   */
  importConfig(configJson) {
    try {
      const imported = JSON.parse(configJson);
      
      // Import config
      if (imported.config) {
        for (const [key, value] of Object.entries(imported.config)) {
          this.config.set(key, value);
        }
      }
      
      // Import feature flags
      if (imported.featureFlags) {
        for (const [key, value] of Object.entries(imported.featureFlags)) {
          this.featureFlags.set(key, value);
        }
      }
      
      // Import thresholds
      if (imported.thresholds) {
        for (const [key, value] of Object.entries(imported.thresholds)) {
          this.thresholds.set(key, value);
        }
      }
      
      // Import parameters
      if (imported.parameters) {
        for (const [key, value] of Object.entries(imported.parameters)) {
          this.parameters.set(key, value);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error importing configuration:', error);
      return false;
    }
  }
}

// Create singleton instance
let configInstance = null;

class LearningConfigManager {
  static getInstance() {
    if (!configInstance) {
      configInstance = new LearningConfigService();
      configInstance.initialize();
    }
    return configInstance;
  }
  
  static resetInstance() {
    configInstance = null;
  }
}

module.exports = {
  LearningConfigService,
  LearningConfigManager
};