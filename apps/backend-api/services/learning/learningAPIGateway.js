/**
 * Learning API Gateway
 * 
 * Single entry point for all learning system interactions,
 * providing a unified API for the platform to access learning services
 * 
 * Features:
 * - Unified API interface
 * - Request routing and load balancing
 * - Authentication and authorization
 * - Rate limiting and throttling
 * - Response caching
 * - API versioning
 */

const SecureDataAccess = require('../secureDataAccess');
const serviceAccountManager = require('../serviceAccountManager');
const learningOrchestrator = require('./learningOrchestrator');
const { learningEventBus } = require('./learningEventBus');
const learningConfigService = require('./learningConfigService');

// Direct service imports for specific operations
const interactionCaptureService = require('./interactionCaptureService');
const personalAssistantService = require('./personalAssistantService');
const workflowPredictorService = require('./workflowPredictorService');
const efficiencyAnalyzerService = require('./efficiencyAnalyzerService');
const automationOpportunityService = require('./automationOpportunityService');

class LearningAPIGateway {
    constructor() {
        this.serviceId = 'learning-api-gateway';
        this.serviceToken = null;
        this.cache = new Map();
        this.rateLimits = new Map();
        this.apiVersions = new Map();
        this.routes = new Map();
        this.metrics = {
            requests: 0,
            errors: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgResponseTime: 0
        };
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Ensure GlobalModelLoader is ready first
            const globalModelLoader = require('../globalModelLoader');
            if (!globalModelLoader.isReady()) {
                console.log('⏳ Waiting for GlobalModelLoader to be ready...');
                // Try to wait a bit for it to be ready
                let retries = 0;
                while (!globalModelLoader.isReady() && retries < 10) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    retries++;
                }
                
                if (!globalModelLoader.isReady()) {
                    console.warn('⚠️ GlobalModelLoader still not ready after waiting, continuing with limited functionality');
                }
            }
            
            // Authenticate service and get API key from KMS
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
            
            // Get the actual API key from KMS for use in SecureDataAccess
            const productionKMS = require('../productionKMS');
            if (!productionKMS.initialized) {
                await productionKMS.initialize();
            }
            this.apiKey = await productionKMS.getInternalKey('SERVICE_LEARNING_API_GATEWAY_KEY');
            
            // Setup API routes
            this.setupRoutes();
            
            // Setup API versions
            this.setupAPIVersions();
            
            // Initialize cache
            this.initializeCache();
            
            // Setup rate limiting
            this.setupRateLimiting();
            
            // Start metrics collection
            this.startMetricsCollection();
            
            this.initialized = true;
            console.log('✅ LearningAPIGateway initialized');
            
        } catch (error) {
            console.error('Failed to initialize LearningAPIGateway:', error);
            throw error;
        }
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // User interaction routes
        this.routes.set('POST:/learn/interaction', {
            handler: this.captureInteraction.bind(this),
            service: 'interaction-capture',
            auth: 'required',
            rateLimit: 100
        });
        
        // Prediction routes
        this.routes.set('GET:/learn/predict/workflow', {
            handler: this.predictWorkflow.bind(this),
            service: 'workflow-predictor',
            auth: 'required',
            cache: true,
            cacheTTL: 300 // 5 minutes
        });
        
        this.routes.set('GET:/learn/predict/next-action', {
            handler: this.predictNextAction.bind(this),
            service: 'personal-assistant',
            auth: 'required',
            cache: true,
            cacheTTL: 60 // 1 minute
        });
        
        // Analysis routes
        this.routes.set('GET:/learn/analysis/efficiency', {
            handler: this.getEfficiencyAnalysis.bind(this),
            service: 'efficiency-analyzer',
            auth: 'required',
            cache: true,
            cacheTTL: 3600 // 1 hour
        });
        
        this.routes.set('GET:/learn/analysis/bottlenecks', {
            handler: this.getBottlenecks.bind(this),
            service: 'bottleneck-detector',
            auth: 'required',
            cache: true,
            cacheTTL: 1800 // 30 minutes
        });
        
        // Automation routes
        this.routes.set('GET:/learn/automation/opportunities', {
            handler: this.getAutomationOpportunities.bind(this),
            service: 'automation-opportunity',
            auth: 'required',
            cache: true,
            cacheTTL: 3600 // 1 hour
        });
        
        // Personal assistant routes
        this.routes.set('GET:/learn/assistant/suggestions', {
            handler: this.getPersonalSuggestions.bind(this),
            service: 'personal-assistant',
            auth: 'required',
            cache: false // Always fresh
        });
        
        this.routes.set('POST:/learn/assistant/feedback', {
            handler: this.submitFeedback.bind(this),
            service: 'personal-assistant',
            auth: 'required'
        });
        
        // Orchestration routes
        this.routes.set('POST:/learn/orchestrate', {
            handler: this.orchestrateOperation.bind(this),
            service: 'orchestrator',
            auth: 'required',
            rateLimit: 10
        });
        
        // Admin routes
        this.routes.set('GET:/learn/admin/metrics', {
            handler: this.getSystemMetrics.bind(this),
            auth: 'admin',
            cache: true,
            cacheTTL: 60
        });
        
        this.routes.set('POST:/learn/admin/reset', {
            handler: this.resetLearning.bind(this),
            auth: 'admin'
        });
    }

    /**
     * Main API handler - routes all learning requests
     */
    async handleRequest(method, path, params, context) {
        const startTime = Date.now();
        const routeKey = `${method}:${path}`;
        
        try {
            // Update metrics
            this.metrics.requests++;
            
            // Get route configuration
            const route = this.routes.get(routeKey);
            if (!route) {
                throw new Error(`Route not found: ${routeKey}`);
            }
            
            // Check authentication
            if (route.auth && !await this.checkAuth(context, route.auth)) {
                throw new Error('Authentication required');
            }
            
            // Check rate limit
            if (route.rateLimit && !this.checkRateLimit(context.userId, route.rateLimit)) {
                throw new Error('Rate limit exceeded');
            }
            
            // Check cache
            if (route.cache) {
                const cached = this.getFromCache(routeKey, params);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached;
                }
                this.metrics.cacheMisses++;
            }
            
            // Execute handler
            const result = await route.handler(params, context);
            
            // Cache result if configured
            if (route.cache && result) {
                this.addToCache(routeKey, params, result, route.cacheTTL);
            }
            
            // Update response time metric
            const responseTime = Date.now() - startTime;
            this.updateResponseTime(responseTime);
            
            // Emit API call event
            await learningEventBus.emit('api.call.completed', {
                method,
                path,
                responseTime,
                success: true,
                timestamp: new Date()
            });
            
            return result;
            
        } catch (error) {
            this.metrics.errors++;
            
            console.error(`API error on ${routeKey}:`, error);
            
            await learningEventBus.emit('api.call.failed', {
                method,
                path,
                error: error.message,
                timestamp: new Date()
            });
            
            throw error;
        }
    }

    /**
     * Route Handlers
     */
    
    async captureInteraction(params, context) {
        const { action, metadata } = params;
        
        return await interactionCaptureService.captureUserAction(
            context.userId,
            action,
            {
                ...context,
                ...metadata
            }
        );
    }

    async predictWorkflow(params, context) {
        const { currentSteps } = params;
        
        return await workflowPredictorService.predictWorkflow(
            context.userId,
            currentSteps || [],
            context
        );
    }

    async predictNextAction(params, context) {
        return await personalAssistantService.predictUserIntent(
            context.userId,
            params.currentAction
        );
    }

    async getEfficiencyAnalysis(params, context) {
        const { timeframe = '7d', type = 'user' } = params;
        
        if (type === 'practice') {
            return await efficiencyAnalyzerService.analyzeClinicEfficiency(
                context.practiceId,
                timeframe
            );
        } else {
            return await efficiencyAnalyzerService.analyzeUserEfficiency(
                context.userId,
                timeframe
            );
        }
    }

    async getBottlenecks(params, context) {
        const bottleneckDetectorService = require('./bottleneckDetectorService');
        
        return await bottleneckDetectorService.analyzeWorkflowBottlenecks(
            context.practiceId
        );
    }

    async getAutomationOpportunities(params, context) {
        return await automationOpportunityService.discoverOpportunities(
            context.practiceId
        );
    }

    async getPersonalSuggestions(params, context) {
        return await personalAssistantService.getPersonalizedSuggestions(
            context.userId,
            context
        );
    }

    async submitFeedback(params, context) {
        const { suggestionId, feedback, accepted } = params;
        
        await personalAssistantService.processFeedback(
            suggestionId,
            {
                userId: context.userId,
                feedback,
                accepted,
                timestamp: new Date()
            }
        );
        
        return { success: true };
    }

    async orchestrateOperation(params, context) {
        const { operation, operationContext } = params;
        
        return await learningOrchestrator.coordinateOperation(
            operation,
            { ...context, ...operationContext }
        );
    }

    async getSystemMetrics(params, context) {
        return {
            gateway: this.metrics,
            orchestrator: await learningOrchestrator.getMetrics(),
            services: await this.getServicesMetrics(),
            cache: {
                size: this.cache.size,
                hitRate: this.metrics.cacheHits / 
                        (this.metrics.cacheHits + this.metrics.cacheMisses || 1)
            }
        };
    }

    async resetLearning(params, context) {
        const { scope = 'user', targetId } = params;
        
        if (scope === 'user') {
            // Reset user-specific learning
            await this.resetUserLearning(targetId || context.userId);
        } else if (scope === 'practice') {
            // Reset practice-wide learning
            await this.resetClinicLearning(targetId || context.practiceId);
        } else if (scope === 'global') {
            // Reset all learning (requires super admin)
            if (context.role !== 'super_admin') {
                throw new Error('Insufficient permissions');
            }
            await this.resetGlobalLearning();
        }
        
        return { success: true, scope, targetId };
    }

    /**
     * Batch operations for efficiency
     */
    async batchRequest(requests, context) {
        const results = [];
        
        for (const request of requests) {
            try {
                const result = await this.handleRequest(
                    request.method,
                    request.path,
                    request.params,
                    context
                );
                results.push({
                    id: request.id,
                    success: true,
                    result
                });
            } catch (error) {
                results.push({
                    id: request.id,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * WebSocket support for real-time updates
     */
    async subscribeToUpdates(userId, eventTypes, callback) {
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        for (const eventType of eventTypes) {
            learningEventBus.subscribe(
                eventType,
                async (data) => {
                    if (data.userId === userId || data.public) {
                        callback({
                            subscriptionId,
                            eventType,
                            data,
                            timestamp: new Date()
                        });
                    }
                },
                subscriptionId
            );
        }
        
        return subscriptionId;
    }

    async unsubscribe(subscriptionId) {
        learningEventBus.unsubscribe(subscriptionId);
        return { success: true };
    }

    /**
     * API Versioning
     */
    setupAPIVersions() {
        // Version 1 - Current stable API
        this.apiVersions.set('v1', {
            routes: this.routes,
            deprecated: false,
            sunset: null
        });
        
        // Version 2 - Beta features
        this.apiVersions.set('v2', {
            routes: new Map(this.routes), // Copy v1 routes
            deprecated: false,
            beta: true
        });
        
        // Add v2 specific routes
        const v2Routes = this.apiVersions.get('v2').routes;
        v2Routes.set('POST:/learn/v2/adaptive-learning', {
            handler: this.triggerAdaptiveLearning.bind(this),
            service: 'orchestrator',
            auth: 'required',
            beta: true
        });
    }

    async triggerAdaptiveLearning(params, context) {
        return await learningOrchestrator.coordinateOperation(
            'adaptive-learning',
            context
        );
    }

    /**
     * Cache Management
     */
    initializeCache() {
        // Set cache size limit
        this.maxCacheSize = 1000;
        
        // Start cache cleanup interval
        setInterval(() => {
            this.cleanupCache();
        }, 60000); // Every minute
    }

    getFromCache(routeKey, params) {
        const cacheKey = this.getCacheKey(routeKey, params);
        const cached = this.cache.get(cacheKey);
        
        if (cached && cached.expiry > Date.now()) {
            return cached.data;
        }
        
        // Remove expired entry
        if (cached) {
            this.cache.delete(cacheKey);
        }
        
        return null;
    }

    addToCache(routeKey, params, data, ttl) {
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        const cacheKey = this.getCacheKey(routeKey, params);
        this.cache.set(cacheKey, {
            data,
            expiry: Date.now() + (ttl * 1000),
            timestamp: Date.now()
        });
    }

    getCacheKey(routeKey, params) {
        return `${routeKey}:${JSON.stringify(params)}`;
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (value.expiry < now) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Rate Limiting
     */
    setupRateLimiting() {
        this.rateLimitWindow = 60000; // 1 minute window
        this.defaultRateLimit = 100; // requests per minute
    }

    checkRateLimit(userId, limit = this.defaultRateLimit) {
        const key = `rate:${userId}`;
        const now = Date.now();
        
        if (!this.rateLimits.has(key)) {
            this.rateLimits.set(key, {
                count: 1,
                resetTime: now + this.rateLimitWindow
            });
            return true;
        }
        
        const limiter = this.rateLimits.get(key);
        
        if (now > limiter.resetTime) {
            // Reset window
            limiter.count = 1;
            limiter.resetTime = now + this.rateLimitWindow;
            return true;
        }
        
        if (limiter.count >= limit) {
            return false;
        }
        
        limiter.count++;
        return true;
    }

    /**
     * Authentication
     */
    async checkAuth(context, requiredAuth) {
        if (requiredAuth === 'admin') {
            return context.role === 'admin' || context.role === 'super_admin';
        }
        
        return !!context.userId;
    }

    /**
     * Metrics
     */
    updateResponseTime(responseTime) {
        const alpha = 0.1; // Exponential moving average factor
        this.metrics.avgResponseTime = 
            (1 - alpha) * this.metrics.avgResponseTime + alpha * responseTime;
    }

    startMetricsCollection() {
        // Periodic metrics storage
        setInterval(async () => {
            try {
                // Check if we have a valid API key before trying to store metrics
                if (!this.apiKey || !this.serviceToken) {
                    console.warn('⚠️ LearningAPIGateway not fully authenticated, skipping metrics storage');
                    return;
                }
                
                // Check if GlobalModelLoader is ready
                const globalModelLoader = require('../globalModelLoader');
                if (!globalModelLoader.isReady()) {
                    console.warn('⚠️ GlobalModelLoader not ready, skipping metrics storage');
                    return;
                }
                
                await SecureDataAccess.insert(
                    'api_gateway_metrics',
                    {
                        ...this.metrics,
                        timestamp: new Date(),
                        cacheSize: this.cache.size
                    },
                    {
                        serviceId: this.serviceId,
                        apiKey: this.apiKey,
                        operation: 'storeMetrics',
                        practiceId: 'global'
                    }
                );
            } catch (error) {
                console.error('Error storing gateway metrics:', error.message);
            }
        }, 300000); // Every 5 minutes
    }

    async getServicesMetrics() {
        const services = {};
        
        // Collect metrics from all services
        const serviceList = [
            'interaction-capture',
            'sequence-pattern',
            'temporal-pattern',
            'procedural-memory',
            'user-memory',
            'challenger',
            'solver',
            'bottleneck-detector',
            'automation-opportunity',
            'personal-assistant',
            'workflow-predictor',
            'efficiency-analyzer'
        ];
        
        for (const serviceId of serviceList) {
            try {
                const service = require(`./${serviceId.replace(/-/g, '')}Service`);
                if (service.getMetrics) {
                    services[serviceId] = await service.getMetrics();
                }
            } catch (error) {
                services[serviceId] = { status: 'unavailable' };
            }
        }
        
        return services;
    }

    /**
     * Reset operations
     */
    async resetUserLearning(userId) {
        // Clear user patterns
        await SecureDataAccess.delete(
            'user_learning_patterns',
            { userId },
            {
                serviceId: this.serviceId,
                operation: 'resetUserLearning',
                practiceId: 'global'
            }
        );
        
        // Clear user memories
        await SecureDataAccess.delete(
            'user_memories',
            { userId },
            {
                serviceId: this.serviceId,
                operation: 'resetUserMemories',
                practiceId: 'global'
            }
        );
        
        // Clear cache entries for user
        for (const [key, value] of this.cache.entries()) {
            if (key.includes(userId)) {
                this.cache.delete(key);
            }
        }
        
        // Emit reset event
        await learningEventBus.emit('learning.reset', {
            scope: 'user',
            userId,
            timestamp: new Date()
        });
    }

    async resetClinicLearning(practiceId) {
        // Reset all practice-wide learning data
        const collections = [
            'workflow_templates',
            'efficiency_benchmarks',
            'automation_opportunities',
            'bottleneck_analyses'
        ];
        
        for (const collection of collections) {
            await SecureDataAccess.delete(
                collection,
                { practiceId },
                {
                    serviceId: this.serviceId,
                    operation: 'resetClinicLearning',
                    practiceId
                }
            );
        }
        
        // Emit reset event
        await learningEventBus.emit('learning.reset', {
            scope: 'practice',
            practiceId,
            timestamp: new Date()
        });
    }

    async resetGlobalLearning() {
        // This is a drastic operation - clear all learning data
        console.warn('GLOBAL LEARNING RESET INITIATED');
        
        // Clear all caches
        this.cache.clear();
        this.rateLimits.clear();
        
        // Reset metrics
        this.metrics = {
            requests: 0,
            errors: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgResponseTime: 0
        };
        
        // Emit global reset event
        await learningEventBus.emit('learning.reset', {
            scope: 'global',
            timestamp: new Date()
        });
    }
}

// Create and export singleton instance
const learningAPIGateway = new LearningAPIGateway();

// Initialize on first import
if (!learningAPIGateway.initialized) {
    learningAPIGateway.initialize().catch(error => {
        console.error('Failed to initialize LearningAPIGateway:', error);
    });
}

module.exports = learningAPIGateway;