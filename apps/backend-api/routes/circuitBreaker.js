// Circuit Breaker Routes
// Provides endpoints for circuit breaker monitoring and management

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const circuitBreakerService = require('../services/circuitBreakerService');
const retryService = require('../services/retryService');
const { practiceAuth } = require('../middleware/practiceAuth');

// @route   GET /api/circuit-breaker/status
// @desc    Get all circuit breakers status
// @access  Protected
router.get('/status', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const status = circuitBreakerService.getAllStatus();
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Circuit breaker status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve circuit breaker status'
    });
  }
}));

// @route   GET /api/circuit-breaker/health
// @desc    Get circuit breaker health check
// @access  Protected
router.get('/health', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const health = circuitBreakerService.healthCheck();
    
    // Set appropriate status code based on health
    let statusCode = 200;
    if (health.unhealthy) {
      statusCode = 503; // Service Unavailable
    } else if (health.degraded) {
      statusCode = 207; // Multi-Status (partially available)
    }
    
    res.status(statusCode).json({
      success: true,
      ...health
    });
  } catch (error) {
    console.error('Circuit breaker health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check circuit breaker health'
    });
  }
}));

// @route   GET /api/circuit-breaker/:name/status
// @desc    Get specific circuit breaker status
// @access  Protected
router.get('/:name/status', practiceAuth, asyncHandler(async (req, res) => {
  const { name } = req.params;
  
  try {
    const breaker = circuitBreakerService.breakers.get(name);
    
    if (!breaker) {
      return res.status(404).json({
        success: false,
        message: `Circuit breaker ${name} not found`
      });
    }
    
    const status = breaker.getStatus();
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Circuit breaker status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve circuit breaker status'
    });
  }
}));

// @route   POST /api/circuit-breaker/:name/reset
// @desc    Reset specific circuit breaker
// @access  Protected (Admin only)
router.post('/:name/reset', practiceAuth, asyncHandler(async (req, res) => {
  const { name } = req.params;
  
  try {
    const success = circuitBreakerService.reset(name);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: `Circuit breaker ${name} not found`
      });
    }
    
    res.json({
      success: true,
      message: `Circuit breaker ${name} has been reset`
    });
  } catch (error) {
    console.error('Circuit breaker reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset circuit breaker'
    });
  }
}));

// @route   POST /api/circuit-breaker/reset-all
// @desc    Reset all circuit breakers
// @access  Protected (Admin only)
router.post('/reset-all', practiceAuth, asyncHandler(async (req, res) => {
  try {
    circuitBreakerService.resetAll();
    
    res.json({
      success: true,
      message: 'All circuit breakers have been reset'
    });
  } catch (error) {
    console.error('Circuit breaker reset all error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset circuit breakers'
    });
  }
}));

// @route   POST /api/circuit-breaker/:name/open
// @desc    Force circuit breaker to open
// @access  Protected (Admin only)
router.post('/:name/open', practiceAuth, asyncHandler(async (req, res) => {
  const { name } = req.params;
  
  try {
    const breaker = circuitBreakerService.breakers.get(name);
    
    if (!breaker) {
      return res.status(404).json({
        success: false,
        message: `Circuit breaker ${name} not found`
      });
    }
    
    breaker.open();
    
    res.json({
      success: true,
      message: `Circuit breaker ${name} is now OPEN`
    });
  } catch (error) {
    console.error('Circuit breaker open error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to open circuit breaker'
    });
  }
}));

// @route   POST /api/circuit-breaker/:name/close
// @desc    Force circuit breaker to close
// @access  Protected (Admin only)
router.post('/:name/close', practiceAuth, asyncHandler(async (req, res) => {
  const { name } = req.params;
  
  try {
    const breaker = circuitBreakerService.breakers.get(name);
    
    if (!breaker) {
      return res.status(404).json({
        success: false,
        message: `Circuit breaker ${name} not found`
      });
    }
    
    breaker.close();
    
    res.json({
      success: true,
      message: `Circuit breaker ${name} is now CLOSED`
    });
  } catch (error) {
    console.error('Circuit breaker close error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to close circuit breaker'
    });
  }
}));

// @route   GET /api/circuit-breaker/retry/stats
// @desc    Get retry service statistics
// @access  Protected
router.get('/retry/stats', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const stats = retryService.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Retry stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve retry statistics'
    });
  }
}));

// @route   POST /api/circuit-breaker/retry/reset-stats
// @desc    Reset retry service statistics
// @access  Protected (Admin only)
router.post('/retry/reset-stats', practiceAuth, asyncHandler(async (req, res) => {
  try {
    retryService.resetStats();
    
    res.json({
      success: true,
      message: 'Retry statistics have been reset'
    });
  } catch (error) {
    console.error('Retry stats reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset retry statistics'
    });
  }
}));

// @route   POST /api/circuit-breaker/test
// @desc    Test circuit breaker with simulated failures
// @access  Protected
router.post('/test', practiceAuth, asyncHandler(async (req, res) => {
  const { serviceName = 'test-service', failureRate = 0.5 } = req.body;
  
  try {
    // Create a test function that fails based on failure rate
    const testFunction = async () => {
      if (Math.random() < failureRate) {
        throw new Error('Simulated failure');
      }
      return { success: true, message: 'Operation successful' };
    };
    
    // Get or create circuit breaker for test
    const breaker = circuitBreakerService.getBreaker(serviceName, 'api', {
      timeout: 1000,
      errorThreshold: 3,
      resetTimeout: 5000
    });
    
    // Execute with circuit breaker
    try {
      const result = await breaker.execute(testFunction);
      
      res.json({
        success: true,
        result,
        breakerState: breaker.state,
        stats: breaker.getStatus().stats
      });
    } catch (error) {
      res.json({
        success: false,
        error: error.message,
        breakerState: breaker.state,
        stats: breaker.getStatus().stats
      });
    }
  } catch (error) {
    console.error('Circuit breaker test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test circuit breaker'
    });
  }
}));

// @route   POST /api/circuit-breaker/test-retry
// @desc    Test retry service with simulated failures
// @access  Protected
router.post('/test-retry', practiceAuth, asyncHandler(async (req, res) => {
  const { failureCount = 2, maxAttempts = 3 } = req.body;
  
  try {
    let attemptCount = 0;
    
    // Create a test function that fails N times then succeeds
    const testFunction = async () => {
      attemptCount++;
      if (attemptCount <= failureCount) {
        throw new Error(`Simulated failure ${attemptCount}`);
      }
      return { success: true, message: `Success after ${attemptCount} attempts` };
    };
    
    // Execute with retry
    try {
      const result = await retryService.execute(testFunction, {
        maxAttempts,
        initialDelay: 100,
        preset: 'aggressive',
        operationId: 'test-retry'
      });
      
      res.json({
        success: true,
        result,
        attempts: attemptCount,
        stats: retryService.getStats()
      });
    } catch (error) {
      res.json({
        success: false,
        error: error.message,
        attempts: attemptCount,
        stats: retryService.getStats()
      });
    }
  } catch (error) {
    console.error('Retry test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test retry service'
    });
  }
}));

module.exports = router;