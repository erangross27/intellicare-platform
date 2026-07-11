/**
 * Function Interceptor - Modular Version
 * 
 * Intercepts and captures all platform function calls for learning analytics
 * Integrates with agentServiceV4 to track how users interact with 470+ functions
 */

const path = require('path');
const serviceAccountManager = require(path.resolve(__dirname, '../../../backend/services/serviceAccountManager'));
const SecureDataAccess = require(path.resolve(__dirname, '../../../backend/services/secureDataAccess'));

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
    }

    async initialize() {
        if (this.initialized) return;

        // Authenticate service
        try {
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
        } catch (error) {
            console.error(`Failed to authenticate ${this.serviceId}:`, error.message);
            throw error;
        }

        try {
            // Start batch flush interval
            this.startBatchFlush();
            
            // Load function metadata
            await this.loadFunctionMetadata();
            
            // Log initialization using SecureDataAccess
            const context = {
                serviceId: this.serviceId,
                operation: 'initialize',
                practiceId: 'global'
            };

            await SecureDataAccess.create('audit_logs', {
                action: 'SERVICE_INITIALIZED',
                service: 'function-interceptor',
                timestamp: new Date()
            }, context);

            this.initialized = true;
            console.log('✅ FunctionInterceptor initialized');
        } catch (error) {
            console.error('❌ Failed to initialize FunctionInterceptor:', error);
            throw error;
        }
    }

    /**
     * Load function metadata
     */
    async loadFunctionMetadata() {
        try {
            const context = {
                serviceId: this.serviceId,
                operation: 'load_metadata',
                practiceId: 'global'
            };

            const functions = await SecureDataAccess.query('function_metadata', {}, {}, context);
            
            if (functions) {
                functions.forEach(func => {
                    this.functionMetadata.set(func.name, func);
                });
            }

            console.log(`✅ Loaded ${this.functionMetadata.size} function metadata entries`);
        } catch (error) {
            console.error('Error loading function metadata:', error);
        }
    }

    /**
     * Intercept function call
     */
    async interceptFunction(functionName, parameters, userId, practiceId) {
        if (!this.captureEnabled) return;

        try {
            const interaction = {
                functionName,
                parameters: this.sanitizeParameters(parameters),
                userId,
                practiceId,
                timestamp: new Date(),
                metadata: this.functionMetadata.get(functionName) || {}
            };

            // Add to batch
            this.batch.push(interaction);

            // Track intercepted function
            this.interceptedFunctions.add(functionName);

            // Flush if batch is full
            if (this.batch.length >= this.batchSize) {
                await this.flushBatch();
            }

        } catch (error) {
            console.error('Error intercepting function:', error);
        }
    }

    /**
     * Sanitize parameters to remove sensitive data
     */
    sanitizeParameters(parameters) {
        if (!parameters || typeof parameters !== 'object') {
            return {};
        }

        const sanitized = { ...parameters };
        
        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'ssn', 'creditCard'];
        
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }

        return sanitized;
    }

    /**
     * Start batch flush interval
     */
    startBatchFlush() {
        this.batchInterval = setInterval(async () => {
            if (this.batch.length > 0) {
                await this.flushBatch();
            }
        }, this.flushInterval);
    }

    /**
     * Flush batch to database
     */
    async flushBatch() {
        if (this.batch.length === 0) return;

        try {
            const context = {
                serviceId: this.serviceId,
                operation: 'flush_interactions',
                practiceId: 'global'
            };

            // Create batch record
            const batchRecord = {
                interactions: this.batch.slice(),
                batchSize: this.batch.length,
                timestamp: new Date(),
                flushedBy: this.serviceId
            };

            await SecureDataAccess.create('function_interactions', batchRecord, context);

            // Clear batch
            this.batch = [];

        } catch (error) {
            console.error('Error flushing batch:', error);
        }
    }

    /**
     * Get interceptor statistics
     */
    getStats() {
        return {
            interceptedFunctions: this.interceptedFunctions.size,
            pendingBatch: this.batch.length,
            captureEnabled: this.captureEnabled,
            functionMetadata: this.functionMetadata.size
        };
    }

    /**
     * Enable/disable capture
     */
    setCaptureEnabled(enabled) {
        this.captureEnabled = enabled;
        console.log(`Function capture ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            serviceId: this.serviceId,
            initialized: this.initialized,
            captureEnabled: this.captureEnabled,
            interceptedFunctions: this.interceptedFunctions.size,
            stats: this.getStats()
        };
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
        }

        // Flush remaining batch
        if (this.batch.length > 0) {
            await this.flushBatch();
        }

        console.log('Function Interceptor shutdown complete');
    }
}

module.exports = new FunctionInterceptor();