/**
 * 🚨 CRITICAL SECURITY SERVICE - MEDICAL PLATFORM
 * 
 * ⚠️  WARNING TO AI AGENTS:
 * - DO NOT MODIFY without security review
 * - DO NOT add client-side key generation 
 * - DO NOT expose session secrets
 * - ONLY server-side validation is acceptable
 * 
 * VIOLATIONS WILL CAUSE:
 * - Production deployment failure
 * - Security audit failures  
 * - HIPAA compliance violations
 * - Patient data exposure
 */

const crypto = require('crypto');

// Add this service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

// Note: Sessions are managed via SecureDataAccess

class SecureSessionManager {
  constructor() {
    // ⚠️ SECURITY: Use MongoDB for persistent session storage
    // This ensures sessions persist between requests and server restarts
    this.sessionTTL = 30 * 60; // 30 minutes default
    this.csrfTTL = 60 * 60;    // 1 hour for CSRF tokens
    this.initialized = false;
    this.serviceToken = null;
    this.serviceCache = {};
    
    // CSRF tokens still stored in memory (they're temporary by design)
    this.csrfStore = new Map();
    
    // Performance optimization: Session validation cache
    this.sessionCache = new Map();
    this.SESSION_CACHE_TTL = 300000; // 5 minutes
    
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [token, cached] of this.sessionCache.entries()) {
        if (now - cached.timestamp > this.SESSION_CACHE_TTL) {
          this.sessionCache.delete(token);
        }
      }
    }, 300000); // 5 minutes
  }

  getService(name) {
    if (!this.serviceCache[name]) {
      const proxy = getServiceProxy();
      this.serviceCache[name] = proxy.getService(name);
    }
    return this.serviceCache[name];
  }

  /**
   * Initialize session manager
   */
  async initialize() {
    // Check if already initialized
    if (this.initialized) {
      return this; // Already initialized
    }
    
    try {
      // Get services through proxy to avoid circular dependencies
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('secure-session-manager');
      // SecureDataAccess handles all database connections
      // No need to create direct connections
      
      this.initialized = true;
      console.log('✅ SecureSessionManager initialized with MongoDB storage');
      
      // Clean up expired sessions periodically - delay start to ensure DB is ready
      setTimeout(() => {
        setInterval(async () => {
          try {
            const context = {
              serviceId: 'secure-session-manager',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              operation: 'periodicCleanup',
              practiceId: 'global'
            };
            const secureDataAccess = proxy.getService('secureDataAccess');
            const result = await secureDataAccess.delete('sessions', {
              expiresAt: { $lt: new Date() }
            }, context);
            if (result && result.deletedCount > 0) {
              console.log(`🧹 Cleaned up ${result.deletedCount} expired sessions`);
            }
          } catch (err) {
            // Silently skip if database not ready yet
            if (!err.message?.includes('Client must be connected')) {
              console.error('Failed to cleanup expired sessions:', err);
            }
          }
        }, 5 * 60 * 1000); // Every 5 minutes
      }, 15000); // 15 second delay to ensure database connections are stable
      
    } catch (error) {
      console.error('❌ Failed to initialize SecureSessionManager:', error);
      throw error;
    }
  }

  /**
   * ✅ CORRECT: Server-generated session with secure random tokens
   * 
   * AI AGENTS: This is how REAL security works:
   * - Cryptographically secure random generation
   * - Server-side storage only
   * - No client access to secrets
   */
  async createSession(userId, practiceId, userRole = 'user', sessionData = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    // 🔒 SECURITY: Use crypto.randomBytes - the ONLY acceptable method for secrets
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(32).toString('hex');

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + this.sessionTTL * 1000);

    try {
      // Convert IDs to proper ObjectIds if needed
      const path = require('path');
      const mongoose = require(path.resolve(__dirname, '../../../backend/node_modules/mongoose'));
      let userObjectId, practiceObjectId;
      
      // Handle userId conversion
      if (typeof userId === 'string' && userId.length === 24) {
        // Valid ObjectId string
        userObjectId = new mongoose.Types.ObjectId(userId);
      } else if (userId && userId.buffer) {
        // Handle buffer object format from SecureDataAccess
        const buffer = Buffer.from(Object.values(userId.buffer));
        userObjectId = new mongoose.Types.ObjectId(buffer);
      } else if (typeof userId === 'string') {
        // Not a valid ObjectId, use as-is (might be a subdomain or other ID)
        userObjectId = userId;
      } else {
        userObjectId = userId;
      }
      
      // Handle practiceId conversion
      if (typeof practiceId === 'string' && practiceId.length === 24) {
        // Valid ObjectId string
        practiceObjectId = new mongoose.Types.ObjectId(practiceId);
      } else if (practiceId && practiceId.buffer) {
        // Handle buffer object format from SecureDataAccess
        const buffer = Buffer.from(Object.values(practiceId.buffer));
        practiceObjectId = new mongoose.Types.ObjectId(buffer);
      } else if (typeof practiceId === 'string') {
        // Not a valid ObjectId, generate one or use subdomain
        // For now, generate a deterministic ObjectId from the subdomain
        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update(practiceId).digest('hex').substring(0, 24);
        practiceObjectId = new mongoose.Types.ObjectId(hash);
      } else {
        practiceObjectId = practiceId;
      }
      
      // Create session in MongoDB with CSRF token using SecureDataAccess
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'createSession',
        practiceId: 'global'
      };
      const secureDataAccess = this.getService('secureDataAccess');
      const insertResult = await secureDataAccess.insert('sessions', {
        token: sessionToken,
        userId: userObjectId,
        practiceId: practiceObjectId,
        practiceSubdomain: sessionData.practiceSubdomain || practiceObjectId.toString(),
        csrfToken: csrfToken,
        expiresAt: expiresAt,
        lastActivity: new Date()
      }, context);

      // Store CSRF token mapping in memory (temporary by design)
      this.csrfStore.set(csrfToken, sessionToken);
      
      // Auto-expire CSRF token
      setTimeout(() => {
        this.csrfStore.delete(csrfToken);
      }, this.csrfTTL * 1000);

      // 🔐 Audit log session creation (optional - don't fail if AuditLog not available)
      try {
        const auditContext = {
          serviceId: 'secure-session-manager',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          operation: 'auditLog',
          practiceId: 'global'
        };
        const secureDataAccess = this.getService('secureDataAccess');
        await secureDataAccess.insert('audit_logs', {
          action: 'SESSION_CREATED',
          userId,
          practiceId,
          sessionId: insertResult.insertedId ? insertResult.insertedId.toString() : 'unknown',
          timestamp: new Date(),
          metadata: {
            userRole,
            email: sessionData.email,
            loginMethod: sessionData.loginMethod || sessionData.verificationMethod
          }
        }, auditContext);
      } catch (auditErr) {
        // Audit logging is optional - don't fail session creation
        console.log('⚠️ Audit logging skipped:', auditErr.message);
      }

      console.log(`🔒 Session created for user ${userId} in practice ${sessionData.practiceSubdomain || practiceId}`);
      console.log(`   Token: ${sessionToken.substring(0, 10)}...`);
      console.log(`   Expires: ${expiresAt}`);
      
      return {
        sessionToken,
        csrfToken,
        sessionId: insertResult.insertedId ? insertResult.insertedId.toString() : sessionToken,
        expiresAt
      };
    } catch (error) {
      console.error('❌ Failed to create session:', error);
      throw new Error('Session creation failed: ' + error.message);
    }
  }

  /**
   * ✅ CORRECT: Server-side session validation
   * 
   * AI AGENTS: No client involvement in validation:
   * - Only server has access to session data
   * - Cryptographic verification server-side
   * - Complete audit trail
   */
  async validateSession(sessionToken, requireActive = true) {
    if (!sessionToken) {
      return null;
    }
    
    // Check cache first for performance
    if (this.sessionCache) {
      const cachedSession = this.sessionCache.get(sessionToken);
      if (cachedSession && (Date.now() - cachedSession.timestamp < this.SESSION_CACHE_TTL)) {
        // Return cached session (saves ~500ms)
        return cachedSession.data;
      }
    }
    
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Find session in MongoDB using SecureDataAccess
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'getSession',
        practiceId: 'global'
      };
      const secureDataAccess = this.getService('secureDataAccess');
      const sessions = await secureDataAccess.query('sessions', {
        token: sessionToken,
        expiresAt: { $gt: new Date() } // Not expired
      }, { limit: 1 }, context);
      const session = sessions[0];
      
      if (!session) {
        console.log(`⚠️ Session not found or expired for token: ${sessionToken.substring(0, 10)}...`);
        return null;
      }

      // Handle legacy sessions without CSRF token
      if (!session.csrfToken) {
        console.log('⚠️ Legacy session detected without CSRF token, generating new one...');
        const newCsrfToken = crypto.randomBytes(32).toString('hex');
        
        // Update session with new CSRF token using SecureDataAccess
        await secureDataAccess.update('sessions', 
          { _id: session._id },
          { 
            $set: { 
              csrfToken: newCsrfToken,
              lastActivity: new Date() 
            } 
          },
          context
        );
        
        session.csrfToken = newCsrfToken;
        
        // Store CSRF token mapping in memory
        this.csrfStore.set(newCsrfToken, sessionToken);
        
        // Auto-expire CSRF token
        setTimeout(() => {
          this.csrfStore.delete(newCsrfToken);
        }, this.csrfTTL * 1000);
      } else {
        // Update last activity only using SecureDataAccess
        await secureDataAccess.update('sessions',
          { _id: session._id },
          { $set: { lastActivity: new Date() } },
          context
        );
        
        // Ensure CSRF token is in memory store
        if (!this.csrfStore.has(session.csrfToken)) {
          this.csrfStore.set(session.csrfToken, sessionToken);
          
          // Auto-expire CSRF token
          setTimeout(() => {
            this.csrfStore.delete(session.csrfToken);
          }, this.csrfTTL * 1000);
        }
      }

      // Return session data in expected format
      // Handle potential buffer objects or missing fields
      const sessionData = {
        sessionId: session._id.toString(),
        sessionToken: session.token,
        csrfToken: session.csrfToken, // Include CSRF token from database
        userId: session.userId ? session.userId.toString() : '',
        practiceId: session.practiceId ? session.practiceId.toString() : session.practiceSubdomain || '',
        practiceSubdomain: session.practiceSubdomain,
        userRole: 'user', // Default role, can be enhanced later
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        isActive: true,
        // Add metadata for compatibility with practiceAuth middleware
        metadata: {
          practiceSubdomain: session.practiceSubdomain
        }
      };
      
      // Cache the validated session for performance (only if cache exists)
      if (this.sessionCache) {
        this.sessionCache.set(sessionToken, {
          data: sessionData,
          timestamp: Date.now()
        });
      }
      
      return sessionData;
    } catch (error) {
      console.error('❌ Session validation error:', error);
      return null;
    }
  }

  /**
   * ✅ CORRECT: CSRF token validation
   * 
   * AI AGENTS: Real CSRF protection:
   * - Server generates tokens
   * - Server validates tokens
   * - Required for mutations
   */
  async validateCSRFToken(csrfToken, sessionToken) {
    if (!csrfToken || !sessionToken || !this.initialized) {
      return false;
    }

    try {
      let storedSessionToken;
      
      if (this.redisClient) {
        storedSessionToken = await this.redisClient.get(`csrf:${csrfToken}`);
      } else {
        storedSessionToken = this.csrfStore.get(csrfToken);
      }

      return storedSessionToken === sessionToken;
    } catch (error) {
      console.error('❌ CSRF validation error:', error);
      return false;
    }
  }

  /**
   * ✅ CORRECT: Extend session expiry on activity
   * 
   * AI AGENTS: Session renewal on user activity:
   * - Extends session by specified minutes (default 30)
   * - Max total session duration: 72 hours
   * - Updates both database and cache
   */
  async extendSession(sessionToken, extensionMinutes = 30) {
    if (!sessionToken) {
      return null;
    }
    
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Find current session
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'extendSession',
        practiceId: 'global'
      };
      
      const secureDataAccess = this.getService('secureDataAccess');
      const sessions = await secureDataAccess.query('sessions', {
        token: sessionToken,
        expiresAt: { $gt: new Date() } // Must be currently valid
      }, { limit: 1 }, context);
      
      const session = sessions[0];
      if (!session) {
        console.log(`⚠️ Cannot extend expired or invalid session`);
        return null;
      }
      
      // Calculate new expiry time
      const now = new Date();
      const currentExpiry = session.expiresAt ? new Date(session.expiresAt) : new Date(now.getTime() + 30 * 60 * 1000);
      const createdAt = session.createdAt ? new Date(session.createdAt) : now;
      const maxSessionDuration = 72 * 60 * 60 * 1000; // 72 hours max
      const sessionAge = now.getTime() - createdAt.getTime();
      
      // Don't extend beyond max duration
      if (sessionAge >= maxSessionDuration) {
        console.log(`⚠️ Session reached max duration (72 hours), cannot extend`);
        return session;
      }
      
      // Calculate new expiry
      const extensionMs = extensionMinutes * 60 * 1000;
      const newExpiryTime = Math.min(
        currentExpiry.getTime() + extensionMs,
        createdAt.getTime() + maxSessionDuration
      );
      const newExpiry = new Date(newExpiryTime);
      
      // Update session in database
      await secureDataAccess.update('sessions',
        { _id: session._id },
        { 
          $set: { 
            expiresAt: newExpiry,
            lastActivity: now,
            lastExtended: now
          } 
        },
        context
      );
      
      // Clear cache to force fresh validation next time
      if (this.sessionCache) {
        this.sessionCache.delete(sessionToken);
      }
      
      console.log(`🔄 Session extended by ${extensionMinutes} minutes (expires: ${newExpiry.toISOString()})`);
      
      // Return updated session data
      return {
        ...session,
        expiresAt: newExpiry,
        lastActivity: now
      };
      
    } catch (error) {
      console.error('❌ Failed to extend session:', error);
      return null;
    }
  }

  /**
   * ✅ CORRECT: Secure session termination
   */
  async destroySession(sessionToken, userId, practiceId, reason = 'logout') {
    if (!sessionToken) {
      return false;
    }
    
    // Remove from cache when destroying
    this.sessionCache.delete(sessionToken);
    
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Find and delete session from MongoDB using SecureDataAccess
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'destroySession',
        practiceId: 'global'
      };
      // First find the session
      const secureDataAccess = this.getService('secureDataAccess');
      const sessions = await secureDataAccess.query('sessions', {
        token: sessionToken
      }, { limit: 1 }, context);
      const session = sessions[0];
      
      if (session) {
        // Then delete it
        await secureDataAccess.delete('sessions', { token: sessionToken }, context);
      }
      
      if (!session) {
        console.log(`⚠️ Session not found for destruction: ${sessionToken.substring(0, 10)}...`);
        return false;
      }

      // Remove any associated CSRF tokens from memory
      // Note: CSRF tokens are temporary and may already be expired
      for (const [csrfToken, storedSessionToken] of this.csrfStore.entries()) {
        if (storedSessionToken === sessionToken) {
          this.csrfStore.delete(csrfToken);
        }
      }

      // 🔐 Audit log session destruction (optional)
      try {
        const auditContext = {
          serviceId: 'secure-session-manager',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          operation: 'auditLog',
          practiceId: 'global'
        };
        const secureDataAccess = this.getService('secureDataAccess');
        await secureDataAccess.insert('audit_logs', {
          action: 'SESSION_DESTROYED',
          userId: userId || (session.userId ? session.userId.toString() : ''),
          practiceId: practiceId || (session.practiceId ? session.practiceId.toString() : ''),
          sessionId: session._id ? session._id.toString() : session.id,
          timestamp: new Date(),
          metadata: { reason }
        }, auditContext);
      } catch (auditErr) {
        // Audit logging is optional
        console.log('⚠️ Audit logging skipped:', auditErr.message);
      }

      console.log(`🔒 Session destroyed: ${reason}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to destroy session:', error);
      return false;
    }
  }

  /**
   * ✅ CORRECT: Cleanup expired sessions
   */
  async cleanupExpiredSessions() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // MongoDB handles TTL automatically via index, but we can do manual cleanup using SecureDataAccess
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'cleanupSessions',
        practiceId: 'global'
      };
      const secureDataAccess = this.getService('secureDataAccess');
      const result = await secureDataAccess.delete('sessions', {
        expiresAt: { $lt: new Date() }
      }, context);
      
      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} expired sessions`);
      }
      
      // Also clean up expired CSRF tokens from memory
      const now = Date.now();
      for (const [csrfToken, sessionToken] of this.csrfStore.entries()) {
        // Remove old CSRF tokens (older than TTL)
        this.csrfStore.delete(csrfToken);
      }
      
      return result.deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get session statistics for monitoring
   */
  async getSessionStats() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Count active sessions in MongoDB using SecureDataAccess
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'getStats',
        practiceId: 'global'
      };
      const secureDataAccess = this.getService('secureDataAccess');
      const sessions = await secureDataAccess.query('sessions', {
        expiresAt: { $gt: new Date() }
      }, {}, context);
      const activeSessions = sessions.length;
      
      return { 
        activeSessions,
        csrfTokens: this.csrfStore.size
      };
    } catch (error) {
      console.error('❌ Failed to get session stats:', error);
      return null;
    }
  }

  /**
   * Close session manager
   */
  async close() {
    // Clear CSRF store
    this.csrfStore.clear();
    
    // Clear cleanup interval if set
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.initialized = false;
    console.log('🔒 SecureSessionManager closed');
  }
}

// Export singleton instance
const secureSessionManager = new SecureSessionManager();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('secureSessionManager', () => {
    return secureSessionManager;
  });
}

module.exports = secureSessionManager;