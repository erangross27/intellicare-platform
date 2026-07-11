/**
 * Service Health Monitor
 * Tracks service initialization, dependencies, and circular dependency detection
 */

class ServiceHealthMonitor {
    constructor() {
        this.services = new Map();
        this.dependencies = new Map();
        this.initializationOrder = [];
        this.circularDependencies = new Set();
        this.startTime = Date.now();
    }

    /**
     * Track service initialization
     * @param {string} serviceId - Service identifier
     * @param {string} status - 'pending', 'initializing', 'initialized', 'failed'
     * @param {object} metadata - Additional service metadata
     */
    trackServiceInit(serviceId, status, metadata = {}) {
        const timestamp = Date.now();
        const service = this.services.get(serviceId) || {
            id: serviceId,
            firstSeen: timestamp,
            attempts: 0
        };

        service.status = status;
        service.lastUpdate = timestamp;
        service.metadata = { ...service.metadata, ...metadata };

        if (status === 'initializing') {
            service.attempts++;
            service.initStart = timestamp;
        } else if (status === 'initialized') {
            service.initEnd = timestamp;
            service.initDuration = service.initEnd - service.initStart;
            this.initializationOrder.push(serviceId);
        } else if (status === 'failed') {
            service.error = metadata.error;
        }

        this.services.set(serviceId, service);
        
        // Log status change
        console.log(`[HealthMonitor] ${serviceId}: ${status}${metadata.error ? ` - ${metadata.error}` : ''}`);
    }

    /**
     * Check for circular dependency between services
     * @param {string} serviceA - First service
     * @param {string} serviceB - Second service
     * @returns {boolean} True if circular dependency detected
     */
    checkCircularDependency(serviceA, serviceB) {
        // Add dependency
        if (!this.dependencies.has(serviceA)) {
            this.dependencies.set(serviceA, new Set());
        }
        this.dependencies.get(serviceA).add(serviceB);

        // Check for cycle using DFS
        const visited = new Set();
        const recursionStack = new Set();

        const hasCycle = (node, path = []) => {
            if (recursionStack.has(node)) {
                // Found a cycle
                const cycleStart = path.indexOf(node);
                const cycle = [...path.slice(cycleStart), node].join(' → ');
                this.circularDependencies.add(cycle);
                console.error(`⚠️ Circular dependency detected: ${cycle}`);
                return true;
            }

            if (visited.has(node)) {
                return false;
            }

            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            const deps = this.dependencies.get(node) || new Set();
            for (const dep of deps) {
                if (hasCycle(dep, [...path])) {
                    return true;
                }
            }

            recursionStack.delete(node);
            return false;
        };

        return hasCycle(serviceA);
    }

    /**
     * Get initialization report
     * @returns {object} Detailed report of service initialization
     */
    getInitializationReport() {
        const totalTime = Date.now() - this.startTime;
        const initialized = Array.from(this.services.values())
            .filter(s => s.status === 'initialized');
        const failed = Array.from(this.services.values())
            .filter(s => s.status === 'failed');
        const pending = Array.from(this.services.values())
            .filter(s => s.status === 'pending' || s.status === 'initializing');

        const avgInitTime = initialized.length > 0
            ? initialized.reduce((sum, s) => sum + (s.initDuration || 0), 0) / initialized.length
            : 0;

        return {
            summary: {
                totalServices: this.services.size,
                initialized: initialized.length,
                failed: failed.length,
                pending: pending.length,
                totalTime: totalTime,
                avgInitTime: Math.round(avgInitTime)
            },
            initializationOrder: this.initializationOrder,
            failedServices: failed.map(s => ({
                id: s.id,
                error: s.error,
                attempts: s.attempts
            })),
            pendingServices: pending.map(s => s.id),
            circularDependencies: Array.from(this.circularDependencies),
            services: Object.fromEntries(this.services)
        };
    }

    /**
     * Get dependency graph
     * @returns {object} Service dependency graph
     */
    getDependencyGraph() {
        const graph = {};
        
        for (const [service, deps] of this.dependencies.entries()) {
            graph[service] = Array.from(deps);
        }
        
        return {
            nodes: Array.from(this.services.keys()),
            edges: graph,
            circularDependencies: Array.from(this.circularDependencies)
        };
    }

    /**
     * Check overall health status
     * @returns {object} Health status summary
     */
    getHealthStatus() {
        const report = this.getInitializationReport();
        const hasCircularDeps = this.circularDependencies.size > 0;
        const failureRate = report.summary.totalServices > 0
            ? (report.summary.failed / report.summary.totalServices) * 100
            : 0;

        let status = 'healthy';
        const issues = [];

        if (hasCircularDeps) {
            status = 'degraded';
            issues.push(`${this.circularDependencies.size} circular dependencies detected`);
        }

        if (failureRate > 20) {
            status = 'critical';
            issues.push(`High failure rate: ${failureRate.toFixed(1)}%`);
        } else if (failureRate > 10) {
            status = status === 'healthy' ? 'degraded' : status;
            issues.push(`Moderate failure rate: ${failureRate.toFixed(1)}%`);
        }

        if (report.summary.pending > 0 && totalTime > 60000) {
            status = status === 'healthy' ? 'degraded' : status;
            issues.push(`${report.summary.pending} services still pending after 1 minute`);
        }

        return {
            status,
            issues,
            metrics: {
                failureRate: failureRate.toFixed(1),
                avgInitTime: report.summary.avgInitTime,
                totalTime: report.summary.totalTime,
                circularDependencies: this.circularDependencies.size
            }
        };
    }

    /**
     * Reset monitor (for testing)
     */
    reset() {
        this.services.clear();
        this.dependencies.clear();
        this.initializationOrder = [];
        this.circularDependencies.clear();
        this.startTime = Date.now();
    }
}

// Export singleton instance
module.exports = new ServiceHealthMonitor();