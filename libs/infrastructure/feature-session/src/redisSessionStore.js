/**
 * Redis Session Store for Zero-Downtime Migration
 * Enables session sharing between old and new systems during migration
 */

const redis = require('redis');
const crypto = require('crypto');

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class RedisSessionStore {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
    this.sessionPrefix = 'sess:';
    this.csrfPrefix = 'csrf:';
    this.defaultTTL = 1800; // 30 minutes
    this.serviceToken = null;
  }

  async initialize() {
    if (this.isConnected) {
      return true;
    }

    try {
      // Authenticate service
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('redis-session-store');

      // Get Redis configuration from KMS
      let redisConfig;
      try {
        const productionKMS = proxy.getService('productionKMS');
        const redisPassword = await productionKMS.getInternalKey('REDIS_PASSWORD');
        redisConfig = {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: redisPassword,
          db: 0, // Database 0 for sessions
          retryDelayOnFailover: 1000,
          maxRetriesPerRequest: 3,
          lazyConnect: true
        };
      } catch (kmsError) {
        console.log('⚠️ Redis password not found in KMS, using default config');
        redisConfig = {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          db: 0,
          retryDelayOnFailover: 1000,
          maxRetriesPerRequest: 3,
          lazyConnect: true
        };
      }

      // Create Redis client
      this.client = redis.createClient(redisConfig);

      // Set up error handling
      this.client.on('error', (error) => {
        console.error('❌ Redis Session Store error:', error);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('🔗 Redis Session Store connecting...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis Session Store ready');
        this.isConnected = true;
        this.connectionRetries = 0;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis Session Store reconnecting...');
      });

      this.client.on('end', () => {
        console.log('⚠️ Redis Session Store connection ended');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();
      
      console.log('✅ RedisSessionStore initialized with ServiceProxy');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Redis Session Store:', error);
      
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`🔄 Retrying Redis connection (${this.connectionRetries}/${this.maxRetries}) in ${this.retryDelay}ms...`);
        
        setTimeout(() => {
          this.initialize();
        }, this.retryDelay);
        
        return false;
      } else {
        throw new Error(`Redis Session Store failed to connect after ${this.maxRetries} attempts`);
      }
    }
  }

  getServiceContext(practiceId, operation = 'session-management') {
    return {
      serviceId: 'redis-session-store',
      operation: operation,
      practiceId: practiceId || 'global'
    };
  }

  async createSession(sessionId, sessionData, ttl = this.defaultTTL) {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      const key = `${this.sessionPrefix}${sessionId}`;
      const serializedData = JSON.stringify({
        ...sessionData,
        createdAt: new Date().toISOString(),
        lastAccess: new Date().toISOString()
      });

      await this.client.setEx(key, ttl, serializedData);
      
      console.log(`✅ Session created in Redis: ${sessionId.substring(0, 10)}...`);
      return true;

    } catch (error) {
      console.error('❌ Failed to create session in Redis:', error);
      throw error;
    }
  }

  async getSession(sessionId) {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      const key = `${this.sessionPrefix}${sessionId}`;
      const sessionData = await this.client.get(key);

      if (!sessionData) {
        return null;
      }

      const parsed = JSON.parse(sessionData);
      
      // Update last access time
      parsed.lastAccess = new Date().toISOString();
      await this.client.setEx(key, this.defaultTTL, JSON.stringify(parsed));

      return parsed;

    } catch (error) {
      console.error('❌ Failed to get session from Redis:', error);
      return null;
    }
  }

  async updateSession(sessionId, updates, ttl = this.defaultTTL) {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      const key = `${this.sessionPrefix}${sessionId}`;
      const currentData = await this.client.get(key);

      if (!currentData) {
        return false;
      }

      const parsed = JSON.parse(currentData);
      const updatedData = {
        ...parsed,
        ...updates,
        lastAccess: new Date().toISOString()
      };

      await this.client.setEx(key, ttl, JSON.stringify(updatedData));
      return true;

    } catch (error) {
      console.error('❌ Failed to update session in Redis:', error);
      return false;
    }
  }

  async extendSession(sessionId, ttl = this.defaultTTL) {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      const key = `${this.sessionPrefix}${sessionId}`;
      const exists = await this.client.exists(key);

      if (!exists) {
        return false;
      }

      const result = await this.client.expire(key, ttl);
      
      if (result) {
        // Update last access time
        const sessionData = await this.client.get(key);
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          parsed.lastAccess = new Date().toISOString();
          await this.client.setEx(key, ttl, JSON.stringify(parsed));
        }
      }

      return result === 1;

    } catch (error) {
      console.error('❌ Failed to extend session in Redis:', error);
      return false;
    }
  }

  async destroySession(sessionId) {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      const key = `${this.sessionPrefix}${sessionId}`;
      const result = await this.client.del(key);
      
      console.log(`🗑️ Session destroyed in Redis: ${sessionId.substring(0, 10)}...`);
      return result === 1;

    } catch (error) {
      console.error('❌ Failed to destroy session in Redis:', error);
      return false;
    }
  }

  async createCSRFToken(sessionId) {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      const csrfToken = crypto.randomBytes(32).toString('hex');
      const key = `${this.csrfPrefix}${csrfToken}`;
      
      await this.client.setEx(key, 3600, sessionId); // 1 hour TTL for CSRF tokens
      
      return csrfToken;

    } catch (error) {
      console.error('❌ Failed to create CSRF token in Redis:', error);
      throw error;
    }
  }

  async validateCSRFToken(csrfToken, sessionId) {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      const key = `${this.csrfPrefix}${csrfToken}`;
      const storedSessionId = await this.client.get(key);
      
      return storedSessionId === sessionId;

    } catch (error) {
      console.error('❌ Failed to validate CSRF token in Redis:', error);
      return false;
    }
  }

  async getActiveSessionsCount() {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      const keys = await this.client.keys(`${this.sessionPrefix}*`);
      return keys.length;

    } catch (error) {
      console.error('❌ Failed to get active sessions count:', error);
      return 0;
    }
  }

  async cleanup() {
    if (!this.isConnected) {
      return 0;
    }

    try {
      // Redis handles TTL automatically, but we can manually clean up if needed
      const sessionKeys = await this.client.keys(`${this.sessionPrefix}*`);
      const csrfKeys = await this.client.keys(`${this.csrfPrefix}*`);
      
      let cleanedCount = 0;

      // Check for expired sessions (optional cleanup)
      for (const key of sessionKeys) {
        const ttl = await this.client.ttl(key);
        if (ttl === -1) { // No expiration set
          await this.client.expire(key, this.defaultTTL);
        }
      }

      // Clean up orphaned CSRF tokens
      for (const csrfKey of csrfKeys) {
        const sessionId = await this.client.get(csrfKey);
        if (sessionId) {
          const sessionKey = `${this.sessionPrefix}${sessionId}`;
          const sessionExists = await this.client.exists(sessionKey);
          
          if (!sessionExists) {
            await this.client.del(csrfKey);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} orphaned CSRF tokens`);
      }

      return cleanedCount;

    } catch (error) {
      console.error('❌ Failed to cleanup Redis sessions:', error);
      return 0;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { healthy: false, message: 'Not connected to Redis' };
      }

      const testKey = 'health_check';
      await this.client.setEx(testKey, 10, 'test');
      const result = await this.client.get(testKey);
      await this.client.del(testKey);

      return {
        healthy: result === 'test',
        message: result === 'test' ? 'Redis session store healthy' : 'Redis test failed',
        activeConnections: this.isConnected ? 1 : 0
      };

    } catch (error) {
      return {
        healthy: false,
        message: `Redis health check failed: ${error.message}`
      };
    }
  }

  async close() {
    if (this.client) {
      try {
        await this.client.quit();
        this.isConnected = false;
        console.log('✅ Redis Session Store closed gracefully');
      } catch (error) {
        console.error('❌ Error closing Redis Session Store:', error);
        if (this.client.isOpen) {
          this.client.disconnect();
        }
      }
    }
  }
}

// Export singleton instance
const redisSessionStoreInstance = new RedisSessionStore();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('redisSessionStore', () => redisSessionStoreInstance);
}

module.exports = redisSessionStoreInstance;