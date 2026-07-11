/**
 * Interaction Capture Service - Modular Version
 * 
 * Captures user interactions with the platform and functions.
 * Emits events for downstream processing by pattern recognition engines.
 */

const path = require('path');
const serviceAccountManager = require(path.resolve(__dirname, '../../../backend/services/serviceAccountManager'));
const SecureDataAccess = require(path.resolve(__dirname, '../../../backend/services/secureDataAccess'));

class InteractionCaptureService {
  constructor() {
    this.serviceId = 'interaction-capture-service';
    this.serviceToken = null;
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
      throw error;
    }
    
    try {
      // Start buffer flush
      this.startBufferFlush();
      
      // Log initialization using SecureDataAccess
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'interaction-capture-service',
        timestamp: new Date()
      }, context);
      
      this.initialized = true;
      console.log('✅ Interaction Capture Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Interaction Capture Service:', error);
      throw error;
    }
  }

  /**
   * Capture user interaction
   */
  async captureInteraction(interaction) {
    try {
      // Validate interaction data
      if (!this.validateInteraction(interaction)) {
        this.stats.failedCaptures++;
        return false;
      }

      // Add timestamp and metadata
      const enrichedInteraction = {
        ...interaction,
        capturedAt: new Date(),
        captureId: `capture_${Date.now()}_${Math.random()}`,
        serviceId: this.serviceId
      };

      // Add to buffer
      this.captureBuffer.push(enrichedInteraction);

      // Update stats
      this.stats.totalCaptured++;
      this.stats.lastCapture = new Date();

      // Flush if buffer is full
      if (this.captureBuffer.length >= this.bufferSize) {
        await this.flushBuffer();
      }

      return true;

    } catch (error) {
      console.error('Error capturing interaction:', error);
      this.stats.failedCaptures++;
      return false;
    }
  }

  /**
   * Validate interaction data
   */
  validateInteraction(interaction) {
    if (!interaction.userId || !interaction.functionName) {
      return false;
    }

    if (!interaction.timestamp) {
      interaction.timestamp = new Date();
    }

    return true;
  }

  /**
   * Start buffer flush interval
   */
  startBufferFlush() {
    this.flushTimer = setInterval(async () => {
      if (this.captureBuffer.length > 0) {
        await this.flushBuffer();
      }
    }, this.flushInterval);
  }

  /**
   * Flush buffer to database
   */
  async flushBuffer() {
    if (this.captureBuffer.length === 0) return;

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'flush_interactions',
        practiceId: 'global'
      };

      // Create batch record
      const batch = {
        interactions: this.captureBuffer.slice(),
        batchSize: this.captureBuffer.length,
        flushedAt: new Date()
      };

      await SecureDataAccess.create('interaction_batches', batch, context);

      // Clear buffer
      this.captureBuffer = [];
      this.stats.successfulCaptures += batch.batchSize;

    } catch (error) {
      console.error('Error flushing buffer:', error);
      this.stats.failedCaptures += this.captureBuffer.length;
      this.captureBuffer = []; // Clear buffer to prevent memory issues
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      bufferSize: this.captureBuffer.length,
      stats: this.stats
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining buffer
    if (this.captureBuffer.length > 0) {
      await this.flushBuffer();
    }

    console.log('Interaction Capture Service shutdown complete');
  }
}

module.exports = new InteractionCaptureService();