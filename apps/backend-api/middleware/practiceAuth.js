const { ObjectId } = require('mongodb');
const SecureSessionManager = require('../services/secureSessionManager');
const { practiceContext, practiceModels } = require('./practiceContext');
const SecureDataAccess = require('../services/secureDataAccess');
const serviceAccountManager = require('../services/serviceAccountManager');
const productionKMS = require('../services/productionKMS');

// Track last session extension time to avoid excessive updates
const sessionExtensionCache = new Map();
const SESSION_EXTENSION_INTERVAL = 5 * 60 * 1000; // Only extend every 5 minutes

// Performance optimization: User permission cache
const userPermissionCache = new Map();
const USER_CACHE_TTL = 900000; // 15 minutes
const PERMISSION_CACHE_TTL = 3600000; // 1 hour for computed permissions

// Export cache for external invalidation (e.g., when user roles change)
const clearUserCache = (userId, practiceSubdomain) => {
  if (userId && practiceSubdomain) {
    const key = `user_${userId}_${practiceSubdomain}`;
    if (userPermissionCache.has(key)) {
      if (process.env.QUIET_LOGS !== 'true') console.log(`🗑️ [PRACTICE AUTH] Clearing user cache for ${key} due to data change`);
      userPermissionCache.delete(key);
    }
  } else {
    // Clear all user caches if no specific user provided
    for (const [key] of userPermissionCache.entries()) {
      if (key.startsWith('user_')) {
        userPermissionCache.delete(key);
      }
    }
    if (process.env.QUIET_LOGS !== 'true') console.log(`🗑️ [PRACTICE AUTH] Cleared all user caches due to data change`);
  }
};

// Clean up old cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userPermissionCache.entries()) {
    const ttl = key.startsWith('perm_') ? PERMISSION_CACHE_TTL : USER_CACHE_TTL;
    if (now - value.timestamp > ttl) {
      userPermissionCache.delete(key);
    }
  }
  
  // Also clean up old session extension tracking
  for (const [token, lastExtension] of sessionExtensionCache.entries()) {
    if (now - lastExtension > 24 * 60 * 60 * 1000) { // Remove after 24 hours
      sessionExtensionCache.delete(token);
    }
  }
}, 300000); // 5 minutes

/**
 * Practice-Aware Cookie-Based Authentication Middleware
 * 
 * Authenticates users within their practice context using httpOnly cookies
 * Ensures users can only access their practice's data
 */

// Pre-authenticated service context for SecureDataAccess
let authenticatedServiceContext = null;
let initializationPromise = null;

// Initialize service authentication on module load
initializationPromise = (async () => {
  try {
    // Services are initialized in server.js - just authenticate
    // Get the API key from KMS
    const apiKey = await productionKMS.getInternalKey('SERVICE_CLINIC_AUTH_SERVICE_KEY');
    
    // Authenticate the service once at startup
    authenticatedServiceContext = await serviceAccountManager.authenticate('practice-auth-service', apiKey);
    
    if (authenticatedServiceContext) {
      if (process.env.QUIET_LOGS !== 'true') console.log('✅ Practice auth service authenticated successfully');
    } else {
      console.error('❌ Failed to authenticate practice auth service');
    }
  } catch (error) {
    console.error('❌ Error initializing practice auth service:', error.message);
  }
})();

/**
 * Cookie-based session verification with practice context
 */
async function practiceAuth(req, res, next) {
  try {
    // Get session token from cookie
    const sessionToken = req.cookies?.sessionToken;
    
    if (process.env.QUIET_LOGS !== 'true') console.log(`[PRACTICE AUTH] ${req.method} ${req.path} - SessionToken: ${!!sessionToken}, User: ${!!req.user}, Cookies:`, Object.keys(req.cookies || {}));
    
    // If no session token, check if already validated by sessionValidation middleware
    if (!sessionToken && !req.user) {
      if (process.env.QUIET_LOGS !== 'true') console.log(`[${new Date().toISOString()}] ❌ PRACTICE AUTH: No session cookie for ${req.originalUrl}`);
      return res.status(401).json({
        success: false,
        message: {
          en: 'Authentication required.',
          he: 'נדרשת הזדהות.'
        }
      });
    }
    
    // If user already set by sessionValidation middleware, use that
    if (req.user && req.session) {
      // User already authenticated by sessionValidation middleware
      // Just ensure practice context is set
      if (req.session.practiceId && !req.practiceSubdomain) {
        // Get practice subdomain from session - handle both direct and nested format
        req.practiceSubdomain = req.session.practiceSubdomain || req.session.metadata?.practiceSubdomain;
      }
    } else if (sessionToken) {
      // Validate session using SecureSessionManager
      if (process.env.QUIET_LOGS !== 'true') console.log(`[PRACTICE AUTH] Validating session token...`);
      const session = await SecureSessionManager.validateSession(sessionToken);
      if (process.env.QUIET_LOGS !== 'true') console.log(`[PRACTICE AUTH] Session validation result:`, session ? `Valid (User: ${session.userId}, Practice: ${session.practiceSubdomain || 'none'})` : 'Invalid/Expired');
      
      if (!session) {
        if (process.env.QUIET_LOGS !== 'true') console.log(`[${new Date().toISOString()}] ❌ PRACTICE AUTH: Invalid session for ${req.originalUrl}`);
        return res.status(401).json({
          success: false,
          message: {
            en: 'Session expired or invalid.',
            he: 'הפעלה פגה או לא תקינה.'
          }
        });
      }
      
      // Extract user info from session
      const userId = session.userId;
      // Handle both direct and nested practiceSubdomain for compatibility
      const practiceSubdomain = session.practiceSubdomain || session.metadata?.practiceSubdomain;
      
      // Set practice context from session
      if (practiceSubdomain && !req.practiceSubdomain) {
        req.practiceSubdomain = practiceSubdomain;
      }
      
      // Store session info in request
      req.session = session;
      req.user = {
        id: userId,
        practiceId: session.practiceId,
        role: session.userRole,
        roles: session.userRoles || [session.userRole] // Use roles array if available
      };
    }
    
    // Ensure practice context is available
    if (!req.practiceSubdomain) {
      console.error('❌ No practice subdomain found:', {
        headers: req.headers,
        clinicFromToken: practiceSubdomain,
        reqClinic: req.practiceSubdomain
      });
      return res.status(400).json({
        success: false,
        message: {
          en: 'Practice context required. Please specify practice subdomain.',
          he: 'נדרש הקשר מרפאה. אנא ציין תת-דומיין של המרפאה.'
        }
      });
    }
    
    // Ensure practice database is available
    if (!req.practiceDb) {
      return res.status(500).json({
        success: false,
        message: {
          en: 'Practice database not available.',
          he: 'מסד נתונים של המרפאה אינו זמין.'
        }
      });
    }
    
    // If we have user ID but need more details, check cache first
    if (req.user && req.user.id && req.practiceDb) {
      // Check user cache first
      const userCacheKey = `user_${req.user.id}_${req.practiceSubdomain}`;
      let cachedUser = userPermissionCache.get(userCacheKey);

      // IMPORTANT: If session has userRoles array that differs from cache, use session data
      if (cachedUser && req.session && req.session.userRoles && Array.isArray(req.session.userRoles)) {
        const cachedRoles = cachedUser.data.roles || [];
        const sessionRoles = req.session.userRoles;

        // Check if roles are different
        const rolesMatch = JSON.stringify(cachedRoles.sort()) === JSON.stringify(sessionRoles.sort());

        if (!rolesMatch) {
          if (process.env.QUIET_LOGS !== 'true') console.log(`🔄 [PRACTICE AUTH] Session roles differ from cache. Session: ${sessionRoles}, Cache: ${cachedRoles}`);
          // Update the cached user data with session roles
          cachedUser.data.roles = sessionRoles;
          req.user.roles = sessionRoles;
          // Also update the cache
          userPermissionCache.set(userCacheKey, {
            data: { ...cachedUser.data, roles: sessionRoles },
            timestamp: Date.now()
          });
        }
      }

      // IMPORTANT: If session has multiple roles but cache has single 'user' role, invalidate cache
      if (cachedUser && req.user.roles && req.user.roles.length > 1) {
        const cachedRoles = cachedUser.data.roles || [];
        if (cachedRoles.length === 1 && cachedRoles[0] === 'user') {
          if (process.env.QUIET_LOGS !== 'true') console.log(`🔄 [PRACTICE AUTH] Session has multiple roles but cache has single 'user', invalidating cache`);
          userPermissionCache.delete(userCacheKey);
          cachedUser = null; // Force re-fetch from database
        }
      }

      if (cachedUser && (Date.now() - cachedUser.timestamp < USER_CACHE_TTL)) {
        // Use cached user data
        req.user = cachedUser.data;
        if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [PRACTICE AUTH] Using cached user data for ${req.user.email} (saved DB query)`);
        // Skip database query entirely
        next();
        return;
      }
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔄 [PRACTICE AUTH] Cache miss for user ${req.user.id}, fetching from DB`);
      // Service should already be authenticated at startup
      // Only re-authenticate if explicitly null (not just missing apiKey)
      if (!authenticatedServiceContext) {
        try {
          // This should only happen on first request after server start
          const apiKey = await productionKMS.getInternalKey('SERVICE_CLINIC_AUTH_SERVICE_KEY');
          authenticatedServiceContext = await serviceAccountManager.authenticate('practice-auth-service', apiKey);
          
          if (!authenticatedServiceContext) {
            throw new Error('Authentication returned null');
          }
        } catch (error) {
          console.error('❌ Failed to authenticate practice auth service:', error.message);
          return res.status(500).json({
            success: false,
            message: {
              en: 'Service authentication failed.',
              he: 'אימות השירות נכשל.'
            }
          });
        }
      }
      
      // Create context with authenticated service credentials
      // Use subdomain for context, not ObjectId
      const context = {
        ...authenticatedServiceContext,
        practiceId: req.practiceSubdomain || req.practiceId
      };

      // Convert user ID to ObjectId if it's a string
      const mongoose = require('mongoose');
      let userId = req.user.id;
      if (typeof userId === 'string' && userId.length === 24) {
        userId = new mongoose.Types.ObjectId(userId);
      }

      // Find user in practice database
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [PRACTICE AUTH] Fetching user from database: ${userId}`);
      const results = await SecureDataAccess.query('users', { _id: userId }, { limit: 1 }, context);
      const user = results && results.length > 0 ? results[0] : null;
      if (process.env.QUIET_LOGS !== 'true') console.log(`✅ [PRACTICE AUTH] User fetched: ${user?.email}`);
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔐 [PRACTICE AUTH] User roles from DB:`, user?.roles);
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔐 [PRACTICE AUTH] User full object keys:`, user ? Object.keys(user) : 'null user');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: {
            en: 'User not found in practice database.',
            he: 'משתמש לא נמצא במסד נתונים של המרפאה.'
          }
        });
      }
      
      // Check if user is active (allow pending_approval limited access)
      if (user.status === 'inactive' || user.status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: {
            en: 'User account is not active.',
            he: 'חשבון המשתמש אינו פעיל.'
          }
        });
      }
      
      // Compute effective permissions from practice policy (with caching)
      const { getEffectivePermissions } = require('../rbac/rbacService');
      const permCacheKey = `perm_${req.practiceSubdomain}_${(user.roles || []).join(',')}`;
      let effectivePermissions;
      
      const cachedPerms = userPermissionCache.get(permCacheKey);
      if (cachedPerms && (Date.now() - cachedPerms.timestamp < PERMISSION_CACHE_TTL)) {
        effectivePermissions = cachedPerms.data;
      } else {
        effectivePermissions = await getEffectivePermissions({ practiceDb: req.practiceDb, roles: user.roles });
        userPermissionCache.set(permCacheKey, {
          data: effectivePermissions,
          timestamp: Date.now()
        });
      }

      // Enhance user info in request
      const enhancedUser = {
        ...req.user,
        email: user.email,
        fullName: user.fullName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
        firstName: user.profile?.firstName || user.firstName,
        lastName: user.profile?.lastName || user.lastName,
        displayName: user.displayName || user.profile?.displayName,
        roles: user.roles,
        permissions: Array.from(new Set([...(user.permissions || []), ...effectivePermissions])),
        status: user.status,
        preferredLanguage: user.preferredLanguage,
        practiceSubdomain: req.practiceSubdomain,
        providerInfo: user.providerInfo // Include provider info with providerId
      };
      
      if (process.env.QUIET_LOGS !== 'true') console.log(`🎯 [PRACTICE AUTH] Enhanced user roles:`, enhancedUser.roles);
      if (process.env.QUIET_LOGS !== 'true') console.log(`🎯 [PRACTICE AUTH] Enhanced user email:`, enhancedUser.email);
      
      req.user = enhancedUser;
      
      // Cache the enhanced user data
      userPermissionCache.set(userCacheKey, {
        data: enhancedUser,
        timestamp: Date.now()
      });
      
      // Don't update lastLogin on every request - only on session creation
      // This saves ~500ms per request
      // await SecureDataAccess.update('users', { _id: user._id }, { $set: { lastLogin: new Date() } }, context);
    }
    
    // Removed noisy log: console.log(`👤 User authenticated: ${user.email} in practice ${req.practiceSubdomain}`);
    
    // Extend session on meaningful activity (not every request)
    if (sessionToken && req.user) {
      // Check if this is a meaningful action that should extend the session
      const meaningfulPaths = ['/api/chat', '/api/patients', '/api/appointments', '/api/documents'];
      const isMeaningfulAction = meaningfulPaths.some(path => req.path.startsWith(path)) || 
                                  req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE';
      
      if (isMeaningfulAction) {
        // Check if enough time has passed since last extension
        const lastExtension = sessionExtensionCache.get(sessionToken);
        const now = Date.now();
        
        if (!lastExtension || (now - lastExtension > SESSION_EXTENSION_INTERVAL)) {
          // Extend session asynchronously (don't block the request)
          SecureSessionManager.extendSession(sessionToken, 30).then(result => {
            if (result) {
              sessionExtensionCache.set(sessionToken, now);
              if (process.env.QUIET_LOGS !== 'true') console.log(`🔄 Session extended for user ${req.user.email} (activity: ${req.method} ${req.path})`);
            }
          }).catch(err => {
            console.error('Failed to extend session:', err);
          });
        }
      }
    }
    
    next();
    
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: {
        en: 'Internal server error during authentication.',
        he: 'שגיאת שרת פנימית במהלך האימות.'
      }
    });
  }
}

/**
 * Role-based authorization middleware
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'Authentication required.',
          he: 'נדרש אימות.'
        }
      });
    }
    
    // Convert single role to array
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    // Check if user has any of the required roles
    const hasRole = requiredRoles.some(role => req.user.roles.includes(role));
    
    if (process.env.QUIET_LOGS !== 'true') console.log('🔐 Role check:', {
      requiredRoles,
      userRoles: req.user.roles,
      hasRole,
      userEmail: req.user.email
    });
    
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: {
          en: `Access denied. Required roles: ${requiredRoles.join(', ')}`,
          he: `גישה נדחתה. תפקידים נדרשים: ${requiredRoles.join(', ')}`
        }
      });
    }
    
    next();
  };
}

/**
 * Permission-based authorization middleware
 */
function requirePermission(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'Authentication required.',
          he: 'נדרש אימות.'
        }
      });
    }
    
    // Convert single permission to array
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    
    // Check if user has any of the required permissions
    const hasPermission = requiredPermissions.some(permission => 
      req.user.permissions.includes(permission)
    );
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: {
          en: `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
          he: `גישה נדחתה. הרשאות נדרשות: ${requiredPermissions.join(', ')}`
        }
      });
    }
    
    next();
  };
}

/**
 * Combined middleware chain for practice-aware authentication
 * Use this for routes that need full practice context + authentication
 */
function fullClinicAuth(req, res, next) {
  // Chain: practice context -> practice models -> authentication
  practiceContext(req, res, (err) => {
    if (err) return next(err);
    
    practiceModels(req, res, (err) => {
      if (err) return next(err);
      
      practiceAuth(req, res, next);
    });
  });
}

/**
 * Generate JWT token with practice context and session binding
 */
function generateToken(user, practiceSubdomain, options = {}) {
  // Use the enhanced token manager for better security and remember me support
  const rememberMe = options.rememberMe || false;
  return tokenManager.generateAccessToken(user, practiceSubdomain, rememberMe);
}

module.exports = {
  practiceAuth,
  requireRole,
  requirePermission,
  fullClinicAuth,
  generateToken,
  clearUserCache
};
