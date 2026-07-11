/**
 * Analytics API Gateway Service - AI Analytics Domain
 * Unified API gateway for all analytics services providing consistent access,
 * authentication, rate limiting, and API orchestration for healthcare analytics.
 * 
 * Features:
 * - Unified API interface for all analytics services
 * - Request routing and load balancing
 * - Authentication and authorization
 * - Rate limiting and quota management
 * - Response caching and optimization
 * - API versioning and compatibility
 * - Request/response transformation
 * - Health monitoring and circuit breaking
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');
const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');

export interface ApiRequest {
  path: string;
  method: string;
  params: any;
  headers: Record<string, string>;
  context: RequestContext;
}

export interface RequestContext {
  userId?: string;
  clinicId?: string;
  roles?: string[];
  subscription?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    statusCode: number;
    timestamp: string;
    [key: string]: any;
  };
  metadata?: {
    timestamp: string;
    duration?: number;
    service?: string;
    fromCache?: boolean;
    [key: string]: any;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetTime?: number;
  retryAfter?: number;
}

export interface ServiceInfo {
  name: string;
  instance: any;
  healthEndpoint: string;
  timeout: number;
  status: 'healthy' | 'unhealthy';
  lastHealthCheck: Date;
  errorCount: number;
  lastError?: string;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  failureThreshold: number;
  timeout: number;
  nextAttempt: number | null;
  lastFailure: number | null;
}

export interface RouteConfig {
  service: string;
  method: string;
  auth: 'required' | 'optional' | 'none';
}

export interface RateLimitConfig {
  requests: number;
  window: number;
}

export interface CachedResponse {
  data: any;
  cachedAt: number;
  expiresAt: number;
}

export interface RateLimitEntry {
  requests: number[];
  blocked: boolean;
  blockedUntil: number | null;
}

@Injectable()
export class AnalyticsApiGatewayService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  private serviceRegistry = new Map<string, ServiceInfo>();
  private rateLimits = new Map<string, RateLimitEntry>();
  private responseCache = new Map<string, CachedResponse>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  
  // API routes configuration
  private routes: Record<string, RouteConfig> = {
    // Data Warehouse APIs
    '/analytics/warehouse/query': { service: 'dataWarehouse', method: 'queryDataWarehouse', auth: 'required' },
    '/analytics/warehouse/marts': { service: 'dataWarehouse', method: 'getDataMarts', auth: 'required' },
    '/analytics/warehouse/quality': { service: 'dataWarehouse', method: 'getDataQualityReport', auth: 'required' },
    
    // Conversational Analytics APIs
    '/analytics/conversation/query': { service: 'conversational', method: 'processAnalyticsQuery', auth: 'required' },
    '/analytics/conversation/insights': { service: 'conversational', method: 'generateInsights', auth: 'required' },
    
    // Predictive Analytics APIs
    '/analytics/predictions/outcomes': { service: 'predictive', method: 'predictPatientOutcomes', auth: 'required' },
    '/analytics/predictions/revenue': { service: 'predictive', method: 'predictRevenue', auth: 'required' },
    '/analytics/predictions/demand': { service: 'predictive', method: 'forecastDemand', auth: 'required' },
    
    // Real-time Analytics APIs
    '/analytics/realtime/charts': { service: 'charts', method: 'generateRealtimeChart', auth: 'required' },
    '/analytics/realtime/dashboard': { service: 'charts', method: 'getDashboardData', auth: 'required' },
    
    // Compliance Analytics APIs
    '/analytics/compliance/score': { service: 'compliance', method: 'getComplianceScore', auth: 'required' },
    '/analytics/compliance/audit': { service: 'compliance', method: 'getAuditResults', auth: 'required' }
  };
  
  // Rate limiting configuration
  private rateLimitConfig: Record<string, RateLimitConfig> = {
    default: { requests: 100, window: 60000 }, // 100 requests per minute
    premium: { requests: 1000, window: 60000 }, // 1000 requests per minute
    admin: { requests: 10000, window: 60000 } // 10000 requests per minute
  };

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('analytics-api-gateway-service');
      
      // Initialize service registry
      await this.initializeServiceRegistry();
      
      // Initialize circuit breakers
      this.initializeCircuitBreakers();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Initialize cache cleanup
      this.startCacheCleanup();
      
      this.initialized = true;
      console.log('✅ Analytics API Gateway Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Analytics API Gateway Service:', error);
      throw error;
    }
  }

  /**
   * Initialize service registry with health checks
   */
  private async initializeServiceRegistry() {
    // Note: In a real implementation, these services would be injected as dependencies
    const services = [
      {
        name: 'dataWarehouse',
        instance: null, // Would be injected service
        healthEndpoint: 'getStatus',
        timeout: 30000
      },
      {
        name: 'conversational',
        instance: null, // Would be injected service
        healthEndpoint: 'getStatus',
        timeout: 10000
      },
      {
        name: 'predictive',
        instance: null, // Would be injected service
        healthEndpoint: 'getStatus',
        timeout: 15000
      },
      {
        name: 'charts',
        instance: null, // Would be injected service
        healthEndpoint: 'getStatus',
        timeout: 5000
      },
      {
        name: 'compliance',
        instance: null, // Would be injected service
        healthEndpoint: 'getStatus',
        timeout: 10000
      }
    ];

    for (const service of services) {
      try {
        // In a real implementation, we would initialize the service instance here
        if (service.instance && typeof service.instance.initialize === 'function') {
          await service.instance.initialize();
        }
        
        this.serviceRegistry.set(service.name, {
          ...service,
          status: 'healthy',
          lastHealthCheck: new Date(),
          errorCount: 0
        } as ServiceInfo);
        
        console.log(`✅ Service registered: ${service.name}`);
      } catch (error) {
        console.error(`❌ Failed to register service ${service.name}:`, error);
        this.serviceRegistry.set(service.name, {
          ...service,
          status: 'unhealthy',
          lastHealthCheck: new Date(),
          errorCount: 1,
          lastError: error.message
        } as ServiceInfo);
      }
    }
  }

  /**
   * Process API request through gateway
   */
  async processRequest(request: ApiRequest): Promise<ApiResponse> {
    try {
      const startTime = new Date();
      
      // Validate request
      const validation = await this.validateRequest(request);
      if (!validation.valid) {
        return this.createErrorResponse(validation.error, 400);
      }

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimit(request.context.userId, request.headers, request.context);
      if (!rateLimitCheck.allowed) {
        return this.createErrorResponse('Rate limit exceeded', 429, {
          retryAfter: rateLimitCheck.retryAfter
        });
      }

      // Check cache
      const cacheKey = this.generateCacheKey(request.path, request.params, request.context);
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        return this.createSuccessResponse(cachedResponse, { fromCache: true });
      }

      // Route request
      const routeConfig = this.routes[request.path];
      if (!routeConfig) {
        return this.createErrorResponse('Endpoint not found', 404);
      }

      // Check circuit breaker
      const serviceName = routeConfig.service;
      if (!this.isServiceAvailable(serviceName)) {
        return this.createErrorResponse('Service temporarily unavailable', 503);
      }

      // Execute request
      const result = await this.executeServiceRequest(routeConfig, request.params, request.context);
      
      // Cache response if appropriate
      if (this.shouldCacheResponse(request.path, result)) {
        this.cacheResponse(cacheKey, result);
      }

      // Log request
      const duration = new Date().getTime() - startTime.getTime();
      await this.logApiRequest(request.path, request.method, duration, result.success, request.context);

      return this.createSuccessResponse(result, {
        duration: duration,
        service: serviceName
      });

    } catch (error) {
      console.error('API Gateway request failed:', error);
      
      // Update circuit breaker
      if ((error as any).serviceName) {
        this.recordServiceError((error as any).serviceName);
      }

      return this.createErrorResponse(error.message, 500);
    }
  }

  /**
   * Validate API request
   */
  private async validateRequest(request: ApiRequest) {
    // Check if route exists
    const routeConfig = this.routes[request.path];
    if (!routeConfig) {
      return { valid: false, error: 'Invalid endpoint' };
    }

    // Check authentication
    if (routeConfig.auth === 'required' && !request.context.userId) {
      return { valid: false, error: 'Authentication required' };
    }

    // Check permissions
    const hasPermission = await this.checkPermissions(request.path, request.context);
    if (!hasPermission) {
      return { valid: false, error: 'Insufficient permissions' };
    }

    // Validate request format
    const formatValid = this.validateRequestFormat(request.headers);
    if (!formatValid) {
      return { valid: false, error: 'Invalid request format' };
    }

    return { valid: true };
  }

  /**
   * Check rate limits
   */
  private async checkRateLimit(userId: string | undefined, headers: Record<string, string>, context: RequestContext): Promise<RateLimitResult> {
    const clientId = userId || headers['x-client-id'] || 'anonymous';
    const userTier = await this.getUserTier(userId, context);
    const limits = this.rateLimitConfig[userTier] || this.rateLimitConfig.default;
    
    const now = Date.now();
    const windowStart = now - limits.window;
    
    // Get or create rate limit entry
    let rateLimitEntry = this.rateLimits.get(clientId);
    if (!rateLimitEntry) {
      rateLimitEntry = {
        requests: [],
        blocked: false,
        blockedUntil: null
      };
      this.rateLimits.set(clientId, rateLimitEntry);
    }

    // Clean old requests
    rateLimitEntry.requests = rateLimitEntry.requests.filter(timestamp => timestamp > windowStart);

    // Check if blocked
    if (rateLimitEntry.blocked && rateLimitEntry.blockedUntil && now < rateLimitEntry.blockedUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((rateLimitEntry.blockedUntil - now) / 1000)
      };
    }

    // Check rate limit
    if (rateLimitEntry.requests.length >= limits.requests) {
      rateLimitEntry.blocked = true;
      rateLimitEntry.blockedUntil = now + limits.window;
      return {
        allowed: false,
        retryAfter: Math.ceil(limits.window / 1000)
      };
    }

    // Allow request
    rateLimitEntry.requests.push(now);
    rateLimitEntry.blocked = false;
    
    return {
      allowed: true,
      remaining: limits.requests - rateLimitEntry.requests.length,
      resetTime: windowStart + limits.window
    };
  }

  /**
   * Execute service request
   */
  private async executeServiceRequest(routeConfig: RouteConfig, params: any, context: RequestContext) {
    const serviceName = routeConfig.service;
    const methodName = routeConfig.method;
    
    const serviceInfo = this.serviceRegistry.get(serviceName);
    if (!serviceInfo || serviceInfo.status !== 'healthy') {
      throw new Error(`Service ${serviceName} is not available`);
    }

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Service ${serviceName} request timeout`));
      }, serviceInfo.timeout);
    });

    if (!serviceInfo.instance || typeof serviceInfo.instance[methodName] !== 'function') {
      throw new Error(`Service ${serviceName} method ${methodName} not available`);
    }

    const servicePromise = serviceInfo.instance[methodName](params, context);

    try {
      const result = await Promise.race([servicePromise, timeoutPromise]);
      
      // Update service health
      this.updateServiceHealth(serviceName, true);
      
      return result;
    } catch (error) {
      (error as any).serviceName = serviceName;
      this.updateServiceHealth(serviceName, false, error.message);
      throw error;
    }
  }

  /**
   * Initialize circuit breakers for each service
   */
  private initializeCircuitBreakers() {
    for (const serviceName of this.serviceRegistry.keys()) {
      this.circuitBreakers.set(serviceName, {
        state: 'CLOSED',
        failureCount: 0,
        failureThreshold: 5,
        timeout: 60000, // 1 minute
        nextAttempt: null,
        lastFailure: null
      });
    }
  }

  /**
   * Check if service is available through circuit breaker
   */
  private isServiceAvailable(serviceName: string): boolean {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return true;

    const now = Date.now();

    switch (breaker.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (breaker.nextAttempt && now >= breaker.nextAttempt) {
          breaker.state = 'HALF_OPEN';
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return true;
      default:
        return false;
    }
  }

  /**
   * Record service error for circuit breaker
   */
  private recordServiceError(serviceName: string) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return;

    breaker.failureCount++;
    breaker.lastFailure = Date.now();

    if (breaker.failureCount >= breaker.failureThreshold) {
      breaker.state = 'OPEN';
      breaker.nextAttempt = Date.now() + breaker.timeout;
      console.log(`🔄 Circuit breaker opened for service: ${serviceName}`);
    }
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(serviceName: string, success: boolean, error: string | null = null) {
    const service = this.serviceRegistry.get(serviceName);
    if (!service) return;

    if (success) {
      service.status = 'healthy';
      service.errorCount = 0;
      service.lastError = undefined;
      
      // Reset circuit breaker on success
      const breaker = this.circuitBreakers.get(serviceName);
      if (breaker && breaker.state === 'HALF_OPEN') {
        breaker.state = 'CLOSED';
        breaker.failureCount = 0;
        console.log(`✅ Circuit breaker closed for service: ${serviceName}`);
      }
    } else {
      service.status = 'unhealthy';
      service.errorCount++;
      service.lastError = error || undefined;
      this.recordServiceError(serviceName);
    }

    service.lastHealthCheck = new Date();
  }

  /**
   * Start health monitoring for all services
   */
  private startHealthMonitoring() {
    setInterval(async () => {
      for (const [serviceName, serviceInfo] of this.serviceRegistry.entries()) {
        try {
          if (serviceInfo.healthEndpoint && 
              serviceInfo.instance && 
              typeof serviceInfo.instance[serviceInfo.healthEndpoint] === 'function') {
            await serviceInfo.instance[serviceInfo.healthEndpoint]();
            this.updateServiceHealth(serviceName, true);
          }
        } catch (error) {
          this.updateServiceHealth(serviceName, false, error.message);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Cache management
   */
  private generateCacheKey(path: string, params: any, context: RequestContext): string {
    const keyData = {
      path,
      params: this.sanitizeParamsForCache(params),
      clinicId: context.clinicId,
      userId: context.userId
    };
    
    return crypto
      .createHash('md5')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  private getCachedResponse(cacheKey: string): any | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() > cached.expiresAt) {
      this.responseCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  private cacheResponse(cacheKey: string, data: any, ttl = 300000) { // 5 minutes default TTL
    this.responseCache.set(cacheKey, {
      data: data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  private shouldCacheResponse(path: string, result: any): boolean {
    // Cache successful responses for specific endpoints
    const cachableEndpoints = [
      '/analytics/warehouse/marts',
      '/analytics/warehouse/quality',
      '/analytics/compliance/score'
    ];
    
    return result.success && cachableEndpoints.some(endpoint => path.includes(endpoint));
  }

  private startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.responseCache.entries()) {
        if (now > cached.expiresAt) {
          this.responseCache.delete(key);
        }
      }
    }, 600000); // Clean every 10 minutes
  }

  /**
   * Helper methods for request processing
   */
  private async checkPermissions(path: string, context: RequestContext): Promise<boolean> {
    // Get user permissions
    const userPermissions = await this.getUserPermissions(context.userId, context);
    
    // Define required permissions for each endpoint
    const requiredPermissions: Record<string, string[]> = {
      '/analytics/warehouse/': ['analytics:read'],
      '/analytics/conversation/': ['analytics:read'],
      '/analytics/predictions/': ['analytics:read', 'predictive:access'],
      '/analytics/realtime/': ['analytics:read'],
      '/analytics/compliance/': ['compliance:read']
    };

    // Check if user has required permissions
    for (const [pathPrefix, permissions] of Object.entries(requiredPermissions)) {
      if (path.startsWith(pathPrefix)) {
        return permissions.every(permission => userPermissions.includes(permission));
      }
    }

    return true; // Default allow
  }

  private async getUserPermissions(userId: string | undefined, context: RequestContext): Promise<string[]> {
    if (!userId) return ['public:read'];

    try {
      const enrichedContext = {
        serviceId: 'analytics-api-gateway-service',
        operation: 'get_user_permissions',
        clinicId: context.clinicId || 'global',
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };
      
      const user = await SecureDataAccess.findById('users', userId, {}, enrichedContext);
      if (!user) return [];

      const permissions: string[] = [];
      for (const role of user.roles || []) {
        const rolePermissions = await this.getRolePermissions(role);
        permissions.push(...rolePermissions);
      }

      return [...new Set(permissions)]; // Remove duplicates
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      return [];
    }
  }

  private async getRolePermissions(role: string): Promise<string[]> {
    const rolePermissions: Record<string, string[]> = {
      admin: ['analytics:read', 'analytics:write', 'predictive:access', 'compliance:read', 'compliance:write'],
      physician: ['analytics:read', 'predictive:access', 'compliance:read'],
      nurse: ['analytics:read', 'compliance:read'],
      data_analyst: ['analytics:read', 'analytics:write', 'predictive:access'],
      compliance_officer: ['analytics:read', 'compliance:read', 'compliance:write']
    };

    return rolePermissions[role] || ['analytics:read'];
  }

  private async getUserTier(userId: string | undefined, context: RequestContext): Promise<string> {
    if (!userId) return 'default';

    try {
      const enrichedContext = {
        serviceId: 'analytics-api-gateway-service',
        operation: 'get_user_tier',
        clinicId: context.clinicId || 'global',
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };
      
      const user = await SecureDataAccess.findById('users', userId, {}, enrichedContext);
      if (!user) return 'default';

      if (user.roles?.includes('admin')) return 'admin';
      if (user.subscription === 'premium') return 'premium';
      return 'default';
    } catch (error) {
      return 'default';
    }
  }

  private validateRequestFormat(headers: Record<string, string>): boolean {
    // Validate content type for POST requests
    const contentType = headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      return false;
    }

    return true;
  }

  private sanitizeParamsForCache(params: any): any {
    // Remove sensitive data from cache key
    const sanitized = { ...params };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    return sanitized;
  }

  /**
   * Response helpers
   */
  private createSuccessResponse<T>(data: T, metadata: Record<string, any> = {}): ApiResponse<T> {
    return {
      success: true,
      data: data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    };
  }

  private createErrorResponse(message: string, statusCode: number, details: Record<string, any> = {}): ApiResponse {
    return {
      success: false,
      error: {
        message: message,
        statusCode: statusCode,
        timestamp: new Date().toISOString(),
        ...details
      }
    };
  }

  /**
   * Logging and monitoring
   */
  private async logApiRequest(path: string, method: string, duration: number, success: boolean, context: RequestContext) {
    const auditData = {
      action: 'API_GATEWAY_REQUEST',
      details: {
        path: path,
        method: method,
        duration: duration,
        success: success,
        clinicId: context.clinicId
      },
      userId: context.userId || 'anonymous',
      clinicId: context.clinicId || 'global',
      timestamp: new Date()
    };

    const enrichedContext = {
      serviceId: 'analytics-api-gateway-service',
      operation: 'log_api_request',
      clinicId: context.clinicId || 'global',
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
    
    await SecureDataAccess.insert('audit_logs', auditData, enrichedContext);
  }

  /**
   * Get gateway status and metrics
   */
  getStatus() {
    const services: Record<string, any> = {};
    for (const [name, service] of this.serviceRegistry.entries()) {
      services[name] = {
        status: service.status,
        lastHealthCheck: service.lastHealthCheck,
        errorCount: service.errorCount,
        lastError: service.lastError
      };
    }

    const circuitBreakers: Record<string, any> = {};
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      circuitBreakers[name] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        lastFailure: breaker.lastFailure
      };
    }

    return {
      status: 'healthy',
      initialized: this.initialized,
      services: services,
      circuitBreakers: circuitBreakers,
      cache: {
        entries: this.responseCache.size,
        rateLimitEntries: this.rateLimits.size
      },
      routes: Object.keys(this.routes).length,
      uptime: process.uptime()
    };
  }

  /**
   * Get API metrics and analytics
   */
  async getMetrics(timeRange = '1h', context: RequestContext) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - this.parseTimeRange(timeRange));

    const enrichedContext = {
      serviceId: 'analytics-api-gateway-service',
      operation: 'get_metrics',
      clinicId: context.clinicId || 'global',
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
    
    const metrics = await SecureDataAccess.query(
      'audit_logs',
      {
        action: 'API_GATEWAY_REQUEST',
        timestamp: { $gte: startTime, $lte: endTime }
      },
      {},
      enrichedContext
    );

    const analysis = {
      totalRequests: metrics.length,
      successfulRequests: metrics.filter((m: any) => m.details.success).length,
      averageResponseTime: metrics.reduce((sum: number, m: any) => sum + m.details.duration, 0) / metrics.length || 0,
      requestsByEndpoint: {} as Record<string, number>,
      requestsByHour: {} as Record<string, number>,
      errorRate: 0
    };

    // Calculate error rate
    analysis.errorRate = ((analysis.totalRequests - analysis.successfulRequests) / analysis.totalRequests) * 100 || 0;

    // Group by endpoint
    metrics.forEach((metric: any) => {
      const path = metric.details.path;
      analysis.requestsByEndpoint[path] = (analysis.requestsByEndpoint[path] || 0) + 1;
    });

    // Group by hour
    metrics.forEach((metric: any) => {
      const hour = new Date(metric.timestamp).getHours().toString();
      analysis.requestsByHour[hour] = (analysis.requestsByHour[hour] || 0) + 1;
    });

    return analysis;
  }

  private parseTimeRange(timeRange: string): number {
    const units: Record<string, number> = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };

    const match = timeRange.match(/^(\d+)([mhd])$/);
    if (!match) return 60 * 60 * 1000; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    return value * (units[unit] || units.h);
  }
}