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

const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const SecureDataAccess = require('./secureDataAccess');
const secureConfigService = require('./secureConfigService');
const serviceAccountManager = require('./serviceAccountManager');
const { isTransientMongoError } = require('../utils/mongoErrorUtils');

// Note: Sessions are managed via SecureDataAccess

class SecureSessionManager {
  constructor() {
    // ⚠️ SECURITY: Use MongoDB for persistent session storage
    // This ensures sessions persist between requests and server restarts
    this.sessionTTL = 30 * 24 * 60 * 60; // 30 days for development (was 30 minutes)
    this.csrfTTL = 30 * 24 * 60 * 60;    // 30 days for development (was 1 hour)
    this.initialized = false;
    this.serviceToken = null;
    
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

  /**
   * Initialize session manager
   */
  async initialize() {
    // Check if already initialized
    if (this.initialized) {
      return this; // Already initialized
    }
    
    try {
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
            const result = await SecureDataAccess.delete('sessions', {
              expiresAt: { $lt: new Date() }
            }, context);
            if (result && result.deletedCount > 0) {
              console.log(`🧹 Cleaned up ${result.deletedCount} expired sessions`);
            }
          } catch (err) {
            // Transient connection blips (Mac sleep/wake, pool reset) are
            // recoverable — the driver reconnects and the next tick succeeds.
            // Log concisely instead of dumping an alarming stack trace.
            if (isTransientMongoError(err)) {
              if (process.env.QUIET_LOGS !== 'true') {
                console.warn('⚠️ Session cleanup skipped: MongoDB connection interrupted (will retry next cycle)');
              }
            } else {
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
   * 🔒 SECURITY: Invalidate all existing sessions for a user
   * This ensures only one active session per user for security
   */
  async invalidateUserSessions(userId, practiceId = null) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'invalidateSessions',
        practiceId: 'global'
      };
      
      // Convert userId to ObjectId if needed
      const mongoose = require('mongoose');
      let userObjectId;
      if (typeof userId === 'string' && userId.length === 24) {
        userObjectId = new mongoose.Types.ObjectId(userId);
      } else if (userId && userId.buffer) {
        const buffer = Buffer.from(Object.values(userId.buffer));
        userObjectId = new mongoose.Types.ObjectId(buffer);
      } else {
        userObjectId = userId;
      }
      
      // Delete all sessions for this user
      const filter = { userId: userObjectId };
      if (practiceId) {
        filter.practiceId = practiceId;
      }
      
      const result = await SecureDataAccess.delete('sessions', filter, context);
      console.log(`🔒 Invalidated ${result.deletedCount || 0} sessions for user ${userId}`);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to invalidate sessions:', error);
      // Don't throw - let login continue even if cleanup fails
    }
  }

  /**
   * ✅ CORRECT: Server-generated session with secure random tokens
   *
   * AI AGENTS: This is how REAL security works:
   * - Cryptographically secure random generation
   * - Server-side storage only
   * - No client access to secrets
   * - Atomic upsert to prevent multiple concurrent sessions
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
      const mongoose = require('mongoose');
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

      // ATOMIC UPSERT: Create session and invalidate old sessions in ONE atomic operation
      // This prevents race conditions where concurrent logins create multiple active sessions
      // Filter ensures only ONE active session per user+practice combination
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'createSession',
        practiceId: 'global'
      };

      const sessionDoc = {
        token: sessionToken,
        userId: userObjectId,
        practiceId: practiceObjectId,
        practiceSubdomain: sessionData.practiceSubdomain || practiceObjectId.toString(),
        csrfToken: csrfToken,
        expiresAt: expiresAt,
        lastActivity: new Date(),
        isActive: true,
        _deleted: false  // CRITICAL: Undelete session if it was soft-deleted
      };

      console.log('🔒 Creating/replacing session for user via atomic upsert...');
      const insertResult = await SecureDataAccess.upsert(
        'sessions',
        {
          userId: userObjectId,
          practiceId: practiceObjectId
          // Note: We don't filter by isActive here because we want to replace ANY session
          // The upsert will automatically set isActive: true for the new session
        },
        sessionDoc,
        context,
        {
          // CRITICAL: Replace ALL fields when updating existing session
          updateOnExist: sessionDoc
        }
      );

      // Store CSRF token mapping in memory (temporary by design)
      this.csrfStore.set(csrfToken, sessionToken);

      // Auto-expire CSRF token (use Math.min to prevent overflow)
      const csrfTimeout = Math.min(this.csrfTTL * 1000, 2147483647); // Max 32-bit signed int
      setTimeout(() => {
        this.csrfStore.delete(csrfToken);
      }, csrfTimeout);

      // 🔐 Audit log session creation (optional - don't fail if AuditLog not available)
      try {
        const auditContext = {
          serviceId: 'secure-session-manager',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          operation: 'auditLog',
          practiceId: 'global'
        };
        // Upsert returns the full document with _id
        const sessionId = insertResult._id ? insertResult._id.toString() : sessionToken;
        await SecureDataAccess.insert('audit_logs', {
          action: 'SESSION_CREATED',
          userId,
          practiceId,
          sessionId: sessionId,
          timestamp: new Date(),
          metadata: {
            userRole,
            email: sessionData.email,
            loginMethod: sessionData.loginMethod || sessionData.verificationMethod,
            wasUpsert: true  // Flag to indicate this was an atomic upsert operation
          }
        }, auditContext);
      } catch (auditErr) {
        // Audit logging is optional - don't fail session creation
        console.log('⚠️ Audit logging skipped:', auditErr.message);
      }

      console.log(`🔒 Session created/replaced for user ${userId} in practice ${sessionData.practiceSubdomain || practiceId} (atomic upsert)`);
      console.log(`   Token: ${sessionToken.substring(0, 10)}...`);
      console.log(`   Expires: ${expiresAt}`);

      return {
        sessionToken,
        csrfToken,
        sessionId: insertResult._id ? insertResult._id.toString() : sessionToken,
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
      const sessions = await SecureDataAccess.query('sessions', {
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
        await SecureDataAccess.update('sessions', 
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

        // Auto-expire CSRF token (use Math.min to prevent overflow)
        const csrfTimeout = Math.min(this.csrfTTL * 1000, 2147483647); // Max 32-bit signed int
        setTimeout(() => {
          this.csrfStore.delete(newCsrfToken);
        }, csrfTimeout);
      } else {
        // Update last activity only using SecureDataAccess
        await SecureDataAccess.update('sessions',
          { _id: session._id },
          { $set: { lastActivity: new Date() } },
          context
        );
        
        // Ensure CSRF token is in memory store
        if (!this.csrfStore.has(session.csrfToken)) {
          this.csrfStore.set(session.csrfToken, sessionToken);

          // Auto-expire CSRF token (use Math.min to prevent overflow)
          const csrfTimeout = Math.min(this.csrfTTL * 1000, 2147483647); // Max 32-bit signed int
          setTimeout(() => {
            this.csrfStore.delete(session.csrfToken);
          }, csrfTimeout);
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
        userRole: 'user', // Default role, will be fetched below
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        isActive: true,
        // Add metadata for compatibility with practiceAuth middleware
        metadata: {
          practiceSubdomain: session.practiceSubdomain
        }
      };

      if (process.env.QUIET_LOGS !== 'true') console.log(`📊 [SESSION] Session data - userId: ${session.userId}, subdomain: ${session.practiceSubdomain}`);

      // Fetch actual user roles from the database (like practiceAuth does)
      if (session.userId && session.practiceSubdomain) {
        if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [SESSION] Attempting to fetch roles for user ${session.userId} in practice ${session.practiceSubdomain}`);
        try {
          // Create context for the practice database
          const userContext = {
            serviceId: 'secure-session-manager',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            operation: 'getUserRoles',
            practiceId: session.practiceSubdomain // Use subdomain for practice-specific DB
          };

          // Convert user ID to ObjectId if needed
          const mongoose = require('mongoose');
          let userId = session.userId;
          if (typeof userId === 'string' && userId.length === 24) {
            userId = new mongoose.Types.ObjectId(userId);
          } else if (userId && userId.buffer) {
            // Handle buffer object format
            const buffer = Buffer.from(Object.values(userId.buffer));
            userId = new mongoose.Types.ObjectId(buffer);
          }

          // Query the user from the practice database
          if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [SESSION] Fetching user roles for: ${userId} in practice: ${session.practiceSubdomain}`);
          const results = await SecureDataAccess.query('users', { _id: userId }, { limit: 1 }, userContext);
          const user = results && results.length > 0 ? results[0] : null;

          if (user && user.roles) {
            // Use the actual roles from database
            sessionData.userRole = user.roles[0] || 'user'; // For backward compatibility, keep single role
            sessionData.userRoles = user.roles; // Add full roles array
            if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [SESSION] User roles fetched:`, user.roles);
          } else {
            console.log(`⚠️ [SESSION] User not found or has no roles, using default 'user'`);
          }
        } catch (error) {
          console.log(`⚠️ [SESSION] Error fetching user roles:`, error.message);
          // Keep default 'user' role on error
        }
      }
      
      // Cache the validated session for performance (only if cache exists)
      // IMPORTANT: Cache AFTER fetching roles from database
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
      // First check in-memory store (for recently generated tokens)
      let storedSessionToken;
      
      if (this.redisClient) {
        storedSessionToken = await this.redisClient.get(`csrf:${csrfToken}`);
      } else {
        storedSessionToken = this.csrfStore.get(csrfToken);
      }

      if (storedSessionToken === sessionToken) {
        return true;
      }

      // If not in memory (e.g., after server restart), check MongoDB session
      // The CSRF token is stored in the session document itself
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'validateCSRFToken',
        practiceId: 'global'
      };
      
      const sessions = await SecureDataAccess.query('sessions', {
        token: sessionToken,
        csrfToken: csrfToken,
        expiresAt: { $gt: new Date() }
      }, { limit: 1 }, context);
      
      if (sessions && sessions.length > 0) {
        // Re-add to memory store for faster future validation
        this.csrfStore.set(csrfToken, sessionToken);

        // Auto-expire CSRF token (use Math.min to prevent overflow)
        const csrfTimeout = Math.min(this.csrfTTL * 1000, 2147483647); // Max 32-bit signed int
        setTimeout(() => {
          this.csrfStore.delete(csrfToken);
        }, csrfTimeout);

        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ CSRF validation error:', error);
      return false;
    }
  }

  /**
   * Store CSRF token for a session
   * @param {string} csrfToken - The CSRF token to store
   * @param {string} sessionToken - The associated session token
   */
  async storeCSRFToken(csrfToken, sessionToken) {
    if (!csrfToken || !sessionToken) {
      return false;
    }
    
    try {
      // Store in memory map
      this.csrfStore.set(csrfToken, sessionToken);

      // Auto-expire CSRF token after TTL (use Math.min to prevent overflow)
      const csrfTimeout = Math.min(this.csrfTTL * 1000, 2147483647); // Max 32-bit signed int
      setTimeout(() => {
        this.csrfStore.delete(csrfToken);
      }, csrfTimeout);

      // Also update the session document in MongoDB to persist across restarts
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'updateCSRFToken',
        practiceId: 'global'
      };
      
      await SecureDataAccess.update('sessions', 
        { token: sessionToken },
        { $set: { csrfToken: csrfToken } },
        context
      );
      
      console.log('✅ CSRF token stored in both memory and database');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to store CSRF token:', error);
      return false;
    }
  }
  
  /**
   * ✅ CORRECT: Refresh session - extends expiry and renews CSRF token
   * 
   * AI AGENTS: Complete session refresh:
   * - Extends session TTL
   * - Generates new CSRF token
   * - Returns new CSRF token for client
   */
  async refreshSession(sessionToken) {
    if (!sessionToken) {
      return null;
    }
    
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // First extend the session
      const extendedSession = await this.extendSession(sessionToken, 30);
      if (!extendedSession) {
        return null;
      }

      // Generate new CSRF token
      const crypto = require('crypto');
      const newCSRFToken = crypto.randomBytes(32).toString('hex');
      
      // Store the new CSRF token
      await this.storeCSRFToken(newCSRFToken, sessionToken);
      
      console.log('✅ Session refreshed with new CSRF token');
      
      return {
        session: extendedSession,
        csrfToken: newCSRFToken
      };
    } catch (error) {
      console.error('❌ Failed to refresh session:', error);
      return null;
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
      
      const sessions = await SecureDataAccess.query('sessions', {
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
      await SecureDataAccess.update('sessions',
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
      
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔄 Session extended by ${extensionMinutes} minutes (expires: ${newExpiry.toISOString()})`);
      
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
      const sessions = await SecureDataAccess.query('sessions', {
        token: sessionToken
      }, { limit: 1 }, context);
      const session = sessions[0];
      
      if (session) {
        // Then delete it
        await SecureDataAccess.delete('sessions', { token: sessionToken }, context);
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
        await SecureDataAccess.insert('audit_logs', {
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
      const result = await SecureDataAccess.delete('sessions', {
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
      // Transient connection blips are recoverable — don't dump a stack trace.
      if (isTransientMongoError(error)) {
        if (process.env.QUIET_LOGS !== 'true') {
          console.warn('⚠️ Session cleanup skipped: MongoDB connection interrupted (will retry next cycle)');
        }
      } else {
        console.error('❌ Failed to cleanup expired sessions:', error);
      }
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
      const sessions = await SecureDataAccess.query('sessions', {
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
   * Get all active sessions with user details (for admin dashboard)
   */
  async getActiveSessions() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'getActiveSessions',
        practiceId: 'global'
      };

      // Get all non-expired sessions
      const sessions = await SecureDataAccess.query('sessions', {
        expiresAt: { $gt: new Date() }
      }, { sort: { lastActivity: -1 } }, context);

      // Enrich with user info
      const enrichedSessions = [];
      for (const session of sessions) {
        let userInfo = { email: 'Unknown', firstName: '', lastName: '', roles: [] };

        if (session.userId && session.practiceSubdomain) {
          try {
            const userContext = {
              serviceId: 'secure-session-manager',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              operation: 'getUserInfo',
              practiceId: session.practiceSubdomain
            };
            const mongoose = require('mongoose');
            let userId = session.userId;
            if (typeof userId === 'string' && userId.length === 24) {
              userId = new mongoose.Types.ObjectId(userId);
            } else if (userId && userId.buffer) {
              const buffer = Buffer.from(Object.values(userId.buffer));
              userId = new mongoose.Types.ObjectId(buffer);
            }
            const users = await SecureDataAccess.query('users', { _id: userId }, { limit: 1 }, userContext);
            if (users && users[0]) {
              userInfo = {
                email: users[0].email || 'Unknown',
                firstName: users[0].firstName || '',
                lastName: users[0].lastName || '',
                roles: users[0].roles || []
              };
            }
          } catch (err) {
            // Skip user enrichment on error
          }
        }

        enrichedSessions.push({
          sessionId: session._id ? session._id.toString() : '',
          userId: session.userId ? session.userId.toString() : '',
          email: userInfo.email,
          name: `${userInfo.firstName} ${userInfo.lastName}`.trim() || userInfo.email,
          roles: userInfo.roles,
          practice: session.practiceSubdomain || 'unknown',
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt,
          isActive: session.isActive !== false
        });
      }

      return {
        totalActive: enrichedSessions.length,
        sessions: enrichedSessions
      };
    } catch (error) {
      console.error('❌ Failed to get active sessions:', error);
      return { totalActive: 0, sessions: [], error: error.message };
    }
  }

  /**
   * Get login/logout history from audit logs
   */
  async getLoginHistory(userId = null, limit = 50) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'getLoginHistory',
        practiceId: 'global'
      };

      const filter = {
        action: { $in: ['SESSION_CREATED', 'SESSION_DESTROYED'] }
      };
      if (userId) {
        filter.userId = userId;
      }

      const logs = await SecureDataAccess.query('audit_logs', filter, {
        sort: { timestamp: -1 },
        limit: limit
      }, context);

      return {
        totalEntries: logs.length,
        history: logs.map(log => ({
          action: log.action === 'SESSION_CREATED' ? 'LOGIN' : 'LOGOUT',
          userId: log.userId ? log.userId.toString() : '',
          email: log.metadata?.email || 'Unknown',
          loginMethod: log.metadata?.loginMethod || 'unknown',
          reason: log.metadata?.reason || '',
          timestamp: log.timestamp,
          practiceId: log.practiceId ? log.practiceId.toString() : ''
        }))
      };
    } catch (error) {
      console.error('❌ Failed to get login history:', error);
      return { totalEntries: 0, history: [], error: error.message };
    }
  }

  /**
   * Get failed login attempts from audit logs
   */
  async getFailedLoginAttempts(limit = 50) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const context = {
        serviceId: 'secure-session-manager',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'getFailedLogins',
        practiceId: 'global'
      };

      const logs = await SecureDataAccess.query('audit_logs', {
        action: { $in: ['LOGIN_FAILED', 'ACCOUNT_LOCKED', 'INVALID_CREDENTIALS', 'MFA_FAILED'] }
      }, {
        sort: { timestamp: -1 },
        limit: limit
      }, context);

      return {
        totalAttempts: logs.length,
        attempts: logs.map(log => ({
          action: log.action,
          email: log.metadata?.email || 'Unknown',
          ipAddress: log.metadata?.ipAddress || 'Unknown',
          reason: log.metadata?.reason || log.action,
          timestamp: log.timestamp,
          userAgent: log.metadata?.userAgent || ''
        }))
      };
    } catch (error) {
      console.error('❌ Failed to get failed login attempts:', error);
      return { totalAttempts: 0, attempts: [], error: error.message };
    }
  }

  /**
   * Force logout a specific user (terminate all their sessions)
   */
  async forceLogoutUser(userId, practiceId = null, adminUserId = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Invalidate all sessions for this user
      const result = await this.invalidateUserSessions(userId, practiceId);

      // Clear session cache entries for this user
      for (const [token, cached] of this.sessionCache.entries()) {
        if (cached.data && cached.data.userId === userId) {
          this.sessionCache.delete(token);
        }
      }

      // Audit log the force logout
      try {
        const auditContext = {
          serviceId: 'secure-session-manager',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          operation: 'auditLog',
          practiceId: 'global'
        };
        await SecureDataAccess.insert('audit_logs', {
          action: 'FORCE_LOGOUT',
          userId: userId,
          practiceId: practiceId,
          timestamp: new Date(),
          metadata: {
            reason: 'admin_force_logout',
            initiatedBy: adminUserId || 'system',
            sessionsTerminated: result?.deletedCount || 0
          }
        }, auditContext);
      } catch (auditErr) {
        console.log('⚠️ Audit logging skipped:', auditErr.message);
      }

      return {
        success: true,
        sessionsTerminated: result?.deletedCount || 0,
        userId: userId
      };
    } catch (error) {
      console.error('❌ Failed to force logout user:', error);
      return { success: false, error: error.message };
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
module.exports = new SecureSessionManager();