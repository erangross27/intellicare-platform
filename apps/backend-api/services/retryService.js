// Retry Service with Exponential Backoff
// Provides intelligent retry mechanisms for failed operations

class RetryService {
  constructor() {
    // Default retry configurations
    this.defaultConfigs = {
      standard: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED']
      },
      aggressive: {
        maxAttempts: 5,
        initialDelay: 500,
        maxDelay: 60000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNABORTED']
      },
      conservative: {
        maxAttempts: 2,
        initialDelay: 2000,
        maxDelay: 10000,
        backoffMultiplier: 1.5,
        jitter: false,
        retryableErrors: ['ETIMEDOUT', 'ECONNRESET']
      }
    };
    
    // Retry statistics
    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageAttempts: 0,
      operations: new Map()
    };
  }

  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('retry');
    return this;
  }
  
  /**
   * Execute function with retry logic
   */
  async execute(fn, options = {}) {
    const config = this.getConfig(options);
    const operationId = options.operationId || 'default';
    
    let lastError;
    let attempt = 0;
    
    // Initialize operation stats
    if (!this.stats.operations.has(operationId)) {
      this.stats.operations.set(operationId, {
        attempts: 0,
        successes: 0,
        failures: 0,
        lastError: null,
        lastSuccess: null
      });
    }
    
    const opStats = this.stats.operations.get(operationId);
    
    while (attempt < config.maxAttempts) {
      attempt++;
      this.stats.totalAttempts++;
      opStats.attempts++;
      
      try {
        // Log attempt
        if (attempt > 1) {
          console.log(`🔄 Retry attempt ${attempt}/${config.maxAttempts} for ${operationId}`);
        }
        
        // Execute function
        const result = await fn();
        
        // Success
        if (attempt > 1) {
          this.stats.successfulRetries++;
          console.log(`✅ Retry successful for ${operationId} after ${attempt} attempts`);
        }
        
        opStats.successes++;
        opStats.lastSuccess = new Date();
        
        // Update average attempts
        this.updateAverageAttempts();
        
        return result;
        
      } catch (error) {
        lastError = error;
        opStats.lastError = {
          message: error.message,
          code: error.code,
          timestamp: new Date()
        };
        
        // Check if error is retryable
        if (!this.isRetryable(error, config)) {
          console.log(`❌ Non-retryable error for ${operationId}: ${error.message}`);
          this.stats.failedRetries++;
          opStats.failures++;
          throw error;
        }
        
        // Check if we have more attempts
        if (attempt >= config.maxAttempts) {
          console.log(`❌ Max retry attempts reached for ${operationId}`);
          this.stats.failedRetries++;
          opStats.failures++;
          throw new Error(`Operation failed after ${attempt} attempts: ${error.message}`);
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, config);
        
        console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1} for ${operationId}`);
        
        // Wait before next attempt
        await this.delay(delay);
        
        // Optional: Call onRetry callback
        if (options.onRetry) {
          await options.onRetry(error, attempt);
        }
      }
    }
    
    // Should not reach here, but just in case
    throw lastError;
  }
  
  /**
   * Wrap function with retry logic
   */
  wrap(fn, options = {}) {
    return async (...args) => {
      return this.execute(() => fn(...args), options);
    };
  }
  
  /**
   * Get configuration
   */
  getConfig(options) {
    const preset = options.preset || 'standard';
    const baseConfig = this.defaultConfigs[preset] || this.defaultConfigs.standard;
    
    return {
      ...baseConfig,
      ...options,
      retryableErrors: options.retryableErrors || baseConfig.retryableErrors,
      retryableStatusCodes: options.retryableStatusCodes || [429, 502, 503, 504]
    };
  }
  
  /**
   * Check if error is retryable
   */
  isRetryable(error, config) {
    // Check error codes
    if (error.code && config.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check HTTP status codes
    if (error.response && error.response.status) {
      return config.retryableStatusCodes.includes(error.response.status);
    }
    
    // Check for specific error messages
    if (error.message) {
      const retryableMessages = [
        'timeout',
        'ETIMEDOUT',
        'network',
        'socket hang up',
        'ECONNRESET'
      ];
      
      return retryableMessages.some(msg => 
        error.message.toLowerCase().includes(msg.toLowerCase())
      );
    }
    
    // Check custom retry condition
    if (config.shouldRetry && typeof config.shouldRetry === 'function') {
      return config.shouldRetry(error);
    }
    
    return false;
  }
  
  /**
   * Calculate delay with exponential backoff
   */
  calculateDelay(attempt, config) {
    // Base delay calculation
    let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Cap at max delay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter if enabled
    if (config.jitter) {
      // Add random jitter between 0-25% of delay
      const jitter = Math.random() * 0.25 * delay;
      delay = delay + jitter;
    }
    
    return Math.round(delay);
  }
  
  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Update average attempts statistic
   */
  updateAverageAttempts() {
    const totalOps = this.stats.successfulRetries + this.stats.failedRetries;
    if (totalOps > 0) {
      this.stats.averageAttempts = this.stats.totalAttempts / totalOps;
    }
  }
  
  /**
   * Create retry policy for specific scenarios
   */
  createPolicy(name, config) {
    this.defaultConfigs[name] = config;
    return config;
  }
  
  /**
   * Get retry statistics
   */
  getStats() {
    return {
      ...this.stats,
      operations: Array.from(this.stats.operations.entries()).map(([name, stats]) => ({
        name,
        ...stats
      })),
      successRate: this.stats.totalAttempts > 0
        ? ((this.stats.successfulRetries / this.stats.totalAttempts) * 100).toFixed(2) + '%'
        : '0%'
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageAttempts: 0,
      operations: new Map()
    };
  }
  
  /**
   * Fibonacci backoff strategy
   */
  fibonacciBackoff(attempt, baseDelay = 1000, maxDelay = 30000) {
    const fib = (n) => {
      if (n <= 1) return n;
      return fib(n - 1) + fib(n - 2);
    };
    
    const delay = baseDelay * fib(attempt);
    return Math.min(delay, maxDelay);
  }
  
  /**
   * Linear backoff strategy
   */
  linearBackoff(attempt, increment = 1000, maxDelay = 30000) {
    const delay = attempt * increment;
    return Math.min(delay, maxDelay);
  }
  
  /**
   * Decorrelated jitter backoff (AWS recommended)
   */
  decorrelatedJitterBackoff(previousDelay, baseDelay = 1000, maxDelay = 30000) {
    const temp = Math.min(maxDelay, baseDelay * 3);
    return Math.random() * (temp - baseDelay) + baseDelay;
  }
}

// Export singleton instance
module.exports = new RetryService();