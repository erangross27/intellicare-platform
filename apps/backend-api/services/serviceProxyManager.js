/**
 * Service Proxy Manager
 * Provides centralized service access without circular dependencies
 * Services register themselves and can be accessed via proxies
 */

class ServiceProxyManager {
    constructor() {
        this.services = new Map();
        this.serviceLoaders = new Map();
        this.loadingPromises = new Map();
        this.initialized = false;
    }

    /**
     * Register a service loader function
     * @param {string} serviceName - Name of the service
     * @param {Function} loaderFunction - Function that returns the service instance
     */
    register(serviceName, loaderFunction) {
        if (this.serviceLoaders.has(serviceName)) {
            console.warn(`Service ${serviceName} already registered`);
            return;
        }
        this.serviceLoaders.set(serviceName, loaderFunction);
    }

    /**
     * Get a service proxy that loads on first access
     * @param {string} serviceName - Name of the service
     * @returns {Proxy} Proxy to the service
     */
    get(serviceName) {
        // Return proxy that loads service on first access
        return new Proxy({}, {
            get: (target, prop) => {
                const service = this._loadService(serviceName);
                if (!service) {
                    throw new Error(`Service ${serviceName} not found`);
                }
                return service[prop];
            },
            set: (target, prop, value) => {
                const service = this._loadService(serviceName);
                if (!service) {
                    throw new Error(`Service ${serviceName} not found`);
                }
                service[prop] = value;
                return true;
            }
        });
    }

    /**
     * Load a service if not already loaded
     * @private
     */
    _loadService(serviceName) {
        // If already loaded, return it
        if (this.services.has(serviceName)) {
            return this.services.get(serviceName);
        }

        // If currently loading, wait for it
        if (this.loadingPromises.has(serviceName)) {
            // Note: This is synchronous for now, may need async handling
            console.warn(`Service ${serviceName} is still loading`);
            return null;
        }

        // Load the service
        const loader = this.serviceLoaders.get(serviceName);
        if (!loader) {
            console.error(`No loader registered for service ${serviceName}`);
            return null;
        }

        try {
            this.loadingPromises.set(serviceName, true);
            const service = loader();
            this.services.set(serviceName, service);
            this.loadingPromises.delete(serviceName);
            return service;
        } catch (error) {
            console.error(`Failed to load service ${serviceName}:`, error);
            this.loadingPromises.delete(serviceName);
            return null;
        }
    }

    /**
     * Check if a service is registered
     */
    isRegistered(serviceName) {
        return this.serviceLoaders.has(serviceName);
    }

    /**
     * Check if a service is loaded
     */
    isLoaded(serviceName) {
        return this.services.has(serviceName);
    }

    /**
     * Get list of all registered services
     */
    getRegisteredServices() {
        return Array.from(this.serviceLoaders.keys());
    }

    /**
     * Get list of all loaded services
     */
    getLoadedServices() {
        return Array.from(this.services.keys());
    }

    /**
     * Clear all services (for testing)
     */
    clear() {
        this.services.clear();
        this.serviceLoaders.clear();
        this.loadingPromises.clear();
    }
}

// Export singleton instance
module.exports = new ServiceProxyManager();