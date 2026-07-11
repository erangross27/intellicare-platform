// Distributed Tracing Middleware
// Provides automatic tracing for Express routes

const tracingService = require('../services/tracingService');
const opentelemetry = require('@opentelemetry/api');

/**
 * HTTP request tracing middleware
 */
const httpTracing = (req, res, next) => {
  // Create span for HTTP request
  const span = tracingService.startSpan(`${req.method} ${req.path}`, {
    kind: opentelemetry.SpanKind.SERVER,
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.target': req.path,
      'http.host': req.hostname,
      'http.scheme': req.protocol,
      'http.user_agent': req.headers['user-agent'],
      'http.request_content_length': req.headers['content-length'],
      'net.peer.ip': req.ip,
      'practice.subdomain': req.headers['x-practice-subdomain']
    }
  });
  
  // Store span in request
  req.span = span;
  
  // Extract trace context from headers if present
  const traceContext = tracingService.extractTraceContext(req.headers);
  if (traceContext) {
    span.setAttributes({
      'trace.parent_id': traceContext.spanId,
      'trace.parent_trace_id': traceContext.traceId
    });
  }
  
  // Override res.end to capture response info
  const originalEnd = res.end;
  const startTime = Date.now();
  
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    if (span) {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_content_length': res.get('content-length'),
        'http.duration': duration
      });
      
      // Set status based on HTTP code
      if (res.statusCode >= 400) {
        span.setStatus({
          code: opentelemetry.SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`
        });
      }
      
      tracingService.endSpan(span);
    }
    
    // Record response time metric
    tracingService.recordMetric('http_request_duration', duration, 'ms', {
      method: req.method,
      path: req.path,
      status: res.statusCode
    });
    
    return originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Database operation tracing
 */
const databaseTracing = (operation) => {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const span = tracingService.createDatabaseSpan(
        operation,
        this.constructor.name,
        args[0] // Assuming first arg is query
      );
      
      try {
        const result = await originalMethod.apply(this, args);
        tracingService.endSpan(span);
        return result;
      } catch (error) {
        tracingService.recordException(span, error);
        tracingService.endSpan(span, {
          code: opentelemetry.SpanStatusCode.ERROR
        });
        throw error;
      }
    };
    
    return descriptor;
  };
};

/**
 * Async operation tracing
 */
const asyncTracing = (name) => {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      return tracingService.withSpan(name || propertyKey, async (span) => {
        return originalMethod.apply(this, args);
      });
    };
    
    return descriptor;
  };
};

/**
 * Error tracking middleware
 */
const errorTracking = (err, req, res, next) => {
  if (req.span) {
    tracingService.recordException(req.span, err);
  }
  
  // Record error metric
  tracingService.recordMetric('errors', 1, 'count', {
    path: req.path,
    method: req.method,
    error: err.name
  });
  
  next(err);
};

/**
 * Performance tracking for specific operations
 */
const performanceTracking = (operationName) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Create child span if parent exists
    let span;
    if (req.span) {
      span = tracingService.startSpan(operationName, {
        kind: opentelemetry.SpanKind.INTERNAL,
        attributes: {
          'operation.type': 'middleware'
        }
      });
    }
    
    // Override next to track completion
    const originalNext = next;
    next = function(...args) {
      const duration = Date.now() - startTime;
      
      if (span) {
        span.setAttribute('operation.duration', duration);
        tracingService.endSpan(span);
      }
      
      tracingService.recordMetric(`operation_${operationName}_duration`, duration);
      
      return originalNext.apply(this, args);
    };
    
    next();
  };
};

/**
 * Trace context injection for outgoing requests
 */
const injectTraceContext = (headers = {}) => {
  return tracingService.injectTraceContext(headers);
};

/**
 * Create traced wrapper for async functions
 */
const traced = (name, options = {}) => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      return tracingService.withSpan(
        name || `${target.constructor.name}.${propertyKey}`,
        async (span) => {
          // Add method attributes
          span.setAttributes({
            'method.class': target.constructor.name,
            'method.name': propertyKey,
            ...options.attributes
          });
          
          try {
            const result = await originalMethod.apply(this, args);
            return result;
          } catch (error) {
            tracingService.recordException(span, error);
            throw error;
          }
        },
        options
      );
    };
    
    return descriptor;
  };
};

/**
 * Batch operation tracing
 */
const batchTracing = (batchName) => {
  return async (items, processFn) => {
    return tracingService.withSpan(`batch_${batchName}`, async (parentSpan) => {
      parentSpan.setAttribute('batch.size', items.length);
      
      const results = [];
      const errors = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        await tracingService.withSpan(`${batchName}_item_${i}`, async (span) => {
          span.setAttribute('batch.index', i);
          
          try {
            const result = await processFn(item, i);
            results.push(result);
          } catch (error) {
            errors.push({ index: i, error });
            tracingService.recordException(span, error);
          }
        });
      }
      
      parentSpan.setAttributes({
        'batch.success': results.length,
        'batch.errors': errors.length
      });
      
      if (errors.length > 0) {
        parentSpan.setStatus({
          code: opentelemetry.SpanStatusCode.ERROR,
          message: `${errors.length} items failed`
        });
      }
      
      return { results, errors };
    });
  };
};

/**
 * Cache operation tracing
 */
const cacheTracing = (operation, key) => {
  const span = tracingService.startSpan(`cache.${operation}`, {
    kind: opentelemetry.SpanKind.CLIENT,
    attributes: {
      'cache.operation': operation,
      'cache.key': key
    }
  });
  
  return {
    hit: () => {
      span.setAttribute('cache.hit', true);
      tracingService.endSpan(span);
    },
    miss: () => {
      span.setAttribute('cache.hit', false);
      tracingService.endSpan(span);
    },
    error: (error) => {
      tracingService.recordException(span, error);
      tracingService.endSpan(span, {
        code: opentelemetry.SpanStatusCode.ERROR
      });
    }
  };
};

module.exports = {
  httpTracing,
  databaseTracing,
  asyncTracing,
  errorTracking,
  performanceTracking,
  injectTraceContext,
  traced,
  batchTracing,
  cacheTracing
};