// Distributed Tracing Service
// Provides OpenTelemetry-based tracing and performance monitoring

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const resources = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const opentelemetry = require('@opentelemetry/api');
const secureConfigService = require('../services/secureConfigService');
const { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { PerformanceObserver, performance } = require('perf_hooks');

class TracingService {
  constructor() {
    // Tracer instance
    this.tracer = null;
    
    // SDK instance
    this.sdk = null;
    
    // Active spans
    this.activeSpans = new Map();
    
    // Trace storage (for visualization)
    this.traces = [];
    this.maxTraces = 1000;
    
    // Performance metrics
    this.performanceMetrics = new Map();
    
    // Configuration
    this.config = {
      serviceName: secureConfigService.get('SERVICE_NAME') || 'intellicare-backend',
      serviceVersion: secureConfigService.get('SERVICE_VERSION') || '1.0.0',
      environment: secureConfigService.get('NODE_ENV') || 'development',
      otlpEndpoint: secureConfigService.get('OTLP_ENDPOINT') || 'http://localhost:4318/v1/traces'
    };
    
    // Span attributes
    this.defaultAttributes = {
      'service.environment': this.config.environment,
      'service.version': this.config.serviceVersion
    };
    
    // Performance observer
    this.performanceObserver = null;
  }
  
  /**
   * Initialize OpenTelemetry SDK
   */
  async initialize() {
    try {
      // Simple initialization for development
      // Just create a basic tracer without full SDK for now
      this.tracer = opentelemetry.trace.getTracer(
        this.config.serviceName,
        this.config.serviceVersion
      );
      
      // Setup performance monitoring
      this.setupPerformanceMonitoring();
      
      // Distributed Tracing Service initialized with OpenTelemetry
      
      return true;
    } catch (error) {
      console.error('Tracing initialization error:', error);
      // Don't throw - tracing should not break the application
      return false;
    }
  }
  
  /**
   * Create a new span
   */
  startSpan(name, options = {}) {
    if (!this.tracer) return null;
    
    const span = this.tracer.startSpan(name, {
      attributes: {
        ...this.defaultAttributes,
        ...options.attributes
      },
      kind: options.kind || opentelemetry.SpanKind.INTERNAL
    });
    
    // Store active span
    const spanId = span.spanContext().spanId;
    this.activeSpans.set(spanId, {
      span,
      name,
      startTime: Date.now()
    });
    
    return span;
  }
  
  /**
   * End a span
   */
  endSpan(span, status = { code: opentelemetry.SpanStatusCode.OK }) {
    if (!span) return;
    
    span.setStatus(status);
    span.end();
    
    // Remove from active spans
    const spanId = span.spanContext().spanId;
    this.activeSpans.delete(spanId);
  }
  
  /**
   * Create HTTP span
   */
  createHttpSpan(req, res, next) {
    const span = this.startSpan(`${req.method} ${req.path}`, {
      kind: opentelemetry.SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.scheme': req.protocol,
        'http.user_agent': req.headers['user-agent'],
        'http.request_content_length': req.headers['content-length'],
        'net.peer.ip': req.ip
      }
    });
    
    // Store span in request
    req.span = span;
    
    // Override res.end to capture response info
    const originalEnd = res.end;
    res.end = function(...args) {
      if (span) {
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response_content_length': res.get('content-length')
        });
        
        // Set status based on HTTP code
        if (res.statusCode >= 400) {
          span.setStatus({
            code: opentelemetry.SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`
          });
        }
        
        span.end();
      }
      
      return originalEnd.apply(this, args);
    };
    
    next();
  }
  
  /**
   * Create database span
   */
  createDatabaseSpan(operation, collection, query) {
    return this.startSpan(`db.${operation}`, {
      kind: opentelemetry.SpanKind.CLIENT,
      attributes: {
        'db.system': 'mongodb',
        'db.operation': operation,
        'db.mongodb.collection': collection,
        'db.statement': JSON.stringify(query).substring(0, 1000)
      }
    });
  }
  
  /**
   * Add event to current span
   */
  addEvent(span, name, attributes = {}) {
    if (!span) return;
    
    span.addEvent(name, attributes);
  }
  
  /**
   * Set span attributes
   */
  setAttributes(span, attributes) {
    if (!span) return;
    
    span.setAttributes(attributes);
  }
  
  /**
   * Record exception
   */
  recordException(span, error) {
    if (!span) return;
    
    span.recordException(error);
    span.setStatus({
      code: opentelemetry.SpanStatusCode.ERROR,
      message: error.message
    });
  }
  
  /**
   * Get current span from context
   */
  getCurrentSpan() {
    return opentelemetry.trace.getActiveSpan();
  }
  
  /**
   * Inject trace context into headers
   */
  injectTraceContext(headers = {}) {
    const span = this.getCurrentSpan();
    if (!span) return headers;
    
    const context = span.spanContext();
    headers['traceparent'] = `00-${context.traceId}-${context.spanId}-01`;
    
    return headers;
  }
  
  /**
   * Extract trace context from headers
   */
  extractTraceContext(headers) {
    const traceparent = headers['traceparent'];
    if (!traceparent) return null;
    
    const parts = traceparent.split('-');
    if (parts.length !== 4) return null;
    
    return {
      traceId: parts[1],
      spanId: parts[2],
      traceFlags: parts[3]
    };
  }
  
  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor event loop lag
    let lastCheck = Date.now();
    setInterval(() => {
      const now = Date.now();
      const lag = now - lastCheck - 1000;
      
      if (lag > 50) {
        this.recordMetric('event_loop_lag', lag);
      }
      
      lastCheck = now;
    }, 1000);
    
    // Monitor memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.recordMetric('memory_rss', memUsage.rss);
      this.recordMetric('memory_heap_used', memUsage.heapUsed);
      this.recordMetric('memory_heap_total', memUsage.heapTotal);
    }, 10000);
    
    // Monitor CPU usage
    let previousCpuUsage = process.cpuUsage();
    setInterval(() => {
      const currentCpuUsage = process.cpuUsage(previousCpuUsage);
      this.recordMetric('cpu_user', currentCpuUsage.user);
      this.recordMetric('cpu_system', currentCpuUsage.system);
      previousCpuUsage = process.cpuUsage();
    }, 10000);
  }
  
  /**
   * Record performance metric
   */
  recordMetric(name, value, unit = 'ms', attributes = {}) {
    const metric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      attributes
    };
    
    if (!this.performanceMetrics.has(name)) {
      this.performanceMetrics.set(name, []);
    }
    
    const metrics = this.performanceMetrics.get(name);
    metrics.push(metric);
    
    // Keep only last 100 metrics
    if (metrics.length > 100) {
      metrics.shift();
    }
  }
  
  /**
   * On span start
   */
  onSpanStart(span) {
    // Record span start
  }
  
  /**
   * On span end
   */
  onSpanEnd(span) {
    // Store trace for visualization
    const spanData = {
      traceId: span._spanContext.traceId,
      spanId: span._spanContext.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      kind: span.kind,
      startTime: span.startTime,
      endTime: span.endTime,
      duration: span.duration,
      status: span.status,
      attributes: span.attributes,
      events: span.events
    };
    
    this.traces.push(spanData);
    
    // Limit trace storage
    if (this.traces.length > this.maxTraces) {
      this.traces.shift();
    }
  }
  
  /**
   * Get recent traces
   */
  getRecentTraces(limit = 50) {
    return this.traces.slice(-limit).reverse();
  }
  
  /**
   * Get trace by ID
   */
  getTrace(traceId) {
    return this.traces.filter(span => span.traceId === traceId);
  }
  
  /**
   * Get active spans
   */
  getActiveSpans() {
    return Array.from(this.activeSpans.values()).map(({ span, name, startTime }) => ({
      spanId: span.spanContext().spanId,
      traceId: span.spanContext().traceId,
      name,
      duration: Date.now() - startTime
    }));
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const metrics = {};
    
    for (const [name, values] of this.performanceMetrics) {
      if (values.length === 0) continue;
      
      const recent = values.slice(-10);
      const sum = recent.reduce((acc, m) => acc + m.value, 0);
      
      metrics[name] = {
        current: values[values.length - 1].value,
        average: sum / recent.length,
        min: Math.min(...recent.map(m => m.value)),
        max: Math.max(...recent.map(m => m.value)),
        count: values.length
      };
    }
    
    return metrics;
  }
  
  /**
   * Create middleware for Express
   */
  expressMiddleware() {
    return (req, res, next) => {
      this.createHttpSpan(req, res, next);
    };
  }
  
  /**
   * Wrap async function with span
   */
  async withSpan(name, fn, options = {}) {
    const span = this.startSpan(name, options);
    
    try {
      const result = await fn(span);
      this.endSpan(span);
      return result;
    } catch (error) {
      this.recordException(span, error);
      this.endSpan(span, {
        code: opentelemetry.SpanStatusCode.ERROR
      });
      throw error;
    }
  }
  
  /**
   * Get trace visualization data
   */
  getTraceVisualization(traceId) {
    const spans = this.getTrace(traceId);
    if (spans.length === 0) return null;
    
    // Build trace tree
    const tree = this.buildTraceTree(spans);
    
    // Calculate timeline
    const timeline = this.calculateTimeline(spans);
    
    return {
      traceId,
      spans: spans.length,
      duration: timeline.duration,
      tree,
      timeline
    };
  }
  
  /**
   * Build trace tree from spans
   */
  buildTraceTree(spans) {
    const spanMap = new Map();
    const roots = [];
    
    // Create span map
    spans.forEach(span => {
      spanMap.set(span.spanId, {
        ...span,
        children: []
      });
    });
    
    // Build tree
    spans.forEach(span => {
      if (span.parentSpanId) {
        const parent = spanMap.get(span.parentSpanId);
        if (parent) {
          parent.children.push(spanMap.get(span.spanId));
        }
      } else {
        roots.push(spanMap.get(span.spanId));
      }
    });
    
    return roots;
  }
  
  /**
   * Calculate timeline from spans
   */
  calculateTimeline(spans) {
    if (spans.length === 0) return { start: 0, end: 0, duration: 0 };
    
    const start = Math.min(...spans.map(s => s.startTime));
    const end = Math.max(...spans.map(s => s.endTime));
    
    return {
      start,
      end,
      duration: end - start
    };
  }
  
  /**
   * Shutdown tracing
   */
  async shutdown() {
    // Simplified shutdown for now
    console.log('📊 Distributed Tracing Service shutdown');
  }
}

// Export singleton instance
module.exports = new TracingService();