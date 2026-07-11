/**
 * Learning Data Adapter Service
 * 
 * Standardizes and transforms data for learning analytics.
 * Provides consistent data interface for all learning services.
 * Only depends on SecureDataAccess for database operations.
 */

const SecureDataAccess = require('../secureDataAccess');

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
      patternId: { type: 'string', required: true },
      type: { type: 'string', required: true },
      userId: { type: 'string', required: false },
      practiceId: { type: 'string', required: true },
      sequence: { type: 'array', required: true },
      frequency: { type: 'number', required: true },
      confidence: { type: 'number', required: true },
      lastOccurrence: { type: 'date', required: true }
    });
    
    // Workflow schema
    this.dataSchemas.set('workflow', {
      workflowId: { type: 'string', required: true },
      name: { type: 'string', required: true },
      steps: { type: 'array', required: true },
      userId: { type: 'string', required: false },
      practiceId: { type: 'string', required: true },
      executionTime: { type: 'number', required: true },
      successRate: { type: 'number', required: true }
    });
    
    // Memory schema
    this.dataSchemas.set('memory', {
      memoryId: { type: 'string', required: true },
      type: { type: 'string', enum: ['procedural', 'declarative', 'episodic'], required: true },
      content: { type: 'object', required: true },
      context: { type: 'object', required: true },
      strength: { type: 'number', required: true },
      lastAccessed: { type: 'date', required: true }
    });
    
    // Automation opportunity schema
    this.dataSchemas.set('automation', {
      opportunityId: { type: 'string', required: true },
      practiceId: { type: 'string', required: true },
      workflow: { type: 'string', required: true },
      currentTime: { type: 'number', required: true },
      potentialSaving: { type: 'number', required: true },
      complexity: { type: 'string', enum: ['low', 'medium', 'high'], required: true },
      roi: { type: 'number', required: true }
    });
  }

  /**
   * Initialize data transformers
   */
  initializeTransformers() {
    // Transform raw interaction to standard format
    this.transformers.set('interaction', (rawData) => {
      return {
        userId: rawData.userId || rawData.user_id,
        functionName: rawData.functionName || rawData.function || rawData.action,
        timestamp: this.normalizeDate(rawData.timestamp || rawData.createdAt || new Date()),
        parameters: rawData.parameters || rawData.params || {},
        result: rawData.result || rawData.response || {},
        context: {
          practiceId: rawData.practiceId || rawData.practice_id,
          sessionId: rawData.sessionId || rawData.session_id,
          source: rawData.source || 'unknown',
          ...( rawData.context || {})
        },
        outcome: this.determineOutcome(rawData)
      };
    });
    
    // Transform function sequence to pattern
    this.transformers.set('sequence_to_pattern', (sequence) => {
      return {
        patternId: `pattern_${Date.now()}_${Math.random()}`,
        type: 'sequence',
        sequence: sequence.map(s => s.functionName),
        frequency: sequence.length,
        confidence: this.calculateSequenceConfidence(sequence),
        lastOccurrence: new Date()
      };
    });
    
    // Transform time-based data
    this.transformers.set('temporal_data', (rawData) => {
      const hour = new Date(rawData.timestamp).getHours();
      const dayOfWeek = new Date(rawData.timestamp).getDay();
      
      return {
        ...rawData,
        timeContext: {
          hour,
          dayOfWeek,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          timeOfDay: this.getTimeOfDay(hour),
          isBusinessHours: hour >= 8 && hour < 18
        }
      };
    });
  }

  /**
   * Initialize data validators
   */
  initializeValidators() {
    // Validate interaction data
    this.validators.set('interaction', (data) => {
      const schema = this.dataSchemas.get('interaction');
      return this.validateAgainstSchema(data, schema);
    });
    
    // Validate pattern data
    this.validators.set('pattern', (data) => {
      const schema = this.dataSchemas.get('pattern');
      return this.validateAgainstSchema(data, schema);
    });
    
    // Validate workflow data
    this.validators.set('workflow', (data) => {
      const schema = this.dataSchemas.get('workflow');
      return this.validateAgainstSchema(data, schema);
    });
  }

  /**
   * Standardize raw data to learning format
   */
  standardizeData(dataType, rawData) {
    const transformer = this.transformers.get(dataType);
    
    if (!transformer) {
      throw new Error(`No transformer found for data type: ${dataType}`);
    }
    
    return transformer(rawData);
  }

  /**
   * Validate data format
   */
  validateDataFormat(dataType, data) {
    const validator = this.validators.get(dataType);
    
    if (!validator) {
      // If no specific validator, do basic validation
      return this.basicValidation(data);
    }
    
    return validator(data);
  }

  /**
   * Transform data for learning algorithms
   */
  transformForLearning(data, targetFormat) {
    switch (targetFormat) {
      case 'vector':
        return this.toVector(data);
      
      case 'sequence':
        return this.toSequence(data);
      
      case 'graph':
        return this.toGraph(data);
      
      case 'timeseries':
        return this.toTimeSeries(data);
      
      default:
        return data;
    }
  }

  /**
   * Convert data to vector format for ML
   */
  toVector(data) {
    const vector = [];
    
    // Extract numeric features
    const extractNumeric = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'number') {
          vector.push(value);
        } else if (typeof value === 'boolean') {
          vector.push(value ? 1 : 0);
        } else if (typeof value === 'object' && value !== null) {
          extractNumeric(value, `${prefix}${key}.`);
        }
      }
    };
    
    extractNumeric(data);
    return vector;
  }

  /**
   * Convert data to sequence format
   */
  toSequence(data) {
    if (Array.isArray(data)) {
      return data.map(item => ({
        step: item.functionName || item.action,
        timestamp: item.timestamp,
        outcome: item.outcome
      }));
    }
    
    return [data];
  }

  /**
   * Convert data to graph format
   */
  toGraph(data) {
    const nodes = new Map();
    const edges = [];
    
    if (Array.isArray(data)) {
      // Create nodes for each unique function
      data.forEach((item, index) => {
        const nodeId = item.functionName || `node_${index}`;
        
        if (!nodes.has(nodeId)) {
          nodes.set(nodeId, {
            id: nodeId,
            label: item.functionName,
            count: 0,
            data: []
          });
        }
        
        nodes.get(nodeId).count++;
        nodes.get(nodeId).data.push(item);
        
        // Create edges between sequential functions
        if (index > 0) {
          const prevNodeId = data[index - 1].functionName || `node_${index - 1}`;
          edges.push({
            source: prevNodeId,
            target: nodeId,
            weight: 1
          });
        }
      });
    }
    
    return {
      nodes: Array.from(nodes.values()),
      edges: edges
    };
  }

  /**
   * Convert data to time series format
   */
  toTimeSeries(data) {
    if (!Array.isArray(data)) {
      data = [data];
    }
    
    return data.map(item => ({
      timestamp: this.normalizeDate(item.timestamp),
      value: item.value || 1,
      label: item.functionName || item.action
    })).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Aggregate learning data
   */
  async aggregateLearningData(collection, filter, aggregation, context) {
    try {
      const pipeline = [
        { $match: filter },
        ...aggregation
      ];
      
      return await SecureDataAccess.aggregate(collection, pipeline, context);
    } catch (error) {
      console.error('Error aggregating learning data:', error);
      throw error;
    }
  }

  /**
   * Store learning data
   */
  async storeLearningData(collection, data, context) {
    try {
      // Validate data before storing
      const isValid = this.validateDataFormat(collection, data);
      
      if (!isValid.valid) {
        throw new Error(`Invalid data format: ${isValid.errors.join(', ')}`);
      }
      
      // Add metadata
      const enrichedData = {
        ...data,
        _metadata: {
          createdAt: new Date(),
          version: '1.0',
          source: 'learning_system'
        }
      };
      
      return await SecureDataAccess.insert(collection, enrichedData, context);
    } catch (error) {
      console.error('Error storing learning data:', error);
      throw error;
    }
  }

  /**
   * Retrieve learning data
   */
  async retrieveLearningData(collection, filter, options, context) {
    try {
      return await SecureDataAccess.query(collection, filter, options, context);
    } catch (error) {
      console.error('Error retrieving learning data:', error);
      throw error;
    }
  }

  /**
   * Helper: Validate against schema
   */
  validateAgainstSchema(data, schema) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      // Check required fields
      if (rules.required && !data[field]) {
        errors.push(`Missing required field: ${field}`);
      }
      
      // Check type
      if (data[field] !== undefined) {
        const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
        
        if (rules.type && actualType !== rules.type) {
          errors.push(`Invalid type for ${field}: expected ${rules.type}, got ${actualType}`);
        }
        
        // Check enum values
        if (rules.enum && !rules.enum.includes(data[field])) {
          errors.push(`Invalid value for ${field}: must be one of ${rules.enum.join(', ')}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Helper: Basic validation
   */
  basicValidation(data) {
    const errors = [];
    
    if (!data || typeof data !== 'object') {
      errors.push('Data must be an object');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Helper: Normalize date
   */
  normalizeDate(date) {
    if (date instanceof Date) {
      return date;
    }
    
    if (typeof date === 'string' || typeof date === 'number') {
      return new Date(date);
    }
    
    return new Date();
  }

  /**
   * Helper: Determine outcome
   */
  determineOutcome(data) {
    if (data.outcome) return data.outcome;
    if (data.success === true) return 'success';
    if (data.success === false) return 'failure';
    if (data.error) return 'failure';
    if (data.status === 'completed') return 'success';
    if (data.status === 'failed') return 'failure';
    
    return 'partial';
  }

  /**
   * Helper: Calculate sequence confidence
   */
  calculateSequenceConfidence(sequence) {
    if (!sequence || sequence.length === 0) return 0;
    
    const successCount = sequence.filter(s => s.outcome === 'success').length;
    return successCount / sequence.length;
  }

  /**
   * Helper: Get time of day
   */
  getTimeOfDay(hour) {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }
}

module.exports = new LearningDataAdapter();