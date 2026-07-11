// AI Circuit Breaker Service for IntelliCare
// Provides fault tolerance and stability for AI service calls
// Migrated to DDD NX architecture - Infrastructure Context - Resilience Feature

const EventEmitter = require('events');

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AICircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.serviceId = 'ai-circuit-breaker-service';
    this.serviceToken = null;
    this.initialized = false;
    
    // Configuration with sensible defaults
    this.config = {
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeout: options.recoveryTimeout || 60000, // 1 minute
      resetTimeout: options.resetTimeout || 30000, // 30 seconds
      monitorWindow: options.monitorWindow || 60000, // 1 minute
      volumeThreshold: options.volumeThreshold || 10, // Minimum requests before circuit can trip
      errorThreshold: options.errorThreshold || 50, // Error percentage threshold
      timeoutDuration: options.timeoutDuration || 30000 // 30 seconds
    };
    
    // State management
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = [];
    this.successes = [];
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    this.nextAttempt = null;
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalTimeouts: 0,
      averageResponseTime: 0,
      currentFailureRate: 0,
      stateChanges: {
        open: 0,
        halfOpen: 0,
        closed: 0
      },
      lastReset: Date.now()
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Start monitoring
      this.startMonitoring();
      
      this.initialized = true;
      console.log('✅ AI Circuit Breaker initialized', this.config);
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize AICircuitBreaker:', error);
      throw error;
    }
  }
  
  // Execute a function with circuit breaker protection
  async execute(operation, fallback = null, context = {}) {
    if (!this.initialized) await this.initialize();

    this.metrics.totalRequests++;
    
    // Check circuit state
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        console.log('🚫 Circuit breaker OPEN - operation blocked');
        this.emit('blocked', { operation: context.name, state: this.state });
        
        if (fallback) {
          console.log('🔄 Using fallback for blocked operation');
          return await this.executeFallback(fallback, context);
        }
        
        throw new Error('Circuit breaker is OPEN');
      } else {
        // Attempt to move to HALF_OPEN
        this.transitionToHalfOpen();
      }
    }
    
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Executing AI operation (${this.state}): ${context.name || 'unknown'}`);
      
      // Add timeout protection
      const result = await Promise.race([
        operation(),
        this.createTimeout()
      ]);
      
      const duration = Date.now() - startTime;
      
      // Record success
      this.recordSuccess(duration);
      
      // If we're in HALF_OPEN, consider closing the circuit
      if (this.state === 'HALF_OPEN') {
        this.transitionToClosed();
      }
      
      this.emit('success', {
        operation: context.name,
        duration: duration,
        state: this.state
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failure
      this.recordFailure(error, duration);
      
      // Check if we should open the circuit
      if (this.shouldTripCircuit()) {
        this.transitionToOpen();
      }
      
      this.emit('failure', {
        operation: context.name,
        error: error.message,
        duration: duration,
        state: this.state
      });
      
      // Use fallback if available
      if (fallback) {
        console.log('🔄 Using fallback due to failure');
        return await this.executeFallback(fallback, context);
      }
      
      throw error;
    }
  }

  async executeFallback(fallback, context) {
    try {
      const result = await fallback(context);
      this.emit('fallback', { operation: context.name, success: true });
      return result;
    } catch (error) {
      this.emit('fallback', { operation: context.name, success: false, error: error.message });
      throw error;
    }
  }

  createTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        this.metrics.totalTimeouts++;
        reject(new Error(`Operation timed out after ${this.config.timeoutDuration}ms`));
      }, this.config.timeoutDuration);
    });
  }

  recordSuccess(duration) {
    this.metrics.totalSuccesses++;
    this.successes.push({
      timestamp: Date.now(),
      duration: duration
    });
    
    // Clean old successes
    this.cleanOldRecords(this.successes);
    
    // Update metrics
    this.updateMetrics();
  }

  recordFailure(error, duration) {
    this.metrics.totalFailures++;
    this.lastFailureTime = Date.now();
    
    this.failures.push({
      timestamp: Date.now(),
      error: error.message,
      duration: duration
    });
    
    // Clean old failures
    this.cleanOldRecords(this.failures);
    
    // Update metrics
    this.updateMetrics();
    
    // Log failure for monitoring
    this.logFailure(error, duration);
  }

  cleanOldRecords(records) {
    const cutoff = Date.now() - this.config.monitorWindow;
    const index = records.findIndex(record => record.timestamp > cutoff);
    if (index > 0) {
      records.splice(0, index);
    }
  }

  updateMetrics() {
    const totalRecent = this.successes.length + this.failures.length;
    
    if (totalRecent > 0) {
      this.metrics.currentFailureRate = (this.failures.length / totalRecent) * 100;
    }
    
    if (this.successes.length > 0) {
      const totalDuration = this.successes.reduce((sum, s) => sum + s.duration, 0);
      this.metrics.averageResponseTime = totalDuration / this.successes.length;
    }
  }

  shouldTripCircuit() {
    const recentRequests = this.successes.length + this.failures.length;
    
    // Don't trip if we don't have enough volume
    if (recentRequests < this.config.volumeThreshold) {
      return false;
    }
    
    // Trip if failure rate exceeds threshold
    return this.metrics.currentFailureRate >= this.config.errorThreshold;
  }

  transitionToOpen() {
    if (this.state !== 'OPEN') {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
      this.nextAttempt = Date.now() + this.config.recoveryTimeout;
      this.metrics.stateChanges.open++;
      
      console.log('🔴 Circuit breaker OPENED');
      this.emit('stateChange', { state: 'OPEN', timestamp: Date.now() });
    }
  }

  transitionToHalfOpen() {
    if (this.state !== 'HALF_OPEN') {
      this.state = 'HALF_OPEN';
      this.lastStateChange = Date.now();
      this.metrics.stateChanges.halfOpen++;
      
      console.log('🟡 Circuit breaker HALF-OPEN');
      this.emit('stateChange', { state: 'HALF_OPEN', timestamp: Date.now() });
    }
  }

  transitionToClosed() {
    if (this.state !== 'CLOSED') {
      this.state = 'CLOSED';
      this.lastStateChange = Date.now();
      this.nextAttempt = null;
      this.metrics.stateChanges.closed++;
      
      console.log('🟢 Circuit breaker CLOSED');
      this.emit('stateChange', { state: 'CLOSED', timestamp: Date.now() });
    }
  }

  startMonitoring() {
    // Clean up old records every minute
    setInterval(() => {
      this.cleanOldRecords(this.successes);
      this.cleanOldRecords(this.failures);
      this.updateMetrics();
    }, 60000);
    
    // Log metrics every 5 minutes
    setInterval(() => {
      this.logMetrics();
    }, 300000);
  }

  async logFailure(error, duration) {
    if (!this.initialized) return;

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'log-circuit-breaker-failure',
        practiceId: 'global'
      };

      await SecureDataAccess.create('circuit_breaker_logs', {
        type: 'failure',
        error: error.message,
        duration,
        state: this.state,
        timestamp: new Date(),
        metrics: { ...this.metrics }
      }, context);
    } catch (logError) {
      console.error('Error logging circuit breaker failure:', logError);
    }
  }

  async logMetrics() {
    if (!this.initialized) return;

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'log-circuit-breaker-metrics',
        practiceId: 'global'
      };

      await SecureDataAccess.create('circuit_breaker_metrics', {
        state: this.state,
        metrics: { ...this.metrics },
        recentFailures: this.failures.length,
        recentSuccesses: this.successes.length,
        timestamp: new Date()
      }, context);
    } catch (logError) {
      console.error('Error logging circuit breaker metrics:', logError);
    }
  }

  getMetrics() {
    return {
      state: this.state,
      metrics: { ...this.metrics },
      recentFailures: this.failures.length,
      recentSuccesses: this.successes.length,
      config: { ...this.config },
      lastStateChange: new Date(this.lastStateChange),
      nextAttempt: this.nextAttempt ? new Date(this.nextAttempt) : null
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = [];
    this.successes = [];
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    this.nextAttempt = null;
    
    // Reset counters but keep cumulative metrics
    this.metrics.currentFailureRate = 0;
    this.metrics.lastReset = Date.now();
    
    console.log('🔄 Circuit breaker reset');
    this.emit('reset', { timestamp: Date.now() });
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Circuit breaker configuration updated', this.config);
  }
}

// Create and export singleton
const aiCircuitBreakerService = new AICircuitBreaker();
// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('aiCircuitBreakerService', () => aiCircuitBreakerService);
}

module.exports = aiCircuitBreakerService;