/**
 * Interaction Capture Service
 * 
 * Captures user interactions with the platform and functions.
 * Emits events for downstream processing by pattern recognition engines.
 */

const { LearningEventBusManager, LEARNING_EVENTS } = require('./learningEventBus');
const learningDataAdapter = require('./learningDataAdapter');
const { LearningConfigManager } = require('./learningConfigService');

const serviceAccountManager = require('../serviceAccountManager');

class InteractionCaptureService {
  constructor() {
    this.serviceId = 'interaction-capture-service';
    this.eventBus = null;
    this.config = null;
    this.dataAdapter = null;
    this.captureBuffer = [];
    this.bufferSize = 100;
    this.flushInterval = 5000; // 5 seconds
    this.initialized = false;
    this.stats = {
      totalCaptured: 0,
      successfulCaptures: 0,
      failedCaptures: 0,
      lastCapture: null
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
      this.dataAdapter = learningDataAdapter;
      
      // Initialize data adapter
      await this.dataAdapter.initialize();
      
      // Set buffer size from config
      this.bufferSize = this.config.getConfig('learning', 'batchSize') || 100;
      
      // Start flush interval
      this.startFlushInterval();
      
      this.initialized = true;
      console.log('✅ Interaction Capture Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Interaction Capture Service:', error);
      throw error;
    }
  }

  /**
   * Capture a user action
   */
  async captureUserAction(userId, action, context) {
    try {
      // Validate input
      if (!userId || !action) {
        throw new Error('userId and action are required');
      }
      
      // Create interaction object
      const interaction = {
        type: 'user_action',
        userId: userId,
        action: action,
        timestamp: new Date(),
        context: {
          ...context,
          sessionId: context.sessionId || this.generateSessionId(),
          practiceId: context.practiceId || 'global',
          source: 'user_interface'
        }
      };
      
      // Standardize the data
      const standardized = this.dataAdapter.standardizeData('interaction', {
        userId: interaction.userId,
        functionName: interaction.action,
        timestamp: interaction.timestamp,
        context: interaction.context,
        outcome: 'pending'
      });
      
      // Add to buffer
      this.addToBuffer(standardized);
      
      // Emit event immediately for real-time processing
      this.eventBus.emitAsync(LEARNING_EVENTS.INTERACTION_CAPTURED, standardized);
      
      // Update stats
      this.stats.totalCaptured++;
      this.stats.successfulCaptures++;
      this.stats.lastCapture = new Date();
      
      return {
        success: true,
        interactionId: standardized.interactionId || `interaction_${Date.now()}`
      };
      
    } catch (error) {
      console.error('Error capturing user action:', error);
      this.stats.failedCaptures++;
      throw error;
    }
  }

  /**
   * Capture a function call
   */
  async captureFunctionCall(functionName, params, result, context) {
    try {
      // Create function call object
      const functionCall = {
        type: 'function_call',
        functionName: functionName,
        parameters: this.sanitizeParams(params),
        result: this.sanitizeResult(result),
        timestamp: new Date(),
        executionTime: context.executionTime || 0,
        context: {
          ...context,
          userId: context.userId || 'system',
          practiceId: context.practiceId || 'global'
        }
      };
      
      // Determine outcome based on result
      const outcome = this.determineOutcome(result);
      
      // Standardize the data
      const standardized = this.dataAdapter.standardizeData('interaction', {
        userId: functionCall.context.userId,
        functionName: functionCall.functionName,
        timestamp: functionCall.timestamp,
        parameters: functionCall.parameters,
        result: functionCall.result,
        context: functionCall.context,
        outcome: outcome
      });
      
      // Add execution time metadata
      standardized.metadata = {
        executionTime: functionCall.executionTime,
        functionCategory: this.categorizeFunction(functionName)
      };
      
      // Add to buffer
      this.addToBuffer(standardized);
      
      // Emit event
      this.eventBus.emitAsync(LEARNING_EVENTS.FUNCTION_CALLED, standardized);
      
      // Update stats
      this.stats.totalCaptured++;
      this.stats.successfulCaptures++;
      
      return {
        success: true,
        functionCallId: `function_${Date.now()}_${functionName}`
      };
      
    } catch (error) {
      console.error('Error capturing function call:', error);
      this.stats.failedCaptures++;
      throw error;
    }
  }

  /**
   * Capture a workflow step
   */
  async captureWorkflowStep(workflowId, step, context) {
    try {
      // Create workflow step object
      const workflowStep = {
        type: 'workflow_step',
        workflowId: workflowId,
        step: {
          name: step.name || step,
          index: step.index || 0,
          status: step.status || 'in_progress',
          timestamp: new Date()
        },
        context: {
          ...context,
          userId: context.userId || 'system',
          practiceId: context.practiceId || 'global'
        }
      };
      
      // Standardize the data
      const standardized = this.dataAdapter.standardizeData('interaction', {
        userId: workflowStep.context.userId,
        functionName: `workflow.${workflowStep.step.name}`,
        timestamp: workflowStep.step.timestamp,
        parameters: { workflowId, stepIndex: workflowStep.step.index },
        context: workflowStep.context,
        outcome: this.mapStepStatusToOutcome(workflowStep.step.status)
      });
      
      // Add workflow metadata
      standardized.metadata = {
        workflowId: workflowId,
        stepName: workflowStep.step.name,
        stepIndex: workflowStep.step.index
      };
      
      // Add to buffer
      this.addToBuffer(standardized);
      
      // Emit event
      this.eventBus.emitAsync(LEARNING_EVENTS.WORKFLOW_STEP, standardized);
      
      return {
        success: true,
        workflowStepId: `workflow_${workflowId}_step_${workflowStep.step.index}`
      };
      
    } catch (error) {
      console.error('Error capturing workflow step:', error);
      this.stats.failedCaptures++;
      throw error;
    }
  }

  /**
   * Capture a batch of interactions
   */
  async captureBatch(interactions) {
    const results = [];
    
    for (const interaction of interactions) {
      try {
        let result;
        
        switch (interaction.type) {
          case 'user_action':
            result = await this.captureUserAction(
              interaction.userId,
              interaction.action,
              interaction.context
            );
            break;
            
          case 'function_call':
            result = await this.captureFunctionCall(
              interaction.functionName,
              interaction.params,
              interaction.result,
              interaction.context
            );
            break;
            
          case 'workflow_step':
            result = await this.captureWorkflowStep(
              interaction.workflowId,
              interaction.step,
              interaction.context
            );
            break;
            
          default:
            result = { success: false, error: 'Unknown interaction type' };
        }
        
        results.push(result);
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Add interaction to buffer
   */
  addToBuffer(interaction) {
    this.captureBuffer.push(interaction);
    
    // Flush if buffer is full
    if (this.captureBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }

  /**
   * Flush buffer to storage
   */
  async flushBuffer() {
    if (this.captureBuffer.length === 0) return;

    // Move interactions declaration outside try block so it's accessible in catch
    const interactions = [...this.captureBuffer];

    try {
      this.captureBuffer = [];

      // Store batch in database
      const context = {
        serviceId: 'interaction-capture-service',
        operation: 'store-interactions',
        practiceId: 'global',
        apiKey: this.serviceToken?.apiKey || this.serviceToken // Include the API key for authentication
      };

      await this.dataAdapter.storeLearningData(
        'interaction_logs',
        { interactions, timestamp: new Date() },
        context
      );

      console.log(`Flushed ${interactions.length} interactions to storage`);

    } catch (error) {
      console.error('Error flushing buffer:', error);
      // Re-add to buffer on failure
      this.captureBuffer.unshift(...interactions);
    }
  }

  /**
   * Start flush interval
   */
  startFlushInterval() {
    this.flushIntervalId = setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);
  }

  /**
   * Stop flush interval
   */
  stopFlushInterval() {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  /**
   * Sanitize parameters (remove sensitive data)
   */
  sanitizeParams(params) {
    if (!params) return {};
    
    const sanitized = { ...params };
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'ssn', 'creditCard'];
    
    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize result (remove sensitive data)
   */
  sanitizeResult(result) {
    if (!result) return {};
    
    if (typeof result === 'object') {
      return this.sanitizeParams(result);
    }
    
    return result;
  }

  /**
   * Determine outcome from result
   */
  determineOutcome(result) {
    if (!result) return 'partial';
    
    if (result.success === true || result.status === 'success') {
      return 'success';
    }
    
    if (result.error || result.success === false || result.status === 'error') {
      return 'failure';
    }
    
    return 'partial';
  }

  /**
   * Map step status to outcome
   */
  mapStepStatusToOutcome(status) {
    const statusMap = {
      'completed': 'success',
      'success': 'success',
      'failed': 'failure',
      'error': 'failure',
      'skipped': 'partial',
      'in_progress': 'partial',
      'pending': 'partial'
    };
    
    return statusMap[status] || 'partial';
  }

  /**
   * Categorize function by name
   */
  categorizeFunction(functionName) {
    if (!functionName) return 'unknown';
    
    const categories = {
      'patient': ['createPatient', 'updatePatient', 'searchPatient', 'getPatient'],
      'appointment': ['scheduleAppointment', 'cancelAppointment', 'rescheduleAppointment'],
      'clinical': ['diagnosis', 'prescription', 'labOrder', 'treatment'],
      'administrative': ['billing', 'insurance', 'registration', 'checkout'],
      'communication': ['sendMessage', 'email', 'notification', 'reminder'],
      'reporting': ['generateReport', 'exportData', 'analytics', 'dashboard']
    };
    
    for (const [category, functions] of Object.entries(categories)) {
      if (functions.some(func => functionName.toLowerCase().includes(func.toLowerCase()))) {
        return category;
      }
    }
    
    return 'general';
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get capture statistics
   */
  getStats() {
    return {
      ...this.stats,
      bufferSize: this.captureBuffer.length,
      captureRate: this.calculateCaptureRate()
    };
  }

  /**
   * Calculate capture rate
   */
  calculateCaptureRate() {
    if (this.stats.totalCaptured === 0) return 0;
    return (this.stats.successfulCaptures / this.stats.totalCaptured) * 100;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalCaptured: 0,
      successfulCaptures: 0,
      failedCaptures: 0,
      lastCapture: null
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    // Flush remaining buffer
    await this.flushBuffer();
    
    // Stop flush interval
    this.stopFlushInterval();
    
    console.log('Interaction Capture Service shutdown complete');
  }
}

module.exports = new InteractionCaptureService();