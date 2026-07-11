// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class DualRunAuthenticationService {
    constructor() {
        this.serviceId = 'dual-run-auth-service';
        this.trafficSplit = {
            newSystem: 10,  // Start with 10% to new system
            oldSystem: 90   // 90% to old system
        };
        this.metrics = {
            newSystemRequests: 0,
            oldSystemRequests: 0,
            newSystemErrors: 0,
            oldSystemErrors: 0,
            newSystemResponseTime: [],
            oldSystemResponseTime: [],
            fallbackCount: 0
        };
        this.serviceToken = null;
        this.initialized = false;
        this.autoFallbackEnabled = true;
        this.fallbackThresholds = {
            errorRatePercent: 1,
            responseTimeMultiplier: 2,
            maxConsecutiveErrors: 5
        };
        this.consecutiveErrors = 0;
    }

    async initialize() {
        try {
            // Authenticate the service through proxy
            const proxy = getServiceProxy();
            const serviceAccountManager = proxy.getService('serviceAccountManager');
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
            
            // Start health monitoring
            this._startHealthMonitoring();
            
            // Load configuration
            await this._loadConfiguration();
            
            this.initialized = true;
            console.log('[DualRunAuth] Service initialized successfully');
            console.log(`[DualRunAuth] Traffic split: ${this.trafficSplit.newSystem}% new, ${this.trafficSplit.oldSystem}% old`);
            
            return true;
        } catch (error) {
            console.error('[DualRunAuth] Failed to initialize:', error);
            throw error;
        }
    }

    async routeAuthenticationRequest(authRequest, userId = null) {
        if (!this.initialized) {
            throw new Error('DualRunAuth service not initialized');
        }

        const shouldUseNewSystem = this._shouldRouteToNewSystem(userId);
        const startTime = Date.now();

        try {
            if (shouldUseNewSystem) {
                console.log(`[DualRunAuth] Routing auth to NEW system for user ${userId || 'anonymous'}`);
                return await this._routeToNewSystem(authRequest, startTime);
            } else {
                console.log(`[DualRunAuth] Routing auth to OLD system for user ${userId || 'anonymous'}`);
                return await this._routeToOldSystem(authRequest, startTime);
            }
        } catch (error) {
            console.error('[DualRunAuth] Authentication routing failed:', error);
            
            // If new system failed, try fallback to old system
            if (shouldUseNewSystem && this.autoFallbackEnabled) {
                console.warn('[DualRunAuth] NEW system failed, falling back to OLD system');
                this.metrics.fallbackCount++;
                this.consecutiveErrors++;
                
                try {
                    return await this._routeToOldSystem(authRequest, startTime);
                } catch (fallbackError) {
                    console.error('[DualRunAuth] Fallback to OLD system also failed:', fallbackError);
                    throw fallbackError;
                }
            }
            
            throw error;
        }
    }

    _shouldRouteToNewSystem(userId) {
        // Consistent routing for same user
        if (userId) {
            const hash = this._hashUserId(userId);
            const percentage = hash % 100;
            return percentage < this.trafficSplit.newSystem;
        }
        
        // Random routing for anonymous requests
        const random = Math.floor(Math.random() * 100);
        return random < this.trafficSplit.newSystem;
    }

    async _routeToNewSystem(authRequest, startTime) {
        try {
            this.metrics.newSystemRequests++;
            
            // Route to new authentication system
            // This would integrate with the new NX-based authentication
            const result = await this._callNewAuthSystem(authRequest);
            
            // Record response time
            const responseTime = Date.now() - startTime;
            this.metrics.newSystemResponseTime.push(responseTime);
            this._trimResponseTimeArray('new');
            
            // Reset consecutive errors on success
            this.consecutiveErrors = 0;
            
            return result;
        } catch (error) {
            this.metrics.newSystemErrors++;
            this.consecutiveErrors++;
            throw error;
        }
    }

    async _routeToOldSystem(authRequest, startTime) {
        try {
            this.metrics.oldSystemRequests++;
            
            // Route to existing authentication system
            const result = await this._callOldAuthSystem(authRequest);
            
            // Record response time
            const responseTime = Date.now() - startTime;
            this.metrics.oldSystemResponseTime.push(responseTime);
            this._trimResponseTimeArray('old');
            
            return result;
        } catch (error) {
            this.metrics.oldSystemErrors++;
            throw error;
        }
    }

    async _callNewAuthSystem(authRequest) {
        // This would be replaced with actual new system integration
        // For now, simulate the new authentication system
        console.log('[DualRunAuth] Calling NEW authentication system');
        
        // Simulate new system processing
        await this._delay(100 + Math.random() * 200);
        
        // Simulate occasional failures during migration
        if (Math.random() < 0.02) { // 2% failure rate for testing
            throw new Error('New authentication system temporary failure');
        }
        
        return {
            success: true,
            system: 'new',
            token: 'new-system-token-' + Date.now(),
            user: authRequest.user || 'test-user'
        };
    }

    async _callOldAuthSystem(authRequest) {
        // This would integrate with existing authentication
        console.log('[DualRunAuth] Calling OLD authentication system');
        
        // Simulate old system processing
        await this._delay(200 + Math.random() * 300);
        
        // Old system is stable with very low failure rate
        if (Math.random() < 0.001) { // 0.1% failure rate
            throw new Error('Old authentication system failure');
        }
        
        return {
            success: true,
            system: 'old',
            token: 'old-system-token-' + Date.now(),
            user: authRequest.user || 'test-user'
        };
    }

    _hashUserId(userId) {
        // Simple hash function for consistent user routing
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    _trimResponseTimeArray(system) {
        // Keep only last 100 response times for metrics
        const array = system === 'new' ? 
            this.metrics.newSystemResponseTime : 
            this.metrics.oldSystemResponseTime;
            
        if (array.length > 100) {
            array.splice(0, array.length - 100);
        }
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async updateTrafficSplit(newSystemPercent, oldSystemPercent) {
        if (newSystemPercent + oldSystemPercent !== 100) {
            throw new Error('Traffic split percentages must sum to 100');
        }
        
        console.log(`[DualRunAuth] Updating traffic split: ${newSystemPercent}% new, ${oldSystemPercent}% old`);
        
        this.trafficSplit.newSystem = newSystemPercent;
        this.trafficSplit.oldSystem = oldSystemPercent;
        
        // Log the change
        console.log(`[DualRunAuth] Traffic split updated successfully`);
    }

    async gradualMigration(targetNewPercent, stepSize = 10, intervalMinutes = 60) {
        console.log(`[DualRunAuth] Starting gradual migration to ${targetNewPercent}% new system`);
        console.log(`[DualRunAuth] Step size: ${stepSize}%, Interval: ${intervalMinutes} minutes`);
        
        const currentPercent = this.trafficSplit.newSystem;
        const direction = targetNewPercent > currentPercent ? 1 : -1;
        
        const migrationInterval = setInterval(async () => {
            try {
                const currentNew = this.trafficSplit.newSystem;
                const nextNew = Math.min(100, Math.max(0, currentNew + (stepSize * direction)));
                
                // Check if we've reached the target
                if ((direction > 0 && nextNew >= targetNewPercent) || 
                    (direction < 0 && nextNew <= targetNewPercent)) {
                    await this.updateTrafficSplit(targetNewPercent, 100 - targetNewPercent);
                    clearInterval(migrationInterval);
                    console.log(`[DualRunAuth] Gradual migration completed: ${targetNewPercent}% new system`);
                    return;
                }
                
                // Check system health before proceeding
                if (await this._shouldTriggerRollback()) {
                    console.warn('[DualRunAuth] Health check failed, stopping migration');
                    clearInterval(migrationInterval);
                    await this.rollbackToOldSystem();
                    return;
                }
                
                // Update traffic split
                await this.updateTrafficSplit(nextNew, 100 - nextNew);
                
            } catch (error) {
                console.error('[DualRunAuth] Error during gradual migration:', error);
                clearInterval(migrationInterval);
            }
        }, intervalMinutes * 60 * 1000); // Convert to milliseconds
        
        return migrationInterval;
    }

    async rollbackToOldSystem() {
        console.warn('[DualRunAuth] ROLLING BACK TO OLD SYSTEM');
        await this.updateTrafficSplit(0, 100);
        
        // Reset consecutive errors
        this.consecutiveErrors = 0;
        
        console.log('[DualRunAuth] Rollback completed - 100% traffic to old system');
    }

    async _shouldTriggerRollback() {
        // Check consecutive errors
        if (this.consecutiveErrors >= this.fallbackThresholds.maxConsecutiveErrors) {
            console.warn(`[DualRunAuth] Too many consecutive errors: ${this.consecutiveErrors}`);
            return true;
        }
        
        // Check error rate
        const totalNewRequests = this.metrics.newSystemRequests;
        if (totalNewRequests > 10) { // Only check after minimum requests
            const errorRate = (this.metrics.newSystemErrors / totalNewRequests) * 100;
            if (errorRate > this.fallbackThresholds.errorRatePercent) {
                console.warn(`[DualRunAuth] Error rate too high: ${errorRate}%`);
                return true;
            }
        }
        
        // Check response time
        const newAvgTime = this._getAverageResponseTime('new');
        const oldAvgTime = this._getAverageResponseTime('old');
        if (newAvgTime > oldAvgTime * this.fallbackThresholds.responseTimeMultiplier) {
            console.warn(`[DualRunAuth] Response time too high: ${newAvgTime}ms vs ${oldAvgTime}ms`);
            return true;
        }
        
        return false;
    }

    _getAverageResponseTime(system) {
        const times = system === 'new' ? 
            this.metrics.newSystemResponseTime : 
            this.metrics.oldSystemResponseTime;
            
        if (times.length === 0) return 0;
        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    _startHealthMonitoring() {
        // Monitor health every 30 seconds
        setInterval(async () => {
            try {
                const shouldRollback = await this._shouldTriggerRollback();
                if (shouldRollback && this.trafficSplit.newSystem > 0) {
                    console.warn('[DualRunAuth] Health monitoring triggered rollback');
                    await this.rollbackToOldSystem();
                }
            } catch (error) {
                console.error('[DualRunAuth] Error in health monitoring:', error);
            }
        }, 30000);
    }

    async _loadConfiguration() {
        // Load configuration from environment or config service
        this.autoFallbackEnabled = process.env.DUAL_RUN_AUTO_FALLBACK !== 'false';
        
        // Load thresholds from environment
        if (process.env.DUAL_RUN_ERROR_THRESHOLD) {
            this.fallbackThresholds.errorRatePercent = parseFloat(process.env.DUAL_RUN_ERROR_THRESHOLD);
        }
        if (process.env.DUAL_RUN_RESPONSE_TIME_MULTIPLIER) {
            this.fallbackThresholds.responseTimeMultiplier = parseFloat(process.env.DUAL_RUN_RESPONSE_TIME_MULTIPLIER);
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            trafficSplit: this.trafficSplit,
            consecutiveErrors: this.consecutiveErrors,
            autoFallbackEnabled: this.autoFallbackEnabled,
            averageResponseTimes: {
                new: this._getAverageResponseTime('new'),
                old: this._getAverageResponseTime('old')
            },
            errorRates: {
                new: this.metrics.newSystemRequests > 0 ? 
                    (this.metrics.newSystemErrors / this.metrics.newSystemRequests * 100) : 0,
                old: this.metrics.oldSystemRequests > 0 ? 
                    (this.metrics.oldSystemErrors / this.metrics.oldSystemRequests * 100) : 0
            }
        };
    }

    async getHealthStatus() {
        const metrics = this.getMetrics();
        const shouldRollback = await this._shouldTriggerRollback();
        
        return {
            healthy: !shouldRollback,
            initialized: this.initialized,
            metrics,
            fallbackThresholds: this.fallbackThresholds,
            recommendedAction: shouldRollback ? 'rollback' : 'continue'
        };
    }
}

// Create and export singleton
const dualRunAuthenticationService = new DualRunAuthenticationService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('dualRunAuthenticationService', () => dualRunAuthenticationService);
}

module.exports = dualRunAuthenticationService;