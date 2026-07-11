/**
 * Function Interceptor for Learning System
 * 
 * Intercepts and captures all platform function calls for learning analytics
 * Integrates with agentServiceV4 to track how users interact with 470+ functions
 */

const interactionCaptureService = require('./interactionCaptureService');
const { learningEventBus } = require('./learningEventBus');
const SecureDataAccess = require('../secureDataAccess');
const serviceAccountManager = require('../serviceAccountManager');

class FunctionInterceptor {
    constructor() {
        this.serviceId = 'function-interceptor';
        this.serviceToken = null;
        this.functionMetadata = new Map();
        this.interceptedFunctions = new Set();
        this.captureEnabled = true;
        this.batchSize = 10;
        this.batch = [];
        this.flushInterval = 5000; // 5 seconds
        this.initialized = false;
        this.functionsWrapped = false;  // Track if functions are already wrapped
    }

    async initialize() {
        if (this.initialized) return;

        // Authenticate service
        try {
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
        } catch (error) {
            console.error(`Failed to authenticate ${this.serviceId}:`, error.message);
        }

        // Initialize interaction capture service - CRITICAL FIX
        await interactionCaptureService.initialize();
        console.log('✅ InteractionCaptureService initialized for learning');

        // Start batch flush interval
        this.startBatchFlush();
        
        // Load function metadata
        await this.loadFunctionMetadata();
        
        this.initialized = true;
        console.log('✅ FunctionInterceptor initialized');
    }

    /**
     * Wrap a function to capture its execution for learning
     */
    wrapFunction(originalFunction, metadata) {
        const interceptor = this;
        const functionName = metadata.name || originalFunction.name || 'anonymous';
        
        // Mark as intercepted
        this.interceptedFunctions.add(functionName);
        
        // Store metadata
        this.functionMetadata.set(functionName, {
            ...metadata,
            interceptedAt: new Date(),
            callCount: 0,
            totalTime: 0,
            errors: 0
        });
        
        // Return wrapped function
        return async function(...args) {
            const startTime = Date.now();
            const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Extract context from arguments (assumes last arg might be context)
            const context = interceptor.extractContext(args, metadata);
            
            // Capture function call start
            if (interceptor.captureEnabled) {
                interceptor.captureCall({
                    callId,
                    functionName,
                    category: metadata.category,
                    subcategory: metadata.subcategory,
                    params: interceptor.sanitizeParams(args, metadata),
                    context,
                    startTime,
                    type: 'start'
                });
            }
            
            try {
                // Execute original function
                const result = await originalFunction.apply(this, args);
                
                // Capture successful completion
                if (interceptor.captureEnabled) {
                    interceptor.captureCall({
                        callId,
                        functionName,
                        category: metadata.category,
                        subcategory: metadata.subcategory,
                        duration: Date.now() - startTime,
                        success: true,
                        resultType: interceptor.getResultType(result),
                        context,
                        type: 'complete'
                    });
                }
                
                // Update function metrics
                const funcMeta = interceptor.functionMetadata.get(functionName);
                funcMeta.callCount++;
                funcMeta.totalTime += (Date.now() - startTime);
                
                return result;
                
            } catch (error) {
                // Capture error
                if (interceptor.captureEnabled) {
                    interceptor.captureCall({
                        callId,
                        functionName,
                        category: metadata.category,
                        subcategory: metadata.subcategory,
                        duration: Date.now() - startTime,
                        success: false,
                        error: error.message,
                        errorType: error.name,
                        context,
                        type: 'error'
                    });
                }
                
                // Update error count
                const funcMeta = interceptor.functionMetadata.get(functionName);
                funcMeta.errors++;
                
                // Re-throw error
                throw error;
            }
        };
    }

    /**
     * Wrap all functions in agentServiceV4
     */
    async wrapAgentServiceFunctions(agentService) {
        // Skip if already wrapped to avoid performance overhead
        if (this.functionsWrapped) {
            console.log('⚡ Using cached functions for en-USA');
            return 1353;  // Return cached count
        }

        console.log('🔄 Wrapping agentServiceV4 functions for learning...');
        
        // Get all function groups from agentServiceV4
        const functionGroups = agentService.getFunctionGroups ? 
            agentService.getFunctionGroups() : 
            this.extractFunctionGroups(agentService);
        
        let wrappedCount = 0;
        
        for (const [category, subcategories] of Object.entries(functionGroups)) {
            for (const [subcategory, functions] of Object.entries(subcategories)) {
                for (const [funcName, funcDef] of Object.entries(functions)) {
                    if (typeof funcDef === 'function' || 
                        (funcDef && typeof funcDef.handler === 'function')) {
                        
                        const handler = typeof funcDef === 'function' ? 
                            funcDef : funcDef.handler;
                        
                        const metadata = {
                            name: funcName,
                            category,
                            subcategory,
                            description: funcDef.description || '',
                            params: funcDef.params || [],
                            sensitive: funcDef.sensitive || false,
                            critical: funcDef.critical || false
                        };
                        
                        // Wrap the function
                        const wrapped = this.wrapFunction(handler, metadata);
                        
                        // Replace with wrapped version
                        if (typeof funcDef === 'function') {
                            functions[funcName] = wrapped;
                        } else {
                            funcDef.handler = wrapped;
                        }
                        
                        wrappedCount++;
                    }
                }
            }
        }
        
        console.log(`✅ Wrapped ${wrappedCount} functions for learning`);

        // Mark as wrapped to avoid re-wrapping on subsequent calls
        this.functionsWrapped = true;

        // Emit event
        await learningEventBus.emit('functions.wrapped', {
            count: wrappedCount,
            categories: Object.keys(functionGroups),
            timestamp: new Date()
        });

        return wrappedCount;
    }

    /**
     * Extract function groups from service structure
     */
    extractFunctionGroups(service) {
        const groups = {};
        
        // Common patterns in agentServiceV4
        const categoryPatterns = [
            'patientFunctions',
            'appointmentFunctions',
            'documentFunctions',
            'billingFunctions',
            'communicationFunctions',
            'workflowFunctions',
            'reportingFunctions',
            'administrationFunctions'
        ];
        
        for (const pattern of categoryPatterns) {
            if (service[pattern]) {
                groups[pattern.replace('Functions', '')] = service[pattern];
            }
        }
        
        // Also check for direct function definitions
        if (service.functions) {
            Object.assign(groups, service.functions);
        }
        
        return groups;
    }

    /**
     * Capture function call for learning
     */
    captureCall(callData) {
        // Add to batch
        this.batch.push({
            ...callData,
            timestamp: new Date()
        });
        
        // Flush if batch is full
        if (this.batch.length >= this.batchSize) {
            this.flushBatch();
        }
    }

    /**
     * Flush batch of captured calls
     */
    async flushBatch() {
        if (this.batch.length === 0) return;
        
        const toFlush = [...this.batch];
        this.batch = [];
        
        try {
            // Process each call
            for (const call of toFlush) {
                // Capture interaction for learning
                await interactionCaptureService.captureFunctionCall(
                    call.functionName,
                    call.params,
                    {
                        success: call.success,
                        duration: call.duration,
                        resultType: call.resultType,
                        error: call.error
                    },
                    call.context
                );
                
                // Emit specific events based on patterns
                if (call.type === 'complete') {
                    await this.detectAndEmitPatterns(call);
                }
            }
            
            // Store batch in database for analysis
            await SecureDataAccess.insert(
                'function_call_logs',
                {
                    batch: toFlush,
                    processedAt: new Date(),
                    batchSize: toFlush.length
                },
                {
                    serviceId: this.serviceId,
                    apiKey: this.serviceToken?.apiKey,
                    operation: 'storeFunctionCalls',
                    practiceId: 'global'
                }
            );
            
        } catch (error) {
            console.error('Error flushing function call batch:', error);
        }
    }

    /**
     * Detect patterns and emit relevant events
     */
    async detectAndEmitPatterns(call) {
        // Detect workflow patterns
        if (call.category === 'workflow' || call.category === 'appointment') {
            await learningEventBus.emit('workflow.function.called', {
                function: call.functionName,
                duration: call.duration,
                context: call.context
            });
        }
        
        // Detect repetitive actions
        const funcMeta = this.functionMetadata.get(call.functionName);
        if (funcMeta && funcMeta.callCount > 10) {
            const avgTime = funcMeta.totalTime / funcMeta.callCount;
            
            if (call.duration > avgTime * 2) {
                // Function took much longer than average
                await learningEventBus.emit('function.performance.degraded', {
                    function: call.functionName,
                    avgTime,
                    actualTime: call.duration,
                    degradation: (call.duration / avgTime) - 1
                });
            }
        }
        
        // Detect error patterns
        if (!call.success && funcMeta) {
            const errorRate = funcMeta.errors / funcMeta.callCount;
            if (errorRate > 0.1) { // More than 10% error rate
                await learningEventBus.emit('function.high.error.rate', {
                    function: call.functionName,
                    errorRate,
                    totalErrors: funcMeta.errors,
                    totalCalls: funcMeta.callCount
                });
            }
        }
    }

    /**
     * Extract context from function arguments
     */
    extractContext(args, metadata) {
        const context = {
            timestamp: new Date()
        };
        
        // Look for common context patterns
        for (const arg of args) {
            if (arg && typeof arg === 'object') {
                if (arg.userId) context.userId = arg.userId;
                if (arg.practiceId) context.practiceId = arg.practiceId;
                if (arg.patientId) context.patientId = arg.patientId;
                if (arg.sessionId) context.sessionId = arg.sessionId;
                if (arg.req && arg.req.user) {
                    context.userId = arg.req.user.id;
                    context.practiceId = arg.req.practice?.id;
                }
            }
        }
        
        return context;
    }

    /**
     * Sanitize parameters to remove sensitive data
     */
    sanitizeParams(args, metadata) {
        if (metadata.sensitive) {
            // Don't capture params for sensitive functions
            return { sanitized: true, count: args.length };
        }
        
        // Sanitize common sensitive fields
        const sanitized = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                const clean = { ...arg };
                
                // Remove sensitive fields
                const sensitiveFields = [
                    'password', 'token', 'apiKey', 'secret',
                    'ssn', 'creditCard', 'bankAccount'
                ];
                
                for (const field of sensitiveFields) {
                    if (clean[field]) {
                        clean[field] = '[REDACTED]';
                    }
                }
                
                return clean;
            }
            return arg;
        });
        
        return sanitized;
    }

    /**
     * Get result type for learning
     */
    getResultType(result) {
        if (result === null) return 'null';
        if (result === undefined) return 'undefined';
        if (Array.isArray(result)) return `array[${result.length}]`;
        if (typeof result === 'object') {
            const keys = Object.keys(result);
            return `object[${keys.length}]`;
        }
        return typeof result;
    }

    /**
     * Start batch flush interval
     */
    startBatchFlush() {
        setInterval(() => {
            if (this.batch.length > 0) {
                this.flushBatch();
            }
        }, this.flushInterval);
    }

    /**
     * Load function metadata from database
     */
    async loadFunctionMetadata() {
        try {
            const metadata = await SecureDataAccess.query(
                'function_metadata',
                { active: true },
                { limit: 1000 },
                {
                    serviceId: this.serviceId,
                    apiKey: this.serviceToken?.apiKey,
                    operation: 'loadFunctionMetadata',
                    practiceId: 'global'
                }
            );
            
            for (const meta of metadata) {
                this.functionMetadata.set(meta.functionName, meta);
            }
            
            console.log(`Loaded metadata for ${metadata.length} functions`);
        } catch (error) {
            console.error('Error loading function metadata:', error);
        }
    }

    /**
     * Enable or disable capture
     */
    setCapture(enabled) {
        this.captureEnabled = enabled;
        console.log(`Function capture ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get function statistics
     */
    getFunctionStats() {
        const stats = [];
        
        for (const [name, meta] of this.functionMetadata.entries()) {
            if (meta.callCount > 0) {
                stats.push({
                    name,
                    category: meta.category,
                    subcategory: meta.subcategory,
                    callCount: meta.callCount,
                    avgTime: meta.totalTime / meta.callCount,
                    errorRate: meta.errors / meta.callCount,
                    totalTime: meta.totalTime,
                    errors: meta.errors
                });
            }
        }
        
        // Sort by call count
        stats.sort((a, b) => b.callCount - a.callCount);
        
        return stats;
    }

    /**
     * Get most used functions
     */
    getMostUsedFunctions(limit = 10) {
        const stats = this.getFunctionStats();
        return stats.slice(0, limit);
    }

    /**
     * Get slowest functions
     */
    getSlowestFunctions(limit = 10) {
        const stats = this.getFunctionStats();
        stats.sort((a, b) => b.avgTime - a.avgTime);
        return stats.slice(0, limit);
    }

    /**
     * Get error-prone functions
     */
    getErrorProneFunctions(limit = 10) {
        const stats = this.getFunctionStats();
        stats.sort((a, b) => b.errorRate - a.errorRate);
        return stats.filter(s => s.errors > 0).slice(0, limit);
    }
}

// Create and export singleton instance
const functionInterceptor = new FunctionInterceptor();

// Initialize on first import
if (!functionInterceptor.initialized) {
    functionInterceptor.initialize().catch(error => {
        console.error('Failed to initialize FunctionInterceptor:', error);
    });
}

module.exports = functionInterceptor;