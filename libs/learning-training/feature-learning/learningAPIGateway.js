/**
 * Learning API Gateway - Modular Version
 * 
 * Single entry point for all learning system interactions,
 * providing a unified API for the platform to access learning services
 */

const path = require('path');
const serviceAccountManager = require(path.resolve(__dirname, '../../../backend/services/serviceAccountManager'));
const SecureDataAccess = require(path.resolve(__dirname, '../../../backend/services/secureDataAccess'));

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
            // Authenticate service
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);

            // Initialize routes
            this.initializeRoutes();

            // Initialize rate limiting
            this.initializeRateLimiting();

            // Log initialization using SecureDataAccess
            const context = {
                serviceId: this.serviceId,
                operation: 'initialize',
                practiceId: 'global'
            };

            await SecureDataAccess.create('audit_logs', {
                action: 'SERVICE_INITIALIZED',
                service: 'learning-api-gateway',
                timestamp: new Date()
            }, context);

            this.initialized = true;
            console.log('✅ Learning API Gateway initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Learning API Gateway:', error);
            throw error;
        }
    }

    /**
     * Initialize API routes
     */
    initializeRoutes() {
        this.routes.set('GET', new Map([
            ['/learning/stats', this.handleGetStats.bind(this)],
            ['/learning/patterns', this.handleGetPatterns.bind(this)],
            ['/learning/efficiency', this.handleGetEfficiency.bind(this)],
            ['/learning/opportunities', this.handleGetOpportunities.bind(this)],
            ['/learning/challenges', this.handleGetChallenges.bind(this)]
        ]));

        this.routes.set('POST', new Map([
            ['/learning/interactions', this.handlePostInteraction.bind(this)],
            ['/learning/feedback', this.handlePostFeedback.bind(this)],
            ['/learning/challenge', this.handleCreateChallenge.bind(this)]
        ]));
    }

    /**
     * Initialize rate limiting
     */
    initializeRateLimiting() {
        // Rate limit: 100 requests per minute per user
        this.rateLimitConfig = {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 100
        };
    }

    /**
     * Handle API request
     */
    async handleRequest(method, path, params, userId, practiceId) {
        const startTime = Date.now();
        
        try {
            // Check rate limit
            if (!this.checkRateLimit(userId)) {
                throw new Error('Rate limit exceeded');
            }

            // Check cache
            const cacheKey = `${method}_${path}_${JSON.stringify(params)}`;
            if (this.cache.has(cacheKey)) {
                this.metrics.cacheHits++;
                return this.cache.get(cacheKey);
            }
            this.metrics.cacheMisses++;

            // Route request
            const handler = this.routes.get(method)?.get(path);
            if (!handler) {
                throw new Error(`Route not found: ${method} ${path}`);
            }

            // Execute handler
            const result = await handler(params, userId, practiceId);

            // Cache result (for 5 minutes)
            setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);
            this.cache.set(cacheKey, result);

            // Update metrics
            this.metrics.requests++;
            const responseTime = Date.now() - startTime;
            this.updateAverageResponseTime(responseTime);

            return result;

        } catch (error) {
            this.metrics.errors++;
            console.error('API Gateway error:', error);
            throw error;
        }
    }

    /**
     * Check rate limit
     */
    checkRateLimit(userId) {
        const now = Date.now();
        const windowStart = now - this.rateLimitConfig.windowMs;

        if (!this.rateLimits.has(userId)) {
            this.rateLimits.set(userId, []);
        }

        const userRequests = this.rateLimits.get(userId);
        
        // Remove old requests
        const recentRequests = userRequests.filter(time => time > windowStart);
        
        // Check limit
        if (recentRequests.length >= this.rateLimitConfig.maxRequests) {
            return false;
        }

        // Add current request
        recentRequests.push(now);
        this.rateLimits.set(userId, recentRequests);

        return true;
    }

    /**
     * Update average response time
     */
    updateAverageResponseTime(responseTime) {
        this.metrics.avgResponseTime = 
            (this.metrics.avgResponseTime * (this.metrics.requests - 1) + responseTime) 
            / this.metrics.requests;
    }

    /**
     * Route handlers
     */
    async handleGetStats(params, userId, practiceId) {
        const context = {
            serviceId: this.serviceId,
            operation: 'get_stats',
            practiceId: practiceId
        };

        return await SecureDataAccess.query('learning_stats', 
            { userId, practiceId }, 
            {}, 
            context
        );
    }

    async handleGetPatterns(params, userId, practiceId) {
        const context = {
            serviceId: this.serviceId,
            operation: 'get_patterns',
            practiceId: practiceId
        };

        return await SecureDataAccess.query('user_patterns', 
            { userId, practiceId }, 
            { limit: params.limit || 50 }, 
            context
        );
    }

    async handleGetEfficiency(params, userId, practiceId) {
        const context = {
            serviceId: this.serviceId,
            operation: 'get_efficiency',
            practiceId: practiceId
        };

        return await SecureDataAccess.query('efficiency_analysis', 
            { userId, practiceId }, 
            {}, 
            context
        );
    }

    async handleGetOpportunities(params, userId, practiceId) {
        const context = {
            serviceId: this.serviceId,
            operation: 'get_opportunities',
            practiceId: practiceId
        };

        return await SecureDataAccess.query('automation_opportunities', 
            { practiceId }, 
            { sort: { priority: -1 } }, 
            context
        );
    }

    async handleGetChallenges(params, userId, practiceId) {
        const context = {
            serviceId: this.serviceId,
            operation: 'get_challenges',
            practiceId: practiceId
        };

        return await SecureDataAccess.query('challenges', 
            { status: 'pending' }, 
            {}, 
            context
        );
    }

    async handlePostInteraction(params, userId, practiceId) {
        const context = {
            serviceId: this.serviceId,
            operation: 'post_interaction',
            practiceId: practiceId
        };

        const interaction = {
            ...params,
            userId,
            practiceId,
            timestamp: new Date()
        };

        return await SecureDataAccess.create('user_interactions', interaction, context);
    }

    async handlePostFeedback(params, userId, practiceId) {
        const context = {
            serviceId: this.serviceId,
            operation: 'post_feedback',
            practiceId: practiceId
        };

        const feedback = {
            ...params,
            userId,
            practiceId,
            timestamp: new Date()
        };

        return await SecureDataAccess.create('learning_feedback', feedback, context);
    }

    async handleCreateChallenge(params, userId, practiceId) {
        const context = {
            serviceId: this.serviceId,
            operation: 'create_challenge',
            practiceId: practiceId
        };

        const challenge = {
            ...params,
            userId,
            practiceId,
            status: 'pending',
            createdAt: new Date()
        };

        return await SecureDataAccess.create('challenges', challenge, context);
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            serviceId: this.serviceId,
            initialized: this.initialized,
            routes: {
                GET: this.routes.get('GET')?.size || 0,
                POST: this.routes.get('POST')?.size || 0
            },
            metrics: this.metrics,
            cache: {
                size: this.cache.size,
                hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
            }
        };
    }

    /**
     * Cleanup and shutdown
     */
    shutdown() {
        this.cache.clear();
        this.rateLimits.clear();
        console.log('Learning API Gateway shutdown complete');
    }
}

module.exports = new LearningAPIGateway();