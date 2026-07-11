// Circuit Breaker Service
// Implements circuit breaker pattern for external service resilience

const EventEmitter = require('events');

// Circuit states
const STATES = {
  CLOSED: 'CLOSED',      // Normal operation
  OPEN: 'OPEN',          // Failing, reject all requests
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

class CircuitBreaker extends EventEmitter {
  constructor(name, options = {}) {
    super();
    
    this.name = name;
    this.state = STATES.CLOSED;
    
    // Configuration
    this.config = {
      timeout: options.timeout || 3000,                    // Request timeout in ms
      errorThreshold: options.errorThreshold || 5,         // Failures before opening
      successThreshold: options.successThreshold || 2,     // Successes to close from half-open
      resetTimeout: options.resetTimeout || 30000,         // Time before trying half-open
      volumeThreshold: options.volumeThreshold || 10,      // Min requests for statistics
      errorPercentageThreshold: options.errorPercentageThreshold || 50, // Error % to open
      monitoringPeriod: options.monitoringPeriod || 10000  // Rolling window for stats
    };
    
    // Statistics
    this.stats = {
      requests: 0,
      failures: 0,
      successes: 0,
      rejections: 0,
      timeouts: 0,
      fallbacks: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      latencies: [],
      errorTypes: new Map()
    };
    
    // Rolling window for monitoring
    this.rollingWindow = [];
    this.windowSize = this.config.monitoringPeriod;
    
    // State management
    this.nextAttempt = Date.now();
    this.halfOpenTests = 0;
    
    // Fallback function
    this.fallbackFn = options.fallback || null;
    
    // Start monitoring
    this.startMonitoring();
  }
  
  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn, ...args) {
    // Check if circuit should be opened based on stats
    this.evaluateState();
    
    // Record request
    this.stats.requests++;
    const startTime = Date.now();
    
    // Check circuit state
    if (this.state === STATES.OPEN) {
      // Check if we should try half-open
      if (Date.now() >= this.nextAttempt) {
        this.transitionToHalfOpen();
      } else {
        // Reject request
        this.stats.rejections++;
        this.emit('rejected', { name: this.name, state: this.state });
        
        // Try fallback if available
        if (this.fallbackFn) {
          this.stats.fallbacks++;
          return this.fallbackFn(...args);
        }
        
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }
    
    try {
      // Set timeout for the request
      const result = await this.withTimeout(fn(...args), this.config.timeout);
      
      // Record success
      this.onSuccess(Date.now() - startTime);
      
      return result;
    } catch (error) {
      // Record failure
      this.onFailure(error, Date.now() - startTime);
      
      // Try fallback if available
      if (this.fallbackFn) {
        this.stats.fallbacks++;
        this.emit('fallback', { name: this.name, error: error.message });
        return this.fallbackFn(...args);
      }
      
      throw error;
    }
  }
  
  /**
   * Wrap promise with timeout
   */
  async withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => {
          this.stats.timeouts++;
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout)
      )
    ]);
  }
  
  /**
   * Handle successful request
   */
  onSuccess(latency) {
    this.stats.successes++;
    this.stats.consecutiveSuccesses++;
    this.stats.consecutiveFailures = 0;
    this.stats.lastSuccessTime = Date.now();
    this.stats.latencies.push(latency);
    
    // Keep only last 100 latencies
    if (this.stats.latencies.length > 100) {
      this.stats.latencies.shift();
    }
    
    // Add to rolling window
    this.addToWindow({ success: true, timestamp: Date.now(), latency });
    
    // Handle state transitions
    if (this.state === STATES.HALF_OPEN) {
      if (this.stats.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }
    
    this.emit('success', { 
      name: this.name, 
      latency,
      state: this.state 
    });
  }
  
  /**
   * Handle failed request
   */
  onFailure(error, latency) {
    this.stats.failures++;
    this.stats.consecutiveFailures++;
    this.stats.consecutiveSuccesses = 0;
    this.stats.lastFailureTime = Date.now();
    
    // Track error types
    const errorType = error.name || 'UnknownError';
    this.stats.errorTypes.set(
      errorType, 
      (this.stats.errorTypes.get(errorType) || 0) + 1
    );
    
    // Add to rolling window
    this.addToWindow({ success: false, timestamp: Date.now(), latency, error: errorType });
    
    // Handle state transitions
    if (this.state === STATES.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.state === STATES.CLOSED) {
      if (this.stats.consecutiveFailures >= this.config.errorThreshold) {
        this.transitionToOpen();
      }
    }
    
    this.emit('failure', { 
      name: this.name, 
      error: error.message,
      errorType,
      state: this.state 
    });
  }
  
  /**
   * Add event to rolling window
   */
  addToWindow(event) {
    const now = Date.now();
    this.rollingWindow.push(event);
    
    // Remove old events outside window
    this.rollingWindow = this.rollingWindow.filter(
      e => now - e.timestamp < this.windowSize
    );
  }
  
  /**
   * Evaluate if state should change based on statistics
   */
  evaluateState() {
    if (this.state !== STATES.CLOSED) return;
    
    // Check if we have enough volume
    if (this.rollingWindow.length < this.config.volumeThreshold) return;
    
    // Calculate error percentage
    const failures = this.rollingWindow.filter(e => !e.success).length;
    const errorPercentage = (failures / this.rollingWindow.length) * 100;
    
    // Open circuit if error percentage exceeds threshold
    if (errorPercentage >= this.config.errorPercentageThreshold) {
      this.transitionToOpen();
    }
  }
  
  /**
   * Transition to OPEN state
   */
  transitionToOpen() {
    this.state = STATES.OPEN;
    this.nextAttempt = Date.now() + this.config.resetTimeout;
    this.emit('open', { 
      name: this.name,
      nextAttempt: new Date(this.nextAttempt)
    });
    
    console.log(`🔴 Circuit Breaker [${this.name}] is now OPEN`);
  }
  
  /**
   * Transition to HALF_OPEN state
   */
  transitionToHalfOpen() {
    this.state = STATES.HALF_OPEN;
    this.stats.consecutiveSuccesses = 0;
    this.stats.consecutiveFailures = 0;
    this.emit('half-open', { name: this.name });
    
    console.log(`🟡 Circuit Breaker [${this.name}] is now HALF-OPEN`);
  }
  
  /**
   * Transition to CLOSED state
   */
  transitionToClosed() {
    this.state = STATES.CLOSED;
    this.stats.consecutiveFailures = 0;
    this.emit('closed', { name: this.name });
    
    console.log(`🟢 Circuit Breaker [${this.name}] is now CLOSED`);
  }
  
  /**
   * Force circuit to open
   */
  open() {
    this.transitionToOpen();
  }
  
  /**
   * Force circuit to close
   */
  close() {
    this.transitionToClosed();
  }
  
  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = STATES.CLOSED;
    this.stats = {
      requests: 0,
      failures: 0,
      successes: 0,
      rejections: 0,
      timeouts: 0,
      fallbacks: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      latencies: [],
      errorTypes: new Map()
    };
    this.rollingWindow = [];
    this.nextAttempt = Date.now();
    
    this.emit('reset', { name: this.name });
  }
  
  /**
   * Get current status
   */
  getStatus() {
    const avgLatency = this.stats.latencies.length > 0
      ? this.stats.latencies.reduce((a, b) => a + b, 0) / this.stats.latencies.length
      : 0;
    
    const errorRate = this.stats.requests > 0
      ? (this.stats.failures / this.stats.requests) * 100
      : 0;
    
    return {
      name: this.name,
      state: this.state,
      stats: {
        ...this.stats,
        errorTypes: Array.from(this.stats.errorTypes.entries()),
        avgLatency: Math.round(avgLatency),
        errorRate: errorRate.toFixed(2)
      },
      config: this.config,
      isOpen: this.state === STATES.OPEN,
      nextAttempt: this.state === STATES.OPEN ? new Date(this.nextAttempt) : null
    };
  }
  
  /**
   * Start monitoring for dashboard
   */
  startMonitoring() {
    // Emit status every 5 seconds for monitoring
    this.monitoringInterval = setInterval(() => {
      this.emit('status', this.getStatus());
    }, 5000);
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

/**
 * Circuit Breaker Manager
 */
class CircuitBreakerService {
  constructor() {
    this.breakers = new Map();
    this.globalStats = {
      totalRequests: 0,
      totalFailures: 0,
      totalFallbacks: 0,
      totalRejections: 0
    };
    
    // Default configurations for different service types
    this.defaultConfigs = {
      ai: {
        timeout: 30000,
        errorThreshold: 3,
        successThreshold: 2,
        resetTimeout: 60000,
        errorPercentageThreshold: 50
      },
      database: {
        timeout: 5000,
        errorThreshold: 5,
        successThreshold: 3,
        resetTimeout: 30000,
        errorPercentageThreshold: 60
      },
      api: {
        timeout: 10000,
        errorThreshold: 5,
        successThreshold: 2,
        resetTimeout: 30000,
        errorPercentageThreshold: 50
      },
      cache: {
        timeout: 1000,
        errorThreshold: 10,
        successThreshold: 5,
        resetTimeout: 10000,
        errorPercentageThreshold: 70
      }
    };
  }

  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('circuit-breaker');
    return this;
  }
  
  /**
   * Create or get circuit breaker
   */
  getBreaker(name, type = 'api', customConfig = {}) {
    if (!this.breakers.has(name)) {
      const config = {
        ...this.defaultConfigs[type] || this.defaultConfigs.api,
        ...customConfig
      };
      
      const breaker = new CircuitBreaker(name, config);
      
      // Track global stats
      breaker.on('success', () => this.globalStats.totalRequests++);
      breaker.on('failure', () => {
        this.globalStats.totalRequests++;
        this.globalStats.totalFailures++;
      });
      breaker.on('fallback', () => this.globalStats.totalFallbacks++);
      breaker.on('rejected', () => this.globalStats.totalRejections++);
      
      this.breakers.set(name, breaker);
      
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔌 Circuit Breaker created: ${name} (${type})`);
    }
    
    return this.breakers.get(name);
  }
  
  /**
   * Execute with circuit breaker
   */
  async execute(name, fn, options = {}) {
    const breaker = this.getBreaker(name, options.type || 'api', options.config || {});
    return breaker.execute(fn);
  }
  
  /**
   * Wrap function with circuit breaker
   */
  wrap(name, fn, options = {}) {
    const breaker = this.getBreaker(name, options.type || 'api', options.config || {});
    
    return async (...args) => {
      return breaker.execute(fn, ...args);
    };
  }
  
  /**
   * Create middleware for Express routes
   */
  middleware(name, options = {}) {
    return async (req, res, next) => {
      const breaker = this.getBreaker(name, options.type || 'api', options.config || {});
      
      // Add circuit breaker to request
      req.circuitBreaker = breaker;
      
      // Check if circuit is open
      if (breaker.state === STATES.OPEN) {
        const status = breaker.getStatus();
        
        return res.status(503).json({
          success: false,
          message: `Service temporarily unavailable (Circuit Open)`,
          service: name,
          retryAfter: status.nextAttempt
        });
      }
      
      next();
    };
  }
  
  /**
   * Get all circuit breakers status
   */
  getAllStatus() {
    const status = {};
    
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getStatus();
    }
    
    return {
      breakers: status,
      global: this.globalStats,
      summary: {
        total: this.breakers.size,
        open: Array.from(this.breakers.values()).filter(b => b.state === STATES.OPEN).length,
        halfOpen: Array.from(this.breakers.values()).filter(b => b.state === STATES.HALF_OPEN).length,
        closed: Array.from(this.breakers.values()).filter(b => b.state === STATES.CLOSED).length
      }
    };
  }
  
  /**
   * Reset specific breaker
   */
  reset(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }
  
  /**
   * Reset all breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
  
  /**
   * Health check for circuit breakers
   */
  healthCheck() {
    const status = this.getAllStatus();
    
    return {
      healthy: status.summary.open === 0,
      degraded: status.summary.open > 0 && status.summary.open < status.summary.total,
      unhealthy: status.summary.open === status.summary.total,
      details: status
    };
  }
}

// Export singleton instance
module.exports = new CircuitBreakerService();