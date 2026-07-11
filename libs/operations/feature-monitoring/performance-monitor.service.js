const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            apiResponseTimes: new Map(),
            serviceStartupTimes: new Map(),
            memoryUsage: [],
            cpuUsage: [],
            databaseQueryTimes: [],
            errorRates: new Map(),
            cacheHitRates: new Map(),
            queueLengths: new Map(),
            activeConnections: 0,
            requestsPerSecond: 0
        };
        
        this.thresholds = {
            responseTime: 2000,
            errorRate: 5,
            memoryUsage: 80,
            cpuUsage: 75,
            serviceFailure: true,
            databaseConnection: true
        };
        
        this.baseline = {
            buildTime: 15 * 60 * 1000,
            testTime: 20 * 60 * 1000,
            deployTime: 30 * 60 * 1000,
            apiResponseTime: 500
        };
        
        this.serviceToken = null;
        this.initialized = false;
        this.alerts = [];
        this.monitoringInterval = null;
        this.requestCounter = 0;
        this.lastRequestTime = Date.now();
    }

    async initialize() {
        try {
            this.serviceToken = await serviceAccountManager.authenticate('performance-monitor');
            this._startContinuousMonitoring();
            this._initializeHealthChecks();
            this.initialized = true;
            console.log('✅ Performance Monitor initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Performance Monitor:', error);
            throw error;
        }
    }

    recordApiResponseTime(endpoint, responseTime, statusCode = 200) {
        if (!this.metrics.apiResponseTimes.has(endpoint)) {
            this.metrics.apiResponseTimes.set(endpoint, []);
        }
        
        const times = this.metrics.apiResponseTimes.get(endpoint);
        times.push({
            time: responseTime,
            timestamp: Date.now(),
            statusCode
        });
        
        if (times.length > 100) {
            times.splice(0, times.length - 100);
        }
        
        this.requestCounter++;
        this._updateRequestsPerSecond();
        
        if (responseTime > this.thresholds.responseTime) {
            this._triggerAlert('response_time', {
                endpoint,
                responseTime,
                threshold: this.thresholds.responseTime
            });
        }
    }

    recordServiceStartupTime(serviceName, startupTime) {
        this.metrics.serviceStartupTimes.set(serviceName, {
            time: startupTime,
            timestamp: Date.now()
        });
        console.log(`[PerformanceMonitor] Service ${serviceName} startup time: ${startupTime}ms`);
    }

    recordDatabaseQueryTime(query, duration, collection = null) {
        this.metrics.databaseQueryTimes.push({
            query: query.substring(0, 100),
            duration,
            collection,
            timestamp: Date.now()
        });
        
        if (this.metrics.databaseQueryTimes.length > 500) {
            this.metrics.databaseQueryTimes.splice(0, this.metrics.databaseQueryTimes.length - 500);
        }
    }

    recordErrorRate(service, errors, total) {
        const rate = (errors / total) * 100;
        this.metrics.errorRates.set(service, {
            rate,
            errors,
            total,
            timestamp: Date.now()
        });
        
        if (rate > this.thresholds.errorRate) {
            this._triggerAlert('error_rate', {
                service,
                rate,
                threshold: this.thresholds.errorRate,
                errors,
                total
            });
        }
    }

    _updateRequestsPerSecond() {
        const now = Date.now();
        const timeDiff = now - this.lastRequestTime;
        
        if (timeDiff >= 1000) {
            this.metrics.requestsPerSecond = this.requestCounter;
            this.requestCounter = 0;
            this.lastRequestTime = now;
        }
    }

    _startContinuousMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            try {
                await this._collectSystemMetrics();
                await this._checkHealthThresholds();
            } catch (error) {
                console.error('[PerformanceMonitor] Error in continuous monitoring:', error);
            }
        }, 30000);
    }

    async _collectSystemMetrics() {
        try {
            const memUsage = process.memoryUsage();
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemoryPercent = ((totalMemory - freeMemory) / totalMemory) * 100;
            
            this.metrics.memoryUsage.push({
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                systemUsedPercent: usedMemoryPercent,
                timestamp: Date.now()
            });
            
            if (this.metrics.memoryUsage.length > 100) {
                this.metrics.memoryUsage.splice(0, this.metrics.memoryUsage.length - 100);
            }
            
            const cpuUsage = process.cpuUsage();
            this.metrics.cpuUsage.push({
                user: cpuUsage.user,
                system: cpuUsage.system,
                timestamp: Date.now()
            });
            
            if (this.metrics.cpuUsage.length > 100) {
                this.metrics.cpuUsage.splice(0, this.metrics.cpuUsage.length - 100);
            }
            
        } catch (error) {
            console.error('[PerformanceMonitor] Error collecting system metrics:', error);
        }
    }

    async _checkHealthThresholds() {
        if (this.metrics.memoryUsage.length > 0) {
            const latestMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
            if (latestMemory.systemUsedPercent > this.thresholds.memoryUsage) {
                this._triggerAlert('memory_usage', {
                    usage: latestMemory.systemUsedPercent,
                    threshold: this.thresholds.memoryUsage
                });
            }
        }
    }

    _triggerAlert(type, data) {
        const alert = {
            type,
            data,
            timestamp: Date.now(),
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        this.alerts.push(alert);
        
        if (this.alerts.length > 100) {
            this.alerts.splice(0, this.alerts.length - 100);
        }
        
        console.warn(`[PerformanceMonitor] ALERT [${type}]:`, data);
    }

    _initializeHealthChecks() {
        console.log('[PerformanceMonitor] Health check endpoints initialized');
    }

    getMetrics() {
        return {
            ...this.metrics,
            alerts: this.alerts,
            thresholds: this.thresholds,
            baseline: this.baseline
        };
    }

    getHealthStatus() {
        const criticalAlerts = this.alerts.filter(alert => 
            Date.now() - alert.timestamp < 300000
        );
        
        return {
            healthy: criticalAlerts.length === 0,
            initialized: this.initialized,
            uptime: process.uptime(),
            criticalAlerts: criticalAlerts.length,
            recentAlerts: this.alerts.slice(-10),
            metrics: {
                requestsPerSecond: this.metrics.requestsPerSecond,
                activeConnections: this.metrics.activeConnections
            }
        };
    }

    async cleanup() {
        try {
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }
            console.log('[PerformanceMonitor] Cleanup completed');
        } catch (error) {
            console.error('[PerformanceMonitor] Error during cleanup:', error);
        }
    }
}

module.exports = new PerformanceMonitor();