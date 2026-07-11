// Distributed Tracing Routes
// Provides endpoints for trace visualization and monitoring

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const tracingService = require('../services/tracingService');
const { practiceAuth } = require('../middleware/practiceAuth');

// @route   GET /api/tracing/traces
// @desc    Get recent traces
// @access  Protected
router.get('/traces', practiceAuth, asyncHandler(async (req, res) => {
  const { limit = 50 } = req.query;
  
  try {
    const traces = tracingService.getRecentTraces(parseInt(limit));
    
    res.json({
      success: true,
      count: traces.length,
      traces
    });
  } catch (error) {
    console.error('Traces retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve traces'
    });
  }
}));

// @route   GET /api/tracing/traces/:traceId
// @desc    Get specific trace
// @access  Protected
router.get('/traces/:traceId', practiceAuth, asyncHandler(async (req, res) => {
  const { traceId } = req.params;
  
  try {
    const trace = tracingService.getTrace(traceId);
    
    if (!trace || trace.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Trace ${traceId} not found`
      });
    }
    
    res.json({
      success: true,
      trace
    });
  } catch (error) {
    console.error('Trace retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve trace'
    });
  }
}));

// @route   GET /api/tracing/traces/:traceId/visualization
// @desc    Get trace visualization data
// @access  Protected
router.get('/traces/:traceId/visualization', practiceAuth, asyncHandler(async (req, res) => {
  const { traceId } = req.params;
  
  try {
    const visualization = tracingService.getTraceVisualization(traceId);
    
    if (!visualization) {
      return res.status(404).json({
        success: false,
        message: `Trace ${traceId} not found`
      });
    }
    
    res.json({
      success: true,
      visualization
    });
  } catch (error) {
    console.error('Trace visualization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate visualization'
    });
  }
}));

// @route   GET /api/tracing/active-spans
// @desc    Get currently active spans
// @access  Protected
router.get('/active-spans', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const activeSpans = tracingService.getActiveSpans();
    
    res.json({
      success: true,
      count: activeSpans.length,
      spans: activeSpans
    });
  } catch (error) {
    console.error('Active spans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve active spans'
    });
  }
}));

// @route   GET /api/tracing/metrics
// @desc    Get performance metrics
// @access  Protected
router.get('/metrics', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const metrics = tracingService.getPerformanceMetrics();
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Metrics retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve metrics'
    });
  }
}));

// @route   POST /api/tracing/span
// @desc    Create manual span
// @access  Protected
router.post('/span', practiceAuth, asyncHandler(async (req, res) => {
  const { name, attributes = {}, kind = 'INTERNAL' } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Span name required'
    });
  }
  
  try {
    const span = tracingService.startSpan(name, {
      attributes,
      kind
    });
    
    if (!span) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create span'
      });
    }
    
    const spanContext = span.spanContext();
    
    res.json({
      success: true,
      span: {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId
      }
    });
    
    // End span after response
    setTimeout(() => {
      tracingService.endSpan(span);
    }, 100);
  } catch (error) {
    console.error('Span creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create span'
    });
  }
}));

// @route   POST /api/tracing/span/:spanId/event
// @desc    Add event to span
// @access  Protected
router.post('/span/:spanId/event', practiceAuth, asyncHandler(async (req, res) => {
  const { spanId } = req.params;
  const { name, attributes = {} } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Event name required'
    });
  }
  
  try {
    // Get span from active spans
    const activeSpan = tracingService.activeSpans.get(spanId);
    
    if (!activeSpan) {
      return res.status(404).json({
        success: false,
        message: `Span ${spanId} not found or not active`
      });
    }
    
    tracingService.addEvent(activeSpan.span, name, attributes);
    
    res.json({
      success: true,
      message: 'Event added to span'
    });
  } catch (error) {
    console.error('Event addition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add event'
    });
  }
}));

// @route   GET /api/tracing/config
// @desc    Get tracing configuration
// @access  Protected
router.get('/config', practiceAuth, asyncHandler(async (req, res) => {
  try {
    res.json({
      success: true,
      config: tracingService.config
    });
  } catch (error) {
    console.error('Config retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve configuration'
    });
  }
}));

// @route   GET /api/tracing/health
// @desc    Check tracing service health
// @access  Protected
router.get('/health', practiceAuth, asyncHandler(async (req, res) => {
  try {
    const health = {
      status: tracingService.tracer ? 'healthy' : 'unhealthy',
      activeSpans: tracingService.activeSpans.size,
      storedTraces: tracingService.traces.length,
      metrics: Object.keys(tracingService.performanceMetrics).length
    };
    
    res.json({
      success: true,
      health
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check health'
    });
  }
}));

// @route   POST /api/tracing/test
// @desc    Test tracing with sample operation
// @access  Protected
router.post('/test', practiceAuth, asyncHandler(async (req, res) => {
  try {
    // Create a test trace
    await tracingService.withSpan('test-operation', async (span) => {
      // Add some attributes
      tracingService.setAttributes(span, {
        'test.type': 'manual',
        'test.user': req.user?._id || 'unknown'
      });
      
      // Add an event
      tracingService.addEvent(span, 'test-event', {
        message: 'This is a test event'
      });
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simulate nested span
      await tracingService.withSpan('nested-operation', async (nestedSpan) => {
        tracingService.setAttributes(nestedSpan, {
          'nested.level': 1
        });
        
        await new Promise(resolve => setTimeout(resolve, 50));
      });
    });
    
    res.json({
      success: true,
      message: 'Test trace created successfully'
    });
  } catch (error) {
    console.error('Test trace error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test trace'
    });
  }
}));

module.exports = router;