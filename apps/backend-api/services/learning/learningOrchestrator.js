/**
 * Learning Orchestrator Service
 * 
 * Central orchestration layer that coordinates all learning services,
 * manages the R-Zero learning loop, and ensures efficient communication
 * between all microservices
 * 
 * Features:
 * - Service coordination and management
 * - R-Zero learning loop orchestration
 * - Resource allocation and optimization
 * - Cross-service data flow management
 * - Learning pipeline execution
 */

const SecureDataAccess = require('../secureDataAccess');
const serviceAccountManager = require('../serviceAccountManager');
const { learningEventBus } = require('./learningEventBus');
const learningConfigService = require('./learningConfigService');

// Import all learning services
const interactionCaptureService = require('./interactionCaptureService');
const sequencePatternEngine = require('./sequencePatternEngine');
const temporalPatternEngine = require('./temporalPatternEngine');
const proceduralMemoryService = require('./proceduralMemoryService');
const userMemoryService = require('./userMemoryService');
const challengerService = require('./challengerService');
const solverService = require('./solverService');
const bottleneckDetectorService = require('./bottleneckDetectorService');
const automationOpportunityService = require('./automationOpportunityService');
const personalAssistantService = require('./personalAssistantService');
const workflowPredictorService = require('./workflowPredictorService');
const efficiencyAnalyzerService = require('./efficiencyAnalyzerService');

class LearningOrchestrator {
    constructor() {
        this.serviceId = 'learning-orchestrator';
        this.services = new Map();
        this.pipelines = new Map();
        this.activeLoops = new Map();
        this.resourceAllocation = new Map();
        this.performanceMetrics = new Map();
        this.orchestrationRules = new Map();
        this.initialized = false;
        this.serviceToken = null;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Authenticate service
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
            
            // Register all services
            await this.registerServices();
            
            // Setup orchestration rules
            await this.setupOrchestrationRules();
            
            // Initialize pipelines
            await this.initializePipelines();
            
            // Subscribe to critical events
            this.subscribeToEvents();
            
            // Start monitoring
            this.startMonitoring();
            
            // Start R-Zero learning loops
            await this.startRZeroLoops();
            
            this.initialized = true;
            console.log('✅ LearningOrchestrator initialized');
            
        } catch (error) {
            console.error('Failed to initialize LearningOrchestrator:', error);
            throw error;
        }
    }

    /**
     * Register all learning services
     */
    async registerServices() {
        const services = [
            { id: 'interaction-capture', instance: interactionCaptureService, layer: 2 },
            { id: 'sequence-pattern', instance: sequencePatternEngine, layer: 3 },
            { id: 'temporal-pattern', instance: temporalPatternEngine, layer: 3 },
            { id: 'procedural-memory', instance: proceduralMemoryService, layer: 4 },
            { id: 'user-memory', instance: userMemoryService, layer: 4 },
            { id: 'challenger', instance: challengerService, layer: 5 },
            { id: 'solver', instance: solverService, layer: 5 },
            { id: 'bottleneck-detector', instance: bottleneckDetectorService, layer: 6 },
            { id: 'automation-opportunity', instance: automationOpportunityService, layer: 6 },
            { id: 'personal-assistant', instance: personalAssistantService, layer: 7 },
            { id: 'workflow-predictor', instance: workflowPredictorService, layer: 7 },
            { id: 'efficiency-analyzer', instance: efficiencyAnalyzerService, layer: 7 }
        ];
        
        for (const service of services) {
            this.services.set(service.id, {
                ...service,
                status: 'active',
                lastHealthCheck: new Date(),
                metrics: {
                    requests: 0,
                    errors: 0,
                    avgResponseTime: 0
                }
            });
        }
        
        console.log(`Registered ${services.length} learning services`);
    }

    /**
     * Setup orchestration rules for service coordination
     */
    async setupOrchestrationRules() {
        // Rule: User interaction triggers pattern detection
        this.orchestrationRules.set('interaction-to-patterns', {
            trigger: 'interaction.captured',
            actions: [
                { service: 'sequence-pattern', method: 'processInteraction' },
                { service: 'temporal-pattern', method: 'processInteraction' }
            ],
            parallel: true
        });
        
        // Rule: Pattern detection triggers memory storage
        this.orchestrationRules.set('patterns-to-memory', {
            trigger: 'pattern.detected',
            actions: [
                { service: 'procedural-memory', method: 'evaluateForStorage' },
                { service: 'user-memory', method: 'storePattern' }
            ],
            parallel: true
        });
        
        // Rule: Bottleneck detection triggers automation discovery
        this.orchestrationRules.set('bottleneck-to-automation', {
            trigger: 'bottleneck.detected',
            actions: [
                { service: 'automation-opportunity', method: 'evaluateBottleneck' }
            ],
            parallel: false
        });
        
        // Rule: R-Zero challenge generation
        this.orchestrationRules.set('rzero-challenge', {
            trigger: 'rzero.cycle.start',
            actions: [
                { service: 'challenger', method: 'generateChallenge' },
                { service: 'solver', method: 'attemptSolution' }
            ],
            parallel: false,
            sequence: true
        });
        
        // Rule: Efficiency analysis triggers recommendations
        this.orchestrationRules.set('efficiency-to-recommendations', {
            trigger: 'efficiency.below.threshold',
            actions: [
                { service: 'personal-assistant', method: 'generateRecommendations' },
                { service: 'workflow-predictor', method: 'suggestOptimizations' }
            ],
            parallel: true
        });
    }

    /**
     * Initialize learning pipelines
     */
    async initializePipelines() {
        // Real-time learning pipeline
        this.pipelines.set('realtime-learning', {
            name: 'Real-time Learning Pipeline',
            stages: [
                { service: 'interaction-capture', method: 'capture' },
                { service: 'sequence-pattern', method: 'detect' },
                { service: 'user-memory', method: 'store' },
                { service: 'personal-assistant', method: 'update' }
            ],
            config: {
                maxLatency: 1000, // 1 second
                retryOnFailure: true,
                fallbackStrategy: 'skip-failed-stage'
            }
        });
        
        // Batch analysis pipeline
        this.pipelines.set('batch-analysis', {
            name: 'Batch Analysis Pipeline',
            stages: [
                { service: 'bottleneck-detector', method: 'analyze' },
                { service: 'automation-opportunity', method: 'discover' },
                { service: 'efficiency-analyzer', method: 'analyze' }
            ],
            config: {
                schedule: '0 2 * * *', // 2 AM daily
                timeout: 3600000, // 1 hour
                parallel: true
            }
        });
        
        // R-Zero learning pipeline
        this.pipelines.set('rzero-learning', {
            name: 'R-Zero Self-Training Pipeline',
            stages: [
                { service: 'challenger', method: 'generate' },
                { service: 'solver', method: 'solve' },
                { service: 'procedural-memory', method: 'store' },
                { service: 'challenger', method: 'adjustDifficulty' }
            ],
            config: {
                continuous: true,
                minInterval: 60000, // 1 minute between cycles
                maxConcurrent: 5
            }
        });
    }

    /**
     * Start R-Zero learning loops
     */
    async startRZeroLoops() {
        // Start practice-level R-Zero loops
        const practices = await this.getActiveClinics();
        
        for (const practice of practices) {
            const loopId = `rzero_${practice.id}`;
            
            this.activeLoops.set(loopId, {
                practiceId: practice.id,
                status: 'running',
                currentCycle: 0,
                lastChallenge: null,
                performance: {
                    successRate: 0,
                    avgSolveTime: 0,
                    difficultLevel: 1
                }
            });
            
            // Start the loop
            this.runRZeroLoop(loopId, practice.id);
        }
        
        console.log(`Started ${practices.length} R-Zero learning loops`);
    }

    /**
     * Run a single R-Zero learning loop
     */
    async runRZeroLoop(loopId, practiceId) {
        const loop = this.activeLoops.get(loopId);
        if (!loop || loop.status !== 'running') return;
        
        try {
            // Generate challenge based on current capability
            const challenge = await challengerService.generateChallenge({
                practiceId,
                difficulty: loop.performance.difficultLevel,
                previousPerformance: loop.performance
            });
            
            loop.lastChallenge = challenge;
            loop.currentCycle++;
            
            // Attempt to solve the challenge
            const startTime = Date.now();
            const solution = await solverService.attemptSolution(challenge);
            const solveTime = Date.now() - startTime;
            
            // Evaluate solution
            const success = await this.evaluateSolution(solution, challenge);
            
            // Update performance metrics
            loop.performance.successRate = 
                (loop.performance.successRate * 0.9) + (success ? 0.1 : 0);
            loop.performance.avgSolveTime = 
                (loop.performance.avgSolveTime * 0.9) + (solveTime * 0.1);
            
            // Adjust difficulty
            if (loop.performance.successRate > 0.8) {
                loop.performance.difficultLevel = Math.min(10, 
                    loop.performance.difficultLevel + 0.5);
            } else if (loop.performance.successRate < 0.4) {
                loop.performance.difficultLevel = Math.max(1, 
                    loop.performance.difficultLevel - 0.5);
            }
            
            // Store successful solution as procedure
            if (success && solution.confidence > 0.7) {
                await proceduralMemoryService.storeWorkflowProcedure({
                    challenge: challenge.id,
                    solution: solution.steps,
                    context: challenge.context,
                    performance: {
                        time: solveTime,
                        efficiency: solution.efficiency
                    }
                });
            }
            
            // Emit learning event
            await learningEventBus.emit('rzero.cycle.completed', {
                loopId,
                practiceId,
                cycle: loop.currentCycle,
                success,
                performance: loop.performance,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error(`Error in R-Zero loop ${loopId}:`, error);
            loop.status = 'error';
        }
        
        // Schedule next cycle
        if (loop.status === 'running') {
            const delay = this.calculateNextCycleDelay(loop.performance);
            setTimeout(() => this.runRZeroLoop(loopId, practiceId), delay);
        }
    }

    /**
     * Execute a learning pipeline
     */
    async executePipeline(pipelineName, data) {
        const pipeline = this.pipelines.get(pipelineName);
        if (!pipeline) {
            throw new Error(`Pipeline ${pipelineName} not found`);
        }
        
        const results = {
            pipeline: pipelineName,
            startTime: new Date(),
            stages: [],
            success: true,
            data
        };
        
        try {
            if (pipeline.config.parallel) {
                // Execute stages in parallel
                const promises = pipeline.stages.map(stage => 
                    this.executeStage(stage, data)
                );
                const stageResults = await Promise.allSettled(promises);
                
                results.stages = stageResults.map((result, index) => ({
                    stage: pipeline.stages[index],
                    status: result.status,
                    result: result.value || result.reason
                }));
                
                results.success = stageResults.every(r => r.status === 'fulfilled');
                
            } else {
                // Execute stages sequentially
                let stageData = data;
                
                for (const stage of pipeline.stages) {
                    try {
                        const result = await this.executeStage(stage, stageData);
                        results.stages.push({
                            stage,
                            status: 'success',
                            result
                        });
                        stageData = result; // Pass result to next stage
                    } catch (error) {
                        results.stages.push({
                            stage,
                            status: 'error',
                            error: error.message
                        });
                        
                        if (pipeline.config.fallbackStrategy !== 'skip-failed-stage') {
                            results.success = false;
                            break;
                        }
                    }
                }
            }
            
            results.endTime = new Date();
            results.duration = results.endTime - results.startTime;
            
            // Update metrics
            this.updatePipelineMetrics(pipelineName, results);
            
            // Emit completion event
            await learningEventBus.emit('pipeline.completed', {
                pipeline: pipelineName,
                success: results.success,
                duration: results.duration,
                timestamp: new Date()
            });
            
            return results;
            
        } catch (error) {
            console.error(`Error executing pipeline ${pipelineName}:`, error);
            results.success = false;
            results.error = error.message;
            return results;
        }
    }

    /**
     * Execute a single pipeline stage
     */
    async executeStage(stage, data) {
        const service = this.services.get(stage.service);
        if (!service) {
            throw new Error(`Service ${stage.service} not found`);
        }
        
        const startTime = Date.now();
        
        try {
            const result = await service.instance[stage.method](data);
            
            // Update service metrics
            const metrics = service.metrics;
            metrics.requests++;
            metrics.avgResponseTime = 
                (metrics.avgResponseTime * (metrics.requests - 1) + 
                (Date.now() - startTime)) / metrics.requests;
            
            return result;
            
        } catch (error) {
            service.metrics.errors++;
            throw error;
        }
    }

    /**
     * Coordinate cross-service operations
     */
    async coordinateOperation(operation, context) {
        const coordination = {
            operation,
            context,
            services: [],
            results: {},
            status: 'pending',
            startTime: new Date()
        };
        
        try {
            switch (operation) {
                case 'full-user-analysis':
                    coordination.services = [
                        'efficiency-analyzer',
                        'workflow-predictor',
                        'personal-assistant'
                    ];
                    
                    // Parallel execution
                    const promises = coordination.services.map(serviceId => {
                        const service = this.services.get(serviceId);
                        return service.instance.analyzeUser(context.userId);
                    });
                    
                    const results = await Promise.allSettled(promises);
                    coordination.results = results.reduce((acc, result, index) => {
                        acc[coordination.services[index]] = result.value || result.reason;
                        return acc;
                    }, {});
                    
                    coordination.status = 'completed';
                    break;
                    
                case 'practice-optimization':
                    // Sequential execution with data passing
                    const bottlenecks = await bottleneckDetectorService
                        .analyzeWorkflowBottlenecks(context.practiceId);
                    coordination.results.bottlenecks = bottlenecks;
                    
                    const opportunities = await automationOpportunityService
                        .evaluateBottlenecks(bottlenecks);
                    coordination.results.opportunities = opportunities;
                    
                    const efficiency = await efficiencyAnalyzerService
                        .analyzeClinicEfficiency(context.practiceId);
                    coordination.results.efficiency = efficiency;
                    
                    coordination.status = 'completed';
                    break;
                    
                case 'adaptive-learning':
                    // Trigger adaptive learning across all services
                    await learningEventBus.emit('adaptive.learning.requested', context);
                    
                    coordination.results = {
                        triggered: true,
                        services: Array.from(this.services.keys())
                    };
                    coordination.status = 'initiated';
                    break;
                    
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
            
            coordination.endTime = new Date();
            coordination.duration = coordination.endTime - coordination.startTime;
            
            // Store coordination result
            await this.storeCoordinationResult(coordination);
            
            return coordination;
            
        } catch (error) {
            console.error(`Error coordinating operation ${operation}:`, error);
            coordination.status = 'failed';
            coordination.error = error.message;
            return coordination;
        }
    }

    /**
     * Manage resource allocation across services
     */
    async allocateResources() {
        const totalResources = 100; // Abstract resource units
        const allocations = new Map();
        
        // Get service priorities based on current load
        const priorities = await this.calculateServicePriorities();
        
        // Allocate resources proportionally
        let remainingResources = totalResources;
        for (const [serviceId, priority] of priorities) {
            const allocation = Math.floor(remainingResources * priority);
            allocations.set(serviceId, allocation);
            remainingResources -= allocation;
        }
        
        // Apply allocations
        for (const [serviceId, allocation] of allocations) {
            this.resourceAllocation.set(serviceId, {
                units: allocation,
                timestamp: new Date(),
                priority: priorities.get(serviceId)
            });
            
            // Notify service of allocation
            const service = this.services.get(serviceId);
            if (service && service.instance.setResourceAllocation) {
                await service.instance.setResourceAllocation(allocation);
            }
        }
        
        return allocations;
    }

    /**
     * Monitor service health and performance
     */
    startMonitoring() {
        console.log('Starting learning orchestrator monitoring...');
        
        // Health check interval
        setInterval(async () => {
            // CHECK AUTH BEFORE ANY OPERATIONS
            if (!this.serviceToken || !this.serviceToken.apiKey) {
                console.warn('Skipping health check - not authenticated');
                return;
            }
            
            for (const [serviceId, service] of this.services) {
                try {
                    const health = await this.checkServiceHealth(service);
                    service.status = health.status;
                    service.lastHealthCheck = new Date();
                    
                    if (health.status !== 'active') {
                        await this.handleUnhealthyService(serviceId, health);
                    }
                } catch (error) {
                    console.error(`Health check failed for ${serviceId}:`, error);
                    service.status = 'error';
                }
            }
        }, 60000); // Every minute
        
        // Performance monitoring
        setInterval(async () => {
            // CHECK AUTH BEFORE ANY OPERATIONS
            if (!this.serviceToken || !this.serviceToken.apiKey) {
                console.warn('Skipping performance metrics - not authenticated');
                return;
            }
            
            try {
                const performance = await this.aggregatePerformanceMetrics();
                
                // Create proper context with validated API key
                const context = {
                    serviceId: this.serviceId,
                    apiKey: this.serviceToken.apiKey, // Guaranteed to exist now
                    operation: 'storePerformanceMetrics',
                    practiceId: 'global'
                };
                
                // Store metrics
                await SecureDataAccess.insert(
                    'learning_performance_metrics',
                    performance,
                    context
                );
                
                // Check for performance issues
                if (performance.avgResponseTime > 5000) {
                    await this.handlePerformanceIssue(performance);
                }
            } catch (error) {
                console.error('Performance monitoring error:', error.message);
            }
        }, 300000); // Every 5 minutes
        
        // Resource reallocation
        setInterval(async () => {
            // CHECK AUTH BEFORE ANY OPERATIONS
            if (!this.serviceToken || !this.serviceToken.apiKey) {
                console.warn('Skipping resource allocation - not authenticated');
                return;
            }
            
            try {
                await this.allocateResources();
            } catch (error) {
                console.error('Resource allocation error:', error.message);
            }
        }, 600000); // Every 10 minutes
    }

    /**
     * Subscribe to orchestration events
     */
    subscribeToEvents() {
        // Service coordination events
        learningEventBus.subscribe('orchestration.requested',
            this.handleOrchestrationRequest.bind(this),
            this.serviceId
        );
        
        // Pipeline execution events
        learningEventBus.subscribe('pipeline.execute',
            this.handlePipelineExecution.bind(this),
            this.serviceId
        );
        
        // Emergency events
        learningEventBus.subscribe('service.emergency',
            this.handleServiceEmergency.bind(this),
            this.serviceId
        );
    }

    /**
     * Event Handlers
     */
    async handleOrchestrationRequest(data) {
        const { operation, context } = data;
        return await this.coordinateOperation(operation, context);
    }

    async handlePipelineExecution(data) {
        const { pipeline, input } = data;
        return await this.executePipeline(pipeline, input);
    }

    async handleServiceEmergency(data) {
        const { serviceId, issue, severity } = data;
        
        console.error(`Emergency in ${serviceId}: ${issue} (severity: ${severity})`);
        
        // Take corrective action based on severity
        if (severity === 'critical') {
            // Redirect traffic to backup service
            await this.enableFailover(serviceId);
        } else if (severity === 'high') {
            // Reduce load on service
            await this.reduceServiceLoad(serviceId);
        }
        
        // Notify administrators
        await learningEventBus.emit('admin.notification', {
            type: 'service_emergency',
            serviceId,
            issue,
            severity,
            timestamp: new Date()
        });
    }

    /**
     * Helper Methods
     */
    async getActiveClinics() {
        try {
            // Check authentication before operations
            if (!this.serviceToken || !this.serviceToken.apiKey) {
                console.warn('LearningOrchestrator not authenticated - cannot get practices');
                return [];
            }
            
            return await SecureDataAccess.query(
                'practices',
                { active: true },
                { limit: 100 },
                {
                    serviceId: this.serviceId,
                    apiKey: this.serviceToken.apiKey, // Guaranteed to exist now
                    operation: 'getActiveClinics',
                    practiceId: 'global'
                }
            );
        } catch (error) {
            console.error('Error getting active practices:', error);
            return [];
        }
    }

    async evaluateSolution(solution, challenge) {
        // Basic evaluation logic
        if (!solution || !solution.completed) return false;
        
        // Check if solution meets challenge requirements
        const meetsRequirements = challenge.requirements.every(req => 
            solution.achievements?.includes(req)
        );
        
        // Check efficiency
        const efficiencyMet = solution.efficiency >= (challenge.minEfficiency || 0.5);
        
        return meetsRequirements && efficiencyMet;
    }

    calculateNextCycleDelay(performance) {
        // Adaptive delay based on performance
        const baseDelay = 60000; // 1 minute
        
        if (performance.successRate > 0.9) {
            return baseDelay * 0.5; // Speed up if doing well
        } else if (performance.successRate < 0.3) {
            return baseDelay * 2; // Slow down if struggling
        }
        
        return baseDelay;
    }

    async checkServiceHealth(service) {
        // Basic health check
        return {
            status: service.metrics.errors > 10 ? 'degraded' : 'active',
            errorRate: service.metrics.errors / (service.metrics.requests || 1),
            responseTime: service.metrics.avgResponseTime,
            lastCheck: new Date()
        };
    }

    async calculateServicePriorities() {
        const priorities = new Map();
        const totalLoad = Array.from(this.services.values())
            .reduce((sum, s) => sum + s.metrics.requests, 0);
        
        for (const [serviceId, service] of this.services) {
            const loadShare = service.metrics.requests / (totalLoad || 1);
            const errorPenalty = service.metrics.errors * 0.01;
            const layerBonus = (8 - service.layer) * 0.05; // Higher layers get bonus
            
            const priority = Math.max(0.1, Math.min(0.5, 
                loadShare + layerBonus - errorPenalty));
            
            priorities.set(serviceId, priority);
        }
        
        return priorities;
    }

    updatePipelineMetrics(pipelineName, results) {
        if (!this.performanceMetrics.has(pipelineName)) {
            this.performanceMetrics.set(pipelineName, {
                executions: 0,
                successes: 0,
                failures: 0,
                avgDuration: 0
            });
        }
        
        const metrics = this.performanceMetrics.get(pipelineName);
        metrics.executions++;
        
        if (results.success) {
            metrics.successes++;
        } else {
            metrics.failures++;
        }
        
        metrics.avgDuration = (metrics.avgDuration * (metrics.executions - 1) + 
                              results.duration) / metrics.executions;
    }

    async aggregatePerformanceMetrics() {
        const metrics = {
            timestamp: new Date(),
            services: {},
            pipelines: {},
            totals: {
                requests: 0,
                errors: 0,
                avgResponseTime: 0
            }
        };
        
        // Aggregate service metrics
        for (const [serviceId, service] of this.services) {
            metrics.services[serviceId] = {
                status: service.status,
                requests: service.metrics.requests,
                errors: service.metrics.errors,
                avgResponseTime: service.metrics.avgResponseTime
            };
            
            metrics.totals.requests += service.metrics.requests;
            metrics.totals.errors += service.metrics.errors;
        }
        
        // Calculate average response time
        const activeServices = Array.from(this.services.values())
            .filter(s => s.metrics.requests > 0);
        
        if (activeServices.length > 0) {
            metrics.totals.avgResponseTime = 
                activeServices.reduce((sum, s) => sum + s.metrics.avgResponseTime, 0) / 
                activeServices.length;
        }
        
        // Aggregate pipeline metrics
        for (const [pipelineName, pipelineMetrics] of this.performanceMetrics) {
            metrics.pipelines[pipelineName] = { ...pipelineMetrics };
        }
        
        // Add R-Zero loop metrics
        metrics.rzeroLoops = {};
        for (const [loopId, loop] of this.activeLoops) {
            metrics.rzeroLoops[loopId] = {
                status: loop.status,
                currentCycle: loop.currentCycle,
                performance: loop.performance
            };
        }
        
        return metrics;
    }

    async storeCoordinationResult(coordination) {
        try {
            // Check authentication before operations
            if (!this.serviceToken || !this.serviceToken.apiKey) {
                console.warn('LearningOrchestrator not authenticated - cannot store coordination result');
                return;
            }
            
            await SecureDataAccess.insert(
                'orchestration_logs',
                coordination,
                {
                    serviceId: this.serviceId,
                    apiKey: this.serviceToken.apiKey, // Guaranteed to exist now
                    operation: 'storeCoordinationResult',
                    practiceId: coordination.context.practiceId || 'global'
                }
            );
        } catch (error) {
            console.error('Error storing coordination result:', error);
        }
    }

    async handleUnhealthyService(serviceId, health) {
        console.warn(`⚠️ Service ${serviceId} is unhealthy:`, health);
        
        // Log the issue
        await learningEventBus.emit('service.unhealthy', {
            serviceId,
            health,
            timestamp: new Date()
        });
        
        // If service is critical, try to restart it
        const service = this.services.get(serviceId);
        if (service && service.status === 'error') {
            console.log(`Attempting to restart ${serviceId}...`);
            try {
                if (service.instance && service.instance.initialize) {
                    await service.instance.initialize();
                    service.status = 'active';
                    console.log(`✅ Service ${serviceId} restarted successfully`);
                }
            } catch (error) {
                console.error(`Failed to restart ${serviceId}:`, error.message);
            }
        }
    }

    async handlePerformanceIssue(performance) {
        console.warn('⚠️ Performance issue detected:', {
            avgResponseTime: performance.avgResponseTime,
            threshold: 5000
        });
        
        // Emit performance alert
        await learningEventBus.emit('performance.degraded', {
            metrics: performance,
            timestamp: new Date()
        });
        
        // Consider reducing load on slow services
        for (const [serviceId, metrics] of Object.entries(performance.services)) {
            if (metrics.avgResponseTime > 10000) { // 10 seconds
                await this.reduceServiceLoad(serviceId);
            }
        }
    }

    async enableFailover(serviceId) {
        console.log(`🔄 Enabling failover for ${serviceId}`);
        
        const service = this.services.get(serviceId);
        if (service) {
            service.status = 'failover';
            
            // Route requests to backup service or queue them
            await learningEventBus.emit('service.failover', {
                serviceId,
                timestamp: new Date()
            });
        }
    }

    async reduceServiceLoad(serviceId) {
        console.log(`📉 Reducing load on ${serviceId}`);
        
        const service = this.services.get(serviceId);
        if (service) {
            // Implement load reduction strategies
            service.status = 'throttled';
            
            // Could implement rate limiting, request queuing, etc.
            await learningEventBus.emit('service.throttled', {
                serviceId,
                timestamp: new Date()
            });
        }
    }

    getMetrics() {
        return {
            services: this.services.size,
            pipelines: this.pipelines.size,
            activeLoops: this.activeLoops.size,
            performance: Object.fromEntries(this.performanceMetrics)
        };
    }
}

// Create and export singleton instance
const learningOrchestrator = new LearningOrchestrator();

// DO NOT auto-initialize - will be initialized by learningServicesInitializer
// This prevents circular dependency issues and ensures proper startup order

module.exports = learningOrchestrator;