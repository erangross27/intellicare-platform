// Circuit Breaker Middleware
// Provides circuit breaker protection for routes and services

const circuitBreakerService = require('../services/circuitBreakerService');
const retryService = require('../services/retryService');

/**
 * Apply circuit breaker to AI service calls
 */
const aiServiceBreaker = (serviceName = 'ai-service') => {
  return async (req, res, next) => {
    const breaker = circuitBreakerService.getBreaker(serviceName, 'ai', {
      timeout: 30000,
      errorThreshold: 3,
      resetTimeout: 60000,
      fallback: async () => ({
        success: false,
        message: 'AI service temporarily unavailable. Please try again later.',
        fallbackUsed: true
      })
    });
    
    // Check if circuit is open
    if (breaker.state === 'OPEN') {
      const status = breaker.getStatus();
      
      return res.status(503).json({
        success: false,
        message: 'AI service is temporarily unavailable',
        service: serviceName,
        retryAfter: status.nextAttempt,
        fallback: true
      });
    }
    
    // Add breaker to request for use in route handlers
    req.aiBreaker = breaker;
    req.wrapAiCall = (fn) => breaker.execute(fn);
    
    next();
  };
};

/**
 * Apply circuit breaker to database operations
 */
const databaseBreaker = (operationName = 'database') => {
  return async (req, res, next) => {
    const breaker = circuitBreakerService.getBreaker(operationName, 'database', {
      timeout: 5000,
      errorThreshold: 5,
      resetTimeout: 30000
    });
    
    // Add breaker to request
    req.dbBreaker = breaker;
    req.wrapDbCall = (fn) => breaker.execute(fn);
    
    next();
  };
};

/**
 * Apply circuit breaker to external API calls
 */
const apiBreaker = (apiName = 'external-api') => {
  return async (req, res, next) => {
    const breaker = circuitBreakerService.getBreaker(apiName, 'api', {
      timeout: 10000,
      errorThreshold: 5,
      resetTimeout: 30000
    });
    
    // Check if circuit is open
    if (breaker.state === 'OPEN') {
      const status = breaker.getStatus();
      
      return res.status(503).json({
        success: false,
        message: `External service ${apiName} is temporarily unavailable`,
        service: apiName,
        retryAfter: status.nextAttempt
      });
    }
    
    // Add breaker to request
    req.apiBreaker = breaker;
    req.wrapApiCall = (fn) => breaker.execute(fn);
    
    next();
  };
};

/**
 * Apply retry logic to operations
 */
const withRetry = (options = {}) => {
  return async (req, res, next) => {
    req.retry = (fn, customOptions = {}) => {
      return retryService.execute(fn, {
        ...options,
        ...customOptions,
        operationId: customOptions.operationId || req.path
      });
    };
    
    next();
  };
};

/**
 * Combined resilience middleware (circuit breaker + retry)
 */
const resilience = (serviceName, options = {}) => {
  return async (req, res, next) => {
    const breakerConfig = options.breaker || {};
    const retryConfig = options.retry || {};
    
    // Get circuit breaker
    const breaker = circuitBreakerService.getBreaker(
      serviceName,
      options.type || 'api',
      breakerConfig
    );
    
    // Check if circuit is open
    if (breaker.state === 'OPEN' && !options.allowOpen) {
      const status = breaker.getStatus();
      
      return res.status(503).json({
        success: false,
        message: `Service ${serviceName} is temporarily unavailable`,
        service: serviceName,
        retryAfter: status.nextAttempt
      });
    }
    
    // Add resilient execution function
    req.resilientExecute = async (fn) => {
      // Wrap with retry
      const retryWrapper = () => retryService.execute(fn, {
        ...retryConfig,
        operationId: `${serviceName}-${req.path}`
      });
      
      // Then wrap with circuit breaker
      return breaker.execute(retryWrapper);
    };
    
    // Add individual wrappers
    req.breaker = breaker;
    req.retry = (fn) => retryService.execute(fn, retryConfig);
    
    next();
  };
};

/**
 * Health check aggregator middleware
 */
const healthCheckAggregator = async (req, res, next) => {
  req.getSystemHealth = () => {
    const circuitHealth = circuitBreakerService.healthCheck();
    const retryStats = retryService.getStats();
    
    // Determine overall health
    let overallHealth = 'healthy';
    if (circuitHealth.unhealthy) {
      overallHealth = 'unhealthy';
    } else if (circuitHealth.degraded) {
      overallHealth = 'degraded';
    }
    
    return {
      status: overallHealth,
      components: {
        circuitBreakers: circuitHealth,
        retryService: {
          totalAttempts: retryStats.totalAttempts,
          successRate: retryStats.successRate,
          operations: retryStats.operations.length
        }
      },
      timestamp: new Date()
    };
  };
  
  next();
};

/**
 * Circuit breaker monitoring middleware
 */
const monitorCircuits = async (req, res, next) => {
  // Log circuit breaker events
  const logEvent = (eventType, data) => {
    console.log(`[Circuit Breaker] ${eventType}:`, {
      service: data.name,
      state: data.state,
      timestamp: new Date()
    });
  };
  
  // Get all breakers and attach listeners if not already attached
  const breakers = circuitBreakerService.breakers;
  
  for (const [name, breaker] of breakers) {
    if (!breaker.listenerCount('open')) {
      breaker.on('open', (data) => logEvent('OPENED', data));
      breaker.on('half-open', (data) => logEvent('HALF-OPEN', data));
      breaker.on('closed', (data) => logEvent('CLOSED', data));
    }
  }
  
  next();
};

/**
 * Response time circuit breaker
 */
const responseTimeBreaker = (maxResponseTime = 5000) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.end to check response time
    const originalEnd = res.end;
    res.end = function(...args) {
      const responseTime = Date.now() - startTime;
      
      // If response time is too high, increment circuit breaker failure
      if (responseTime > maxResponseTime) {
        const breaker = circuitBreakerService.getBreaker('response-time', 'api');
        breaker.stats.failures++;
        breaker.stats.consecutiveFailures++;
        
        console.warn(`⚠️ Slow response detected: ${responseTime}ms on ${req.path}`);
      }
      
      return originalEnd.apply(this, args);
    };
    
    next();
  };
};

module.exports = {
  aiServiceBreaker,
  databaseBreaker,
  apiBreaker,
  withRetry,
  resilience,
  healthCheckAggregator,
  monitorCircuits,
  responseTimeBreaker
};