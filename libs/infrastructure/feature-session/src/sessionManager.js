const redis = require('redis');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class SessionManager {
    constructor() {
        this.redisClient = null;
        this.redisStore = null;
        this.initialized = false;
        this.fallbackStore = new Map(); // In-memory fallback
        this.serviceToken = null;
        this.metrics = {
            activeSessions: 0,
            creationRate: 0,
            expiryRate: 0,
            errors: 0
        };
    }

    async initialize() {
        try {
            // Authenticate service
            const proxy = getServiceProxy();
            const serviceAccountManager = proxy.getService('serviceAccountManager');
            this.serviceToken = await serviceAccountManager.authenticate('sessionManager');

            // Get Redis configuration from KMS
            const redisConfig = await this._getRedisConfig();

            // Create Redis client
            this.redisClient = redis.createClient({
                host: redisConfig.host || 'localhost',
                port: redisConfig.port || 6379,
                password: redisConfig.password,
                db: redisConfig.database || 0,
                retry_strategy: this._retryStrategy
            });

            // Set up Redis event handlers
            this.redisClient.on('error', this._handleRedisError.bind(this));
            this.redisClient.on('connect', this._handleRedisConnect.bind(this));
            this.redisClient.on('ready', this._handleRedisReady.bind(this));

            // Create Redis store for sessions
            this.redisStore = new RedisStore({
                client: this.redisClient,
                prefix: 'sess:',
                ttl: 24 * 60 * 60, // 24 hours
                serializer: JSON,
                disableTouch: false,
                disableTTL: false
            });

            this.initialized = true;
            console.log('✅ SessionManager initialized with ServiceProxy');
            
            // Start session monitoring
            this._startSessionMonitoring();
            
            return this.redisStore;
        } catch (error) {
            console.error('[SessionManager] Failed to initialize:', error);
            console.log('[SessionManager] Falling back to memory store');
            return this._getFallbackStore();
        }
    }

    /**
     * Get service context for database operations
     */
    getServiceContext(practiceId = 'global') {
        return {
            serviceId: 'sessionManager',
            operation: 'database-access',
            practiceId: practiceId
        };
    }

    async _getRedisConfig() {
        try {
            // Try to get Redis configuration from KMS
            const proxy = getServiceProxy();
            const productionKMS = proxy.getService('productionKMS');
            const redisPassword = await productionKMS.getInternalKey('REDIS_PASSWORD');
            return {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: redisPassword,
                database: parseInt(process.env.REDIS_DB) || 0
            };
        } catch (error) {
            console.warn('[SessionManager] Redis config not in KMS, using defaults');
            return {
                host: 'localhost',
                port: 6379,
                database: 0
            };
        }
    }

    _retryStrategy(options) {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
            return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
    }

    _handleRedisError(error) {
        console.error('[SessionManager] Redis error:', error);
        this.metrics.errors++;
    }

    _handleRedisConnect() {
        console.log('[SessionManager] Connected to Redis');
    }

    _handleRedisReady() {
        console.log('[SessionManager] Redis ready for operations');
    }

    _getFallbackStore() {
        console.log('[SessionManager] Using fallback memory store');
        return session.MemoryStore();
    }

    getSessionStore() {
        if (this.initialized && this.redisStore) {
            return this.redisStore;
        }
        return this._getFallbackStore();
    }

    async getSession(sessionId) {
        try {
            if (this.redisClient && this.redisClient.connected) {
                return new Promise((resolve, reject) => {
                    this.redisStore.get(sessionId, (err, session) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(session);
                        }
                    });
                });
            } else {
                return this.fallbackStore.get(sessionId);
            }
        } catch (error) {
            console.error('[SessionManager] Error getting session:', error);
            return null;
        }
    }

    async setSession(sessionId, sessionData) {
        try {
            if (this.redisClient && this.redisClient.connected) {
                return new Promise((resolve, reject) => {
                    this.redisStore.set(sessionId, sessionData, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            } else {
                this.fallbackStore.set(sessionId, sessionData);
            }
        } catch (error) {
            console.error('[SessionManager] Error setting session:', error);
            throw error;
        }
    }

    async destroySession(sessionId) {
        try {
            if (this.redisClient && this.redisClient.connected) {
                return new Promise((resolve, reject) => {
                    this.redisStore.destroy(sessionId, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            } else {
                this.fallbackStore.delete(sessionId);
            }
        } catch (error) {
            console.error('[SessionManager] Error destroying session:', error);
            throw error;
        }
    }

    async migrateSession(sessionId, oldFormat, newFormat) {
        try {
            const session = await this.getSession(sessionId);
            if (session) {
                // Convert session format if needed
                const migratedSession = this._convertSessionFormat(session, oldFormat, newFormat);
                await this.setSession(sessionId, migratedSession);
                return migratedSession;
            }
            return null;
        } catch (error) {
            console.error('[SessionManager] Error migrating session:', error);
            return null;
        }
    }

    _convertSessionFormat(session, oldFormat, newFormat) {
        // Session format conversion logic
        if (oldFormat === newFormat) {
            return session;
        }
        
        // Add conversion logic as needed
        return session;
    }

    _startSessionMonitoring() {
        // Monitor session metrics every 30 seconds
        setInterval(async () => {
            try {
                if (this.redisClient && this.redisClient.connected) {
                    const keys = await this.redisClient.keys('sess:*');
                    this.metrics.activeSessions = keys.length;
                }
            } catch (error) {
                console.error('[SessionManager] Error monitoring sessions:', error);
            }
        }, 30000);
    }

    getSessionMetrics() {
        return {
            ...this.metrics,
            redisConnected: this.redisClient && this.redisClient.connected,
            initialized: this.initialized
        };
    }

    async validateSession(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            return session !== null && session !== undefined;
        } catch (error) {
            console.error('[SessionManager] Error validating session:', error);
            return false;
        }
    }

    async getAllActiveSessions() {
        try {
            if (this.redisClient && this.redisClient.connected) {
                const keys = await this.redisClient.keys('sess:*');
                const sessions = [];
                for (const key of keys) {
                    const sessionId = key.replace('sess:', '');
                    const session = await this.getSession(sessionId);
                    if (session) {
                        sessions.push({ sessionId, session });
                    }
                }
                return sessions;
            } else {
                return Array.from(this.fallbackStore.entries()).map(([sessionId, session]) => ({
                    sessionId,
                    session
                }));
            }
        } catch (error) {
            console.error('[SessionManager] Error getting all sessions:', error);
            return [];
        }
    }

    async cleanup() {
        try {
            if (this.redisClient) {
                await this.redisClient.quit();
            }
            this.fallbackStore.clear();
            this.initialized = false;
            console.log('[SessionManager] Cleanup completed');
        } catch (error) {
            console.error('[SessionManager] Error during cleanup:', error);
        }
    }
}

// Export singleton instance
const sessionManagerInstance = new SessionManager();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('sessionManager', () => sessionManagerInstance);
}

module.exports = sessionManagerInstance;