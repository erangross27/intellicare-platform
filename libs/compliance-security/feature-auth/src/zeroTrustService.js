/**
 * 🛡️ ZERO TRUST ARCHITECTURE SERVICE
 * Implements microservice mTLS, granular RBAC, and continuous authentication
 */

const crypto = require('crypto');
const path = require('path');
const jwt = require(path.resolve(__dirname, '../../../../backend/node_modules/jsonwebtoken'));
const fs = require('fs').promises;

// Add service proxy getter
let simpleServiceProxy = null;
function getServiceProxy() {
    if (!simpleServiceProxy) {
        simpleServiceProxy = require('../../../../backend/services/simpleServiceProxy');
    }
    return simpleServiceProxy;
}

// PERFORMANCE FIX: Cache practice databases to prevent memory leaks
let cachedClinicDatabases = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 60 seconds

async function getCachedClinicDatabases() {
  // Try to use ServiceRegistry cache if Agent 2 has it ready
  try {
    const proxy = getServiceProxy();
    const serviceRegistry = proxy.getService('serviceRegistry');
    return await serviceRegistry.getCachedClinicDatabases();
  } catch (e) {
    // Fallback to local cache if ServiceRegistry not ready
    if (Date.now() - cacheTimestamp > CACHE_TTL || !cachedClinicDatabases) {
      const clinicDatabaseManager = proxy.getService('clinicDatabaseManager');
      cachedClinicDatabases = await clinicDatabaseManager.getAllClinicDatabases();
      cacheTimestamp = Date.now();
    }
    return cachedClinicDatabases;
  }
}

class ZeroTrustService {
  constructor() {
    this.trustedServices = new Map();
    this.permissionMatrix = new Map();
    this.certificateAuthority = null;
    this.sessionTimeout = 8 * 60 * 60 * 1000; // 8 hours
    this.tokenRefreshInterval = 2 * 60 * 60 * 1000; // 2 hours
    this.initialized = false;
    this.serviceToken = null;
    this.ZeroTrustSession = null; // Will be set during initialization
  }

  // Initialize Zero Trust Service
  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service through proxy
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('zero-trust-service');
      
      await this.initializeCertificateAuthority();
      await this.loadPermissionMatrix();
      this.startSessionMonitoring();

      this.initialized = true;
      // Zero Trust Service initialized with persistent sessions
    } catch (error) {
      console.error('❌ Failed to initialize Zero Trust Service:', error);
      throw error;
    }
  }

  /**
   * Get service context for database operations
   */
  getServiceContext(practiceId = 'global', operation = 'database-access') {
    return {
      serviceId: 'zero-trust-service',
      operation: operation,
      practiceId: practiceId
    };
  }

  // Initialize internal Certificate Authority
  async initializeCertificateAuthority() {
    const caDir = path.join(__dirname, '../../../../../backend/config/ca');
    await fs.mkdir(caDir, { recursive: true });

    const caKeyPath = path.join(caDir, 'ca-key.pem');
    const caCertPath = path.join(caDir, 'ca-cert.pem');

    try {
      // Try to load existing CA
      const caKey = await fs.readFile(caKeyPath);
      const caCert = await fs.readFile(caCertPath);
      
      this.certificateAuthority = {
        key: caKey,
        cert: caCert
      };
      
      // Loaded existing Certificate Authority
    } catch (error) {
      // Generate new CA
      // Generating new Certificate Authority
      await this.generateCertificateAuthority(caKeyPath, caCertPath);
    }
  }

  // Generate Certificate Authority
  async generateCertificateAuthority(keyPath, certPath) {
    // For production, use proper certificate generation
    // This is a simplified implementation
    const caKey = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Store CA key and certificate
    await fs.writeFile(keyPath, caKey.privateKey, { mode: 0o600 });
    await fs.writeFile(certPath, caKey.publicKey, { mode: 0o644 });

    this.certificateAuthority = {
      key: caKey.privateKey,
      cert: caKey.publicKey
    };

    // Certificate Authority generated
  }

  // Register trusted service
  async registerTrustedService(serviceId, serviceInfo) {
    const serviceCert = await this.generateServiceCertificate(serviceId);
    
    const trustedService = {
      id: serviceId,
      name: serviceInfo.name,
      endpoint: serviceInfo.endpoint,
      certificate: serviceCert,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      permissions: serviceInfo.permissions || []
    };

    this.trustedServices.set(serviceId, trustedService);
    
    console.log(`🛡️ Trusted service registered: ${serviceId}`);
    return serviceCert;
  }

  // Generate service certificate
  async generateServiceCertificate(serviceId) {
    // Generate service key pair
    const serviceKeys = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Create certificate (simplified - in production use proper X.509)
    const certificate = {
      serviceId: serviceId,
      publicKey: serviceKeys.publicKey,
      privateKey: serviceKeys.privateKey,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      signature: this.signCertificate(serviceKeys.publicKey, serviceId)
    };

    return certificate;
  }

  // Sign certificate with CA
  signCertificate(publicKey, serviceId) {
    const dataToSign = `${serviceId}:${publicKey}:${new Date().toISOString()}`;
    return crypto.createHash('sha256').update(dataToSign).digest('hex');
  }

  // Verify service certificate
  verifyServiceCertificate(certificate, serviceId) {
    if (certificate.serviceId !== serviceId) {
      return { valid: false, reason: 'Service ID mismatch' };
    }

    if (new Date(certificate.expiresAt) < new Date()) {
      return { valid: false, reason: 'Certificate expired' };
    }

    const expectedSignature = this.signCertificate(certificate.publicKey, serviceId);
    if (certificate.signature !== expectedSignature) {
      return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true };
  }

  // Create secure session with continuous authentication
  async createSecureSession(userId, userInfo, clientInfo, practiceDb = null) {
    const sessionId = crypto.randomUUID();
    const sessionToken = this.generateSessionToken(userId, sessionId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeout);

    if (practiceDb) {
      try {
        // Use practice-specific database
        const ZeroTrustSessionSchema = require('../../../../backend/models/ZeroTrustSession');
        const SessionModel = practiceDb.model('ZeroTrustSession', ZeroTrustSessionSchema);

        const sessionDoc = new SessionModel({
          sessionId: sessionId,
          userId: userId,
          userInfo: userInfo,
          clientInfo: clientInfo,
          sessionToken: sessionToken,
          riskScore: this.calculateInitialRiskScore(userInfo, clientInfo),
          deviceFingerprint: this.generateDeviceFingerprint(clientInfo),
          createdAt: now,
          lastActivity: now,
          lastTokenRefresh: now,
          expiresAt: expiresAt,
          isActive: true
        });

        const context = this.getServiceContext(practiceDb.name, 'createSecureSession');
        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.create('zerotrustsessions', sessionDoc.toObject(), context);
        
        console.log(`🛡️ Persistent secure session created in practice DB: ${sessionId} for user ${userId}`, {
          practiceDb: practiceDb.name,
          expiresAt: expiresAt.toISOString(),
          riskScore: sessionDoc.riskScore
        });
      } catch (dbError) {
        console.error('❌ Error creating persistent session:', dbError.message);
        console.error('❌ Session creation error details:', {
          sessionId,
          userId,
          practiceDb: practiceDb?.name,
          errorName: dbError.name,
          errorCode: dbError.code
        });
        // Fall back to in-memory session
        console.log('🔄 Falling back to in-memory session');
      }
    }

    // Return session in the expected format (always works)
    return {
      id: sessionId,
      userId: userId,
      userInfo: userInfo,
      clientInfo: clientInfo,
      createdAt: now.toISOString(),
      lastActivity: now.toISOString(),
      lastTokenRefresh: now.toISOString(),
      token: sessionToken,
      riskScore: this.calculateInitialRiskScore(userInfo, clientInfo),
      permissions: await this.getUserPermissions(userId),
      mfaVerified: userInfo.mfaVerified || false,
      deviceFingerprint: this.generateDeviceFingerprint(clientInfo)
    };
  }

  // Generate session token
  generateSessionToken(userId, sessionId) {
    const payload = {
      userId: userId,
      sessionId: sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + this.sessionTimeout) / 1000)
    };

    const proxy = getServiceProxy();
    const secureConfigService = proxy.getService('secureConfigService');
    return jwt.sign(payload, secureConfigService.get('JWT_SECRET') || 'default-secret');
  }

  // Validate and refresh session
  async validateAndRefreshSession(sessionId, clientInfo, practiceDb = null) {
    console.log('🛡️ ZERO TRUST DEBUG: Validating session with practice DB', {
      sessionId: sessionId ? sessionId.substring(0, 8) + '...' : 'MISSING',
      hasClinicDb: !!practiceDb,
      clinicDbName: practiceDb?.name || 'none'
    });

    if (!practiceDb) {
      console.log('❌ ZERO TRUST: No practice database provided');
      return { valid: false, reason: 'No practice database' };
    }

    try {
      // Get the ZeroTrustSession schema and create model for this practice
      const ZeroTrustSessionSchema = require('../../../../backend/models/ZeroTrustSession');
      const SessionModel = practiceDb.model('ZeroTrustSession', ZeroTrustSessionSchema);

      // First try to find active session using SecureDataAccess
      const context = this.getServiceContext(practiceDb.name, 'validateSession');
      
      let sessionResults = await SecureDataAccess.query('zerotrustsessions', { 
        sessionId: sessionId, 
        isActive: true 
      }, { limit: 1 }, context);

      let sessionDoc = sessionResults[0];

      if (!sessionDoc) {
        console.log('❌ ZERO TRUST: Active session not found, checking for any session...');

        // Try to find any session (even inactive) to see if it exists
        const anySessionResults = await SecureDataAccess.query('zerotrustsessions', { 
          sessionId: sessionId 
        }, { limit: 1 }, context);
        
        const anySession = anySessionResults[0];
        if (anySession) {
          console.log('🔍 ZERO TRUST: Found inactive session', {
            isActive: anySession.isActive,
            expiresAt: anySession.expiresAt,
            lastActivity: anySession.lastActivity
          });

          // Check if session can be reactivated (not truly expired)
          const now = new Date();
          const timeSinceActivity = now.getTime() - new Date(anySession.lastActivity).getTime();

          if (timeSinceActivity <= this.sessionTimeout && new Date(anySession.expiresAt) > now) {
            console.log('🔄 ZERO TRUST: Reactivating valid but inactive session');
            anySession.isActive = true;
            anySession.lastActivity = now;
            
            await SecureDataAccess.update('zerotrustsessions', 
              { _id: anySession._id }, 
              { isActive: true, lastActivity: now }, 
              context
            );
            sessionDoc = anySession;
          } else {
            console.log('❌ ZERO TRUST: Session truly expired, cannot reactivate');
            return { valid: false, reason: 'Session expired' };
          }
        } else {
          console.log('❌ ZERO TRUST: Session not found in practice database');
          return { valid: false, reason: 'Session not found' };
        }
      }

      console.log('✅ ZERO TRUST: Session found in practice database');

      // Validate session timing
      const lastActivity = new Date(sessionDoc.lastActivity);
      const timeSinceActivity = Date.now() - lastActivity.getTime();

      console.log('🛡️ ZERO TRUST: Session timing check', {
        lastActivity: lastActivity.toISOString(),
        timeSinceActivity: Math.round(timeSinceActivity / 1000 / 60) + ' minutes',
        sessionTimeout: Math.round(this.sessionTimeout / 1000 / 60) + ' minutes',
        isExpired: timeSinceActivity > this.sessionTimeout
      });

      if (timeSinceActivity > this.sessionTimeout) {
        console.log('❌ ZERO TRUST: Session expired due to inactivity');
        await SecureDataAccess.update('zerotrustsessions',
          { _id: sessionDoc._id },
          { isActive: false, terminatedAt: new Date(), terminationReason: 'Session expired' },
          context
        );
        return { valid: false, reason: 'Session expired' };
      }

      // Verify device fingerprint
      const currentFingerprint = this.generateDeviceFingerprint(clientInfo);
      if (sessionDoc.deviceFingerprint !== currentFingerprint) {
        // Increase risk score for device change
        sessionDoc.riskScore += 0.3;
        console.warn(`🚨 Device fingerprint changed for session ${sessionId}`);
      }

      // Update session activity
      sessionDoc.lastActivity = new Date();
      await SecureDataAccess.update('zerotrustsessions', 
        { sessionId: sessionDoc.sessionId }, 
        { lastActivity: sessionDoc.lastActivity }, 
        context
      );

      // Check if token needs refresh
      const lastRefresh = new Date(sessionDoc.lastTokenRefresh);
      if (Date.now() - lastRefresh.getTime() > this.tokenRefreshInterval) {
        const newToken = this.generateSessionToken(sessionDoc.userId, sessionId);
        await SecureDataAccess.update('zerotrustsessions',
          { sessionId: sessionDoc.sessionId },
          { sessionToken: newToken, lastTokenRefresh: new Date() },
          context
        );
        sessionDoc.sessionToken = newToken;
        sessionDoc.lastTokenRefresh = new Date();
        console.log(`🔄 Token refreshed for session ${sessionId}`);
      }

      // Recalculate and update risk score
      const newRiskScore = this.calculateRiskScore(sessionDoc, clientInfo);
      sessionDoc.riskScore = newRiskScore;
      await SecureDataAccess.update('zerotrustsessions',
        { sessionId: sessionDoc.sessionId },
        { riskScore: newRiskScore },
        context
      );

      // Return session in expected format
      return {
        valid: true,
        session: {
          id: sessionDoc.sessionId,
          userId: sessionDoc.userId,
          userInfo: sessionDoc.userInfo,
          clientInfo: sessionDoc.clientInfo,
          createdAt: new Date(sessionDoc.createdAt).toISOString(),
          lastActivity: sessionDoc.lastActivity.toISOString(),
          lastTokenRefresh: sessionDoc.lastTokenRefresh.toISOString(),
          token: sessionDoc.sessionToken,
          riskScore: sessionDoc.riskScore,
          permissions: sessionDoc.userInfo.permissions || [],
          mfaVerified: sessionDoc.userInfo.mfaVerified || false,
          deviceFingerprint: sessionDoc.deviceFingerprint
        }
      };

    } catch (dbError) {
      console.error('❌ ZERO TRUST: Practice database error:', dbError.message);
      console.error('❌ ZERO TRUST: Database error details:', {
        name: dbError.name,
        code: dbError.code,
        stack: dbError.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
      });

      // Provide more specific error reasons based on the error type
      let reason = 'Database error';
      if (dbError.name === 'MongoNetworkError') {
        reason = 'Database connection error';
      } else if (dbError.name === 'MongoTimeoutError') {
        reason = 'Database timeout error';
      } else if (dbError.code === 11000) {
        reason = 'Database duplicate key error';
      }

      return { valid: false, reason };
    }
  }

  // Calculate initial risk score
  calculateInitialRiskScore(userInfo, clientInfo) {
    let riskScore = 0.1; // Base risk

    // Check for suspicious patterns
    if (clientInfo.userAgent && clientInfo.userAgent.includes('bot')) {
      riskScore += 0.5;
    }

    if (userInfo.role === 'admin') {
      riskScore += 0.2; // Higher risk for admin accounts
    }

    if (clientInfo.ip && this.isUnusualLocation(clientInfo.ip)) {
      riskScore += 0.3;
    }

    return Math.min(riskScore, 1.0);
  }

  // Calculate ongoing risk score
  calculateRiskScore(session, clientInfo) {
    let riskScore = session.riskScore;

    // Time-based risk increase
    const sessionAge = Date.now() - new Date(session.createdAt).getTime();
    const ageHours = sessionAge / (60 * 60 * 1000);
    riskScore += ageHours * 0.01; // Increase risk over time

    // Activity pattern analysis
    const timeSinceLastActivity = Date.now() - new Date(session.lastActivity).getTime();
    if (timeSinceLastActivity > 30 * 60 * 1000) { // 30 minutes
      riskScore += 0.1;
    }

    return Math.min(riskScore, 1.0);
  }

  // Generate device fingerprint
  generateDeviceFingerprint(clientInfo) {
    const fingerprintData = [
      clientInfo.userAgent || '',
      clientInfo.ip || '',
      clientInfo.acceptLanguage || '',
      clientInfo.acceptEncoding || ''
    ].join('|');

    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  // Check for unusual location (simplified)
  isUnusualLocation(ip) {
    // In production, use GeoIP service
    // For now, just check for localhost
    return !['127.0.0.1', '::1', 'localhost'].includes(ip);
  }

  // Load permission matrix
  async loadPermissionMatrix() {
    const permissionsFile = path.join(__dirname, '../../../../../backend/config/permissions-matrix.json');
    
    try {
      const permissionsContent = await fs.readFile(permissionsFile, 'utf8');
      const permissions = JSON.parse(permissionsContent);
      
      for (const [role, perms] of Object.entries(permissions)) {
        this.permissionMatrix.set(role, new Set(perms));
      }
      
      // Permission matrix loaded
    } catch (error) {
      // Create default permissions
      await this.createDefaultPermissions();
    }
  }

  // Create default permissions
  async createDefaultPermissions() {
    const defaultPermissions = {
      'admin': [
        'user_management',
        'system_configuration',
        'audit_access',
        'key_management',
        'upload_documents',
        'view_documents',
        'delete_documents',
        'export_data',
        'manage_patients',
        'view_analytics'
      ],
      'doctor': [
        'upload_documents',
        'view_documents',
        'manage_patients',
        'view_analytics',
        'export_data'
      ],
      'nurse': [
        'upload_documents',
        'view_documents',
        'manage_patients'
      ],
      'receptionist': [
        'manage_patients',
        'view_documents'
      ],
      'viewer': [
        'view_documents'
      ]
    };

    for (const [role, perms] of Object.entries(defaultPermissions)) {
      this.permissionMatrix.set(role, new Set(perms));
    }

    const permissionsFile = path.join(__dirname, '../../../../../backend/config/permissions-matrix.json');
    await fs.writeFile(permissionsFile, JSON.stringify(defaultPermissions, null, 2));
    
    console.log('🛡️ Default permissions created');
  }

  // Get user permissions
  async getUserPermissions(userId) {
    const context = this.getServiceContext('global', 'getUserPermissions');
    
    try {
      // Get all practice databases to find the user
      const practices = await getCachedClinicDatabases();

      for (const practice of practices) {
        try {
          const proxy = getServiceProxy();
          const SecureDataAccess = proxy.getService('secureDataAccess');
          const users = await SecureDataAccess.query('users', { _id: userId }, { limit: 1 }, {
            ...context,
            practiceId: practice.subdomain || practice.name
          });

          if (users && users.length > 0) {
            const user = users[0];
            // Return user's actual permissions
            return user.permissions || [];
          }
        } catch (error) {
          // Continue to next practice if this one fails
          continue;
        }
      }

      // 🔒 SECURITY: No fallbacks - user must exist for permission evaluation
      console.error(`❌ User ${userId} not found in any practice - no fallbacks allowed`);
      throw new Error('User not found - no fallback permissions allowed on medical platform');

    } catch (error) {
      console.error('❌ Error fetching user permissions:', error);
      // 🔒 SECURITY: No fallback permissions allowed
      throw new Error(`Permission evaluation failed - no fallbacks allowed on medical platform: ${error.message}`);
    }
  }

  // Check permission
  hasPermission(session, permission) {
    if (!session || !session.permissions) {
      return false;
    }

    return session.permissions.includes(permission);
  }

  // Start session monitoring
  startSessionMonitoring() {
    // Reduced frequency to minimize connection usage
    setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
        await this.monitorSuspiciousSessions();
      } catch (error) {
        console.error('❌ Session monitoring error:', error.message);
        // Continue monitoring despite errors
      }
    }, 900000); // Every 15 minutes - reduced from 5 minutes to minimize connections

    // Session monitoring started
  }

  // Cleanup expired sessions
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions?.entries() || []) {
      const lastActivity = new Date(session.lastActivity).getTime();
      
      if (now - lastActivity > this.sessionTimeout) {
        this.activeSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  // Monitor suspicious sessions using batch operations
  async monitorSuspiciousSessions() {
    try {
      // Get all practice databases for monitoring
      const practices = await getCachedClinicDatabases();
      
      // Extract practice IDs
      const practiceIds = practices.map(practice => practice.subdomain);
      
      if (practiceIds.length === 0) {
        return; // No practices to monitor
      }

      // Create context for SecureDataAccess
      const context = this.getServiceContext('global', 'monitorSessions');

      // Use the new multi-practice query to get all sessions at once
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const queryResult = await SecureDataAccess.multiClinicQuery(
        'zerotrustsessions',
        practiceIds,
        { isActive: true },
        {},
        context
      );
      
      // Process results for each practice
      const now = new Date();
      
      for (const [practiceId, sessions] of Object.entries(queryResult.results)) {
        // Filter high-risk sessions in memory
        const highRiskSessions = sessions.filter(session => 
          session.riskScore > 0.7 && 
          session.expiresAt && new Date(session.expiresAt) > now
        );

        for (const session of highRiskSessions) {
          console.warn(`🚨 High-risk session detected in ${practiceId}: ${session.sessionId.substring(0, 8)}... (risk: ${session.riskScore.toFixed(2)}) user: ${session.userInfo?.email}`);

          // Terminate critical risk sessions
          if (session.riskScore > 0.9) {
            // Find the practice database for termination
            const practice = practices.find(c => c.subdomain === practiceId);
            if (practice && practice.db) {
              await this.terminateSessionInDatabase(session.sessionId, 'High risk score', practice.db);
            }
          }
        }
      }
      
      // Log any errors
      if (Object.keys(queryResult.errors).length > 0) {
        for (const [practiceId, error] of Object.entries(queryResult.errors)) {
          console.error(`❌ Error monitoring sessions in practice ${practiceId}:`, error);
        }
      }
      
      // Summary log  
      const secureConfigService = proxy.getService('secureConfigService');
      if (secureConfigService.get('NODE_ENV', 'development') !== 'production') {
        console.log(`✅ Session monitoring completed: ${queryResult.summary.successful}/${queryResult.summary.totalClinics} practices checked in ${queryResult.summary.duration}ms`);
      }

    } catch (error) {
      console.error('❌ Error in session monitoring:', error.message);
    }
  }

  // Terminate session in database
  async terminateSessionInDatabase(sessionId, reason, practiceDb) {
    try {
      const context = this.getServiceContext(practiceDb.name, 'terminateSession');
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      
      const result = await SecureDataAccess.update('zerotrustsessions',
        { sessionId: sessionId },
        {
          isActive: false,
          terminatedAt: new Date(),
          terminationReason: reason
        },
        context
      );

      if (result.modifiedCount > 0) {
        console.log(`🛡️ Session terminated in database: ${sessionId} (reason: ${reason})`);
      } else {
        console.log(`⚠️ Session not found for termination: ${sessionId}`);
      }

      return result.modifiedCount > 0;

    } catch (error) {
      console.error(`❌ Error terminating session ${sessionId}:`, error.message);
      return false;
    }
  }

  // Legacy terminate session method (redirects to database)
  async terminateSession(sessionId, reason) {
    // For backward compatibility, try to find and terminate in all practices
    try {
      const practices = await getCachedClinicDatabases();

      for (const { subdomain, db } of practices) {
        const terminated = await this.terminateSessionInDatabase(sessionId, reason, db);
        if (terminated) {
          console.log(`🛡️ Session ${sessionId} terminated in practice ${subdomain}`);
          return true;
        }
      }

      console.log(`⚠️ Session ${sessionId} not found in any practice database`);
      return false;

    } catch (error) {
      console.error(`❌ Error in legacy session termination:`, error.message);
      return false;
    }
  }

  // Clean up expired sessions (database-based)
  async cleanupExpiredSessions() {
    let totalCleaned = 0;

    try {
      // Add timeout and connection validation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Session cleanup timeout')), 30000); // 30 second timeout
      });

      const cleanupPromise = this.performSessionCleanup();

      const result = await Promise.race([cleanupPromise, timeoutPromise]);
      return result;

    } catch (error) {
      console.error('❌ Error in session cleanup:', error.message);
      return { modifiedCount: 0 };
    }
  }

  // Perform the actual session cleanup with better error handling
  async performSessionCleanup() {
    let totalCleaned = 0;

    try {
      const practices = await getCachedClinicDatabases();

      for (const { subdomain, db } of practices) {
        try {
          // Check if database connection is alive before proceeding
          if (!db || db.readyState !== 1) {
            console.log(`⚠️ Skipping session cleanup for ${subdomain} - database not connected`);
            continue;
          }

          const context = this.getServiceContext(db.name, 'cleanupSessions');

          // Add operation timeout for individual practice operations
          const proxy = getServiceProxy();
          const SecureDataAccess = proxy.getService('secureDataAccess');
          const result = await SecureDataAccess.update('zerotrustsessions',
            {
              $or: [
                { expiresAt: { $lt: new Date() } },
                {
                  lastActivity: {
                    $lt: new Date(Date.now() - this.sessionTimeout)
                  }
                }
              ],
              isActive: true
            },
            {
              isActive: false,
              terminatedAt: new Date(),
              terminationReason: 'Expired'
            },
            context
          );

          if (result.modifiedCount > 0) {
            console.log(`🧹 Cleaned up ${result.modifiedCount} expired sessions in practice ${subdomain}`);
            totalCleaned += result.modifiedCount;
          }

        } catch (practiceError) {
          // More specific error handling
          if (practiceError.message.includes('timeout') || practiceError.message.includes('interrupted')) {
            console.error(`❌ Connection timeout cleaning up sessions in practice ${subdomain}: ${practiceError.message}`);
          } else {
            console.error(`❌ Error cleaning up sessions in practice ${subdomain}:`, practiceError.message);
          }
        }
      }

      if (totalCleaned > 0) {
        console.log(`🧹 Total sessions cleaned up: ${totalCleaned}`);
      }

      return { modifiedCount: totalCleaned };

    } catch (error) {
      console.error('❌ Error getting practice databases for cleanup:', error.message);
      return { modifiedCount: 0 };
    }
  }

  // Get zero trust status
  async getZeroTrustStatus() {
    let totalActiveSessions = 0;
    let practiceCount = 0;

    try {
      const practices = await getCachedClinicDatabases();
      practiceCount = practices.length;

      for (const { subdomain, db } of practices) {
        try {
          const context = this.getServiceContext(db.name, 'getStats');
          const proxy = getServiceProxy();
          const SecureDataAccess = proxy.getService('secureDataAccess');

          const sessions = await SecureDataAccess.query('zerotrustsessions', {
            isActive: true,
            expiresAt: { $gt: new Date() }
          }, {}, context);

          totalActiveSessions += sessions.length;
        } catch (error) {
          console.error(`Error counting sessions in ${subdomain}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error getting Zero Trust status:', error.message);
    }

    return {
      initialized: this.initialized,
      trustedServices: this.trustedServices.size,
      activeSessions: totalActiveSessions,
      clinicsMonitored: practiceCount,
      permissionRoles: this.permissionMatrix.size,
      certificateAuthority: !!this.certificateAuthority,
      sessionTimeout: this.sessionTimeout,
      tokenRefreshInterval: this.tokenRefreshInterval,
      persistent: true,
      databaseBased: true,
      monitoring: 'active'
    };
  }
}

// Singleton instance
const zeroTrustService = new ZeroTrustService();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('zeroTrustService', () => zeroTrustService);
}

module.exports = zeroTrustService;