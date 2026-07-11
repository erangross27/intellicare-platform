/**
 * Learning Data Adapter Service - Modular Version
 * 
 * Standardizes and transforms data for learning analytics.
 * Provides consistent data interface for all learning services.
 * Only depends on SecureDataAccess for database operations.
 */

const path = require('path');
const SecureDataAccess = require(path.resolve(__dirname, '../../../backend/services/secureDataAccess'));

class LearningDataAdapter {
  constructor() {
    this.dataSchemas = new Map();
    this.transformers = new Map();
    this.validators = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Initialize data schemas
    this.initializeSchemas();
    
    // Initialize transformers
    this.initializeTransformers();
    
    // Initialize validators
    this.initializeValidators();
    
    this.initialized = true;
    console.log('✅ Learning Data Adapter initialized');
  }

  /**
   * Initialize standard data schemas
   */
  initializeSchemas() {
    // Interaction schema
    this.dataSchemas.set('interaction', {
      userId: { type: 'string', required: true },
      functionName: { type: 'string', required: true },
      timestamp: { type: 'date', required: true },
      parameters: { type: 'object', required: false },
      result: { type: 'object', required: false },
      context: { type: 'object', required: true },
      outcome: { type: 'string', enum: ['success', 'failure', 'partial'], required: true }
    });
    
    // Pattern schema
    this.dataSchemas.set('pattern', {
      userId: { type: 'string', required: true },
      type: { type: 'string', enum: ['sequence', 'temporal', 'frequency'], required: true },
      pattern: { type: 'array', required: true },
      confidence: { type: 'number', min: 0, max: 1, required: true },
      frequency: { type: 'number', min: 1, required: true },
      metadata: { type: 'object', required: false }
    });

    // Efficiency schema
    this.dataSchemas.set('efficiency', {
      userId: { type: 'string', required: true },
      practiceId: { type: 'string', required: true },
      metrics: { type: 'object', required: true },
      score: { type: 'number', min: 0, max: 100, required: true },
      category: { type: 'string', enum: ['excellent', 'good', 'average', 'poor'], required: true }
    });
  }

  /**
   * Initialize data transformers
   */
  initializeTransformers() {
    // Interaction transformer
    this.transformers.set('interaction', (rawData) => {
      return {
        userId: rawData.user_id || rawData.userId,
        functionName: rawData.function_name || rawData.functionName,
        timestamp: new Date(rawData.timestamp || Date.now()),
        parameters: this.sanitizeParameters(rawData.parameters),
        result: rawData.result,
        context: rawData.context || {},
        outcome: this.normalizeOutcome(rawData.outcome || rawData.success)
      };
    });

    // Pattern transformer
    this.transformers.set('pattern', (rawData) => {
      return {
        userId: rawData.user_id || rawData.userId,
        type: rawData.type || 'sequence',
        pattern: Array.isArray(rawData.pattern) ? rawData.pattern : [rawData.pattern],
        confidence: Math.max(0, Math.min(1, rawData.confidence || 0)),
        frequency: Math.max(1, rawData.frequency || 1),
        metadata: rawData.metadata || {}
      };
    });

    // Efficiency transformer
    this.transformers.set('efficiency', (rawData) => {
      return {
        userId: rawData.user_id || rawData.userId,
        practiceId: rawData.practice_id || rawData.practiceId,
        metrics: rawData.metrics || {},
        score: Math.max(0, Math.min(100, rawData.score || 0)),
        category: this.categorizeScore(rawData.score || 0)
      };
    });
  }

  /**
   * Initialize data validators
   */
  initializeValidators() {
    this.validators.set('interaction', (data) => {
      return data.userId && data.functionName && data.timestamp;
    });

    this.validators.set('pattern', (data) => {
      return data.userId && data.type && Array.isArray(data.pattern) && 
             data.confidence >= 0 && data.confidence <= 1;
    });

    this.validators.set('efficiency', (data) => {
      return data.userId && data.practiceId && data.score >= 0 && data.score <= 100;
    });
  }

  /**
   * Transform raw data using registered transformer
   */
  transformData(type, rawData) {
    const transformer = this.transformers.get(type);
    
    if (!transformer) {
      throw new Error(`No transformer registered for type: ${type}`);
    }

    return transformer(rawData);
  }

  /**
   * Validate data using registered validator
   */
  validateData(type, data) {
    const validator = this.validators.get(type);
    
    if (!validator) {
      throw new Error(`No validator registered for type: ${type}`);
    }

    return validator(data);
  }

  /**
   * Store data with transformation and validation
   */
  async storeData(type, rawData, context) {
    try {
      // Transform data
      const transformedData = this.transformData(type, rawData);
      
      // Validate data
      if (!this.validateData(type, transformedData)) {
        throw new Error(`Data validation failed for type: ${type}`);
      }

      // Store in database
      const collection = `learning_${type}s`; // e.g., learning_interactions
      await SecureDataAccess.create(collection, transformedData, context);

      return transformedData;

    } catch (error) {
      console.error(`Error storing ${type} data:`, error);
      throw error;
    }
  }

  /**
   * Query data with optional transformation
   */
  async queryData(type, filter, options, context) {
    try {
      const collection = `learning_${type}s`;
      const rawData = await SecureDataAccess.query(collection, filter, options, context);

      // Transform results if needed
      if (rawData && Array.isArray(rawData)) {
        return rawData.map(item => {
          try {
            return this.transformData(type, item);
          } catch (error) {
            // Return raw data if transformation fails
            return item;
          }
        });
      }

      return rawData;

    } catch (error) {
      console.error(`Error querying ${type} data:`, error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  sanitizeParameters(params) {
    if (!params || typeof params !== 'object') {
      return {};
    }

    const sanitized = { ...params };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  normalizeOutcome(outcome) {
    if (outcome === true || outcome === 'true' || outcome === 'success') {
      return 'success';
    }
    if (outcome === false || outcome === 'false' || outcome === 'failure') {
      return 'failure';
    }
    return outcome || 'partial';
  }

  categorizeScore(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'average';
    return 'poor';
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      schemas: this.dataSchemas.size,
      transformers: this.transformers.size,
      validators: this.validators.size
    };
  }
}

module.exports = new LearningDataAdapter();