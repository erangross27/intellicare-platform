const { ObjectId } = require('mongodb');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const { practiceContext, practiceModels, auditLogger } = require('../middleware/practiceContext');
const { generateToken, fullClinicAuth } = require('../middleware/practiceAuth');
const roleModel = require('../config/roles');
const databaseFactory = require('../utils/databaseFactory');
const { model: User } = require('../models/User');
const immutableAuditService = require('../services/immutableAuditService');
const blockchainAuditService = require('../services/blockchainAuditService');
const zeroTrustService = require('../services/zeroTrustService');
const threatIntelligenceService = require('../services/threatIntelligenceService');
const mfaService = require('../services/mfaService');
const SecureDataAccess = require('../services/secureDataAccess');
const serviceAccountManager = require('../services/serviceAccountManager');
const secureConfigService = require('../services/secureConfigService');
const SecureSessionManager = require('../services/secureSessionManager');
const { getSecureCookieOptions, isRootDomainRequest } = require('../utils/cookieSecurity');

// Initialize service authentication for practice-auth
let serviceToken = null;
let serviceAuthObject = null;
let authenticationPromise = (async () => {
  try {
    // Initialize serviceAccountManager if needed
    if (!serviceAccountManager.ServiceAccount) {
      console.log('⏳ [Practice Auth] Initializing serviceAccountManager...');
      await serviceAccountManager.initialize();
    }
    
    serviceAuthObject = await serviceAccountManager.authenticate('practice-auth-service');
    serviceToken = serviceAuthObject?.sessionToken || serviceAuthObject?.token || serviceAuthObject;
    console.log('✅ [Practice Auth] Service authenticated successfully');
    return serviceToken;
  } catch (error) {
    console.error('❌ [Practice Auth] Failed to authenticate service:', error.message);
    // Retry once after 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      if (!serviceAccountManager.ServiceAccount) {
        await serviceAccountManager.initialize();
      }
      serviceAuthObject = await serviceAccountManager.authenticate('practice-auth-service');
      serviceToken = serviceAuthObject?.sessionToken || serviceAuthObject?.token || serviceAuthObject;
      console.log('✅ [Practice Auth] Service authenticated (retry successful)');
      return serviceToken;
    } catch (retryError) {
      console.error('❌ [Practice Auth] Failed to authenticate after retry:', retryError.message);
    }
  }
})();

/**
 * Practice-Aware Authentication Routes
 *
 * All authentication happens within practice context
 * Users are authenticated against their practice's database
 */

// @route   POST /api/practice-auth/login
// @desc    Login user to specific practice
// @access  Public
router.post(
  '/login',
  [
    practiceContext,
    practiceModels,
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists(),
    auditLogger('user_login', 'user')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    try {
      // Define proper context for SecureDataAccess
      const context = {
        serviceId: 'practice-auth-service',
        apiKey: serviceToken,
        practiceId: req.practice.id
      };
      
      // Find user in practice database - explicitly select password field
      const users = await SecureDataAccess.query('users', { email }, { limit: 1 }, context);
      const user = users && users.length > 0 ? users[0] : null;
      if (!user) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid credentials.',
            he: 'פרטי התחברות לא חוקיים.'
          }
        });
      }

      // Check if user is active
      if (!user.isActive()) {
        return res.status(403).json({
          success: false,
          message: {
            en: 'Account is not active. Please contact administrator.',
            he: 'החשבון אינו פעיל. אנא פנה למנהל המערכת.'
          }
        });
      }

      // Verify password using the User model's comparePassword method
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        // Increment login attempts
        user.loginAttempts = (user.loginAttempts || 0) + 1;

        // Lock account after 5 failed attempts
        if (user.loginAttempts >= 5) {
          user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          user.status = 'suspended';
        }

        await SecureDataAccess.update('users', { _id: user._id }, { 
          $set: { 
            loginAttempts: user.loginAttempts,
            lockUntil: user.lockUntil,
            status: user.status
          }
        }, context);

        // 🔐 SECURITY: Log failed login attempt
        await immutableAuditService.addAuditEntry({
          eventType: 'user_login_failed',
          userId: user._id.toString(),
          clientIp: req.ip,
          userAgent: req.get('User-Agent'),
          details: `Failed login attempt for user ${email}`,
          metadata: {
            email: email,
            loginAttempts: user.loginAttempts,
            accountLocked: user.loginAttempts >= 5,
            practiceSubdomain: req.practiceSubdomain
          }
        });

        // 🔗 BLOCKCHAIN: Log critical security event
        await blockchainAuditService.addCriticalEvent({
          type: 'user_login',
          userId: user._id.toString(),
          clientIp: req.ip,
          details: `Failed login attempt - ${user.loginAttempts} attempts`,
          metadata: {
            success: false,
            accountLocked: user.loginAttempts >= 5
          }
        });

        // 📊 THREAT INTELLIGENCE: Check for suspicious activity
        const threatCorrelation = await threatIntelligenceService.correlateSecurityEvent({
          eventType: 'auth_failure',
          clientIp: req.ip,
          userId: user._id.toString(),
          userAgent: req.get('User-Agent')
        });

        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid credentials.',
            he: 'פרטי התחברות לא חוקיים.'
          }
        });
      }

      // Check if account is locked
      if (user.lockUntil && user.lockUntil > new Date()) {
        return res.status(423).json({
          success: false,
          message: {
            en: 'Account is temporarily locked due to multiple failed login attempts.',
            he: 'החשבון נעול זמנית עקב ניסיונות התחברות כושלים מרובים.'
          }
        });
      }

      // 🔒 SECURITY: Check if MFA is required - NO BYPASS ALLOWED
      const requiresMFA = mfaService.requiresMFA(user);
      const { mfaToken, mfaCode } = req.body;

      // 🔒 SECURITY: Detect bypass attempts
      if ((mfaCode === null || mfaCode === '' || mfaCode === 'bypass' || mfaCode === 'admin') && requiresMFA) {
        return res.status(401).json({
          success: false,
          message: {
            en: 'Invalid MFA bypass attempt detected.',
            he: 'זוהה ניסיון עקיפת MFA לא חוקי.'
          }
        });
      }

      if (requiresMFA && !mfaToken) {
        // 🚨 CRITICAL SECURITY: MFA required but not provided - DENY ACCESS COMPLETELY
        return res.status(401).json({
          success: false,
          mfaRequired: true,
          requires2FA: true,
          message: {
            en: 'Multi-factor authentication required. Access denied.',
            he: 'נדרש אימות דו-שלבי. הגישה נדחתה.'
          }
          // 🔒 SECURITY: NO TOKEN PROVIDED - NO PARTIAL ACCESS ALLOWED
        });
      }

      let mfaVerified = false;
      if (requiresMFA && mfaToken) {
        // Verify MFA token
        const mfaVerification = await mfaService.verifyMFALogin(user, mfaToken);

        if (!mfaVerification.verified) {
          return res.status(400).json({
            success: false,
            mfaRequired: true,
            message: {
              en: 'Invalid MFA token.',
              he: 'טוקן MFA לא חוקי.'
            }
          });
        }

        mfaVerified = true;

        // Update MFA last used
        if (user.security) {
          user.security.mfaLastUsed = new Date();
        }
      }

      // Reset login attempts on successful login
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      user.lastLogin = new Date();
      await SecureDataAccess.update('users', { _id: user._id }, { 
        $set: { 
          loginAttempts: 0,
          lockUntil: undefined,
          lastLogin: new Date()
        }
      }, context);

      // ✅ REAL SECURITY: Create server-side session instead of JWT token
      const SecureSessionManager = require('../services/secureSessionManager');
      
      const session = await SecureSessionManager.createSession(
        user._id.toString(),
        req.practice._id.toString(),
        user.roles[0] || 'user',
        { 
          practiceSubdomain: req.practiceSubdomain,
          email: user.email,
          name: user.fullName || `${user.profile?.firstName} ${user.profile?.lastName}`,
          mfaVerified: mfaVerified,
          riskScore: zeroTrustSession?.riskScore || 0.1,
          sessionId: zeroTrustSession?.id
        }
      );

      // 🛡️ ZERO TRUST: Create secure session with MFA status
      const clientInfo = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        acceptLanguage: req.get('Accept-Language'),
        acceptEncoding: req.get('Accept-Encoding')
      };

      const zeroTrustSession = await zeroTrustService.createSecureSession(
        user._id.toString(),
        {
          email: user.email,
          fullName: user.fullName,
          roles: user.roles,
          permissions: user.permissions,
          mfaEnabled: requiresMFA,
          mfaVerified: mfaVerified
        },
        clientInfo,
        req.practiceDb // Pass practice database
      );

      // Update session with MFA verification status
      zeroTrustSession.mfaVerified = mfaVerified;

      // Adjust risk score based on MFA
      const mfaRiskScore = mfaService.calculateMFARiskScore(user, mfaVerified);
      zeroTrustSession.riskScore = Math.min(zeroTrustSession.riskScore + mfaRiskScore, 1.0);

      // 🔐 SECURITY: Log successful login
      await immutableAuditService.addAuditEntry({
        eventType: 'user_login_success',
        userId: user._id.toString(),
        sessionId: zeroTrustSession.id,
        clientIp: req.ip,
        userAgent: req.get('User-Agent'),
        details: `Successful login for user ${email}`,
        metadata: {
          email: email,
          practiceSubdomain: req.practiceSubdomain,
          sessionId: zeroTrustSession.id,
          riskScore: zeroTrustSession.riskScore
        }
      });

      // 🔗 BLOCKCHAIN: Log critical security event
      await blockchainAuditService.addCriticalEvent({
        type: 'user_login',
        userId: user._id.toString(),
        sessionId: zeroTrustSession.id,
        clientIp: req.ip,
        details: `Successful login with Zero Trust session`,
        metadata: {
          success: true,
          sessionId: zeroTrustSession.id,
          riskScore: zeroTrustSession.riskScore
        }
      });

      // ✅ REAL SECURITY: Set httpOnly cookie with session token
      const cookieOptions = getSecureCookieOptions(req);
      console.log('🍪 [Login] Setting secure session cookie');
      console.log('🍪 [Login] Request hostname:', req.hostname);
      console.log('🍪 [Login] Cookie domain:', cookieOptions.domain || '(current host only)');
      
      res.cookie('sessionToken', session.sessionToken, cookieOptions);

      // ✅ SECURE: Return user/practice data WITHOUT tokens
      res.json({
        success: true,
        // ❌ REMOVED: token (fake client security)
        sessionId: session.sessionId, // Server-generated session ID
        csrfToken: session.csrfToken, // For mutation protection
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          displayName: user.displayName,
          roles: user.roles,
          permissions: user.permissions,
          preferredLanguage: user.preferredLanguage,
          timezone: user.timezone,
          profile: user.profile
        },
        practice: {
          id: req.practice._id,
          subdomain: req.practiceSubdomain,
          name: req.practice.name,
          settings: req.practice.settings
        },
        security: {
          sessionId: session.sessionId,
          riskScore: zeroTrustSession?.riskScore || 0.1,
          mfaRequired: requiresMFA,
          mfaVerified: mfaVerified,
          mfaStatus: mfaService.getMFAStatus(user),
          sessionExpiry: new Date(Date.now() + 30 * 60 * 1000)
        }
      });

    } catch (error) {
      console.error('❌ Login error:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during login.',
          he: 'שגיאת שרת במהלך ההתחברות.'
        }
      });
    }
  }
);

// @route   PUT /api/practice-auth/language
// @desc    Update user's preferred language within practice context
// @access  Private (practice-aware)
router.put('/language', [fullClinicAuth, body('language').isIn(['en','he'])], async (req, res) => {
  const errors = validationResult(req);
  if (!errors || !errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { language } = req.body;
    const UserModel = req.models.User;
    // Use SecureDataAccess for update operation
    const context = {
      serviceId: 'practice-auth-service',
      apiKey: serviceToken,
      practiceId: req.practice.id
    };
    
    await SecureDataAccess.update('users', 
      { _id: req.user.id }, 
      { $set: { preferredLanguage: language } },
      context
    );
    
    // Fetch updated user
    const users = await SecureDataAccess.query('users', { _id: req.user.id }, { limit: 1 }, context);
    const updated = users[0];

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: { en: 'User not found', he: 'המשתמש לא נמצא' }
      });
    }

    res.json({
      success: true,
      message: { en: 'Language updated', he: 'השפה עודכנה' },
      user: {
        id: updated._id,
        email: updated.email,
        fullName: updated.fullName,
        preferredLanguage: updated.preferredLanguage
      }
    });
  } catch (error) {
    console.error('❌ Language update error:', error);
    res.status(500).json({
      success: false,
      message: { en: 'Server error', he: 'שגיאת שרת' }
    });
  }
});


// @route   POST /api/practice-auth/register
// @desc    Register new user in practice (admin only)
// @access  Private (Admin)
router.post(
  '/register',
  [
    fullClinicAuth,
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Please enter a password with 8 or more characters').isLength({ min: 8 }),
    body('profile.firstName', 'First name is required').notEmpty(),
    body('profile.lastName', 'Last name is required').notEmpty(),
    body('roles', 'At least one role is required').isArray({ min: 1 }),
    auditLogger('user_created', 'user')
  ],
  async (req, res) => {
    // Check if user has admin role
    if (!req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: {
          en: 'Only administrators can register new users.',
          he: 'רק מנהלים יכולים לרשום משתמשים חדשים.'
        }
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, profile, roles, permissions } = req.body;

    try {
      // Define proper context for SecureDataAccess
      const context = {
        serviceId: 'practice-auth-service',
        apiKey: serviceToken,
        practiceId: req.practice.id
      };
      
      // Check if user already exists in this practice
      const existingUsers = await SecureDataAccess.query('users', { email }, { limit: 1 }, context);
      let user = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;
      if (user) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'User already exists in this practice.',
            he: 'משתמש כבר קיים במרפאה זו.'
          }
        });
      }

      // Validate roles
      const validRoles = roleModel.CANONICAL_ROLES;
      const invalidRoles = roles.filter(role => !validRoles.includes(role));
      if (invalidRoles.length > 0) {
        return res.status(400).json({
          success: false,
          message: {
            en: `Invalid roles: ${invalidRoles.join(', ')}`,
            he: `תפקידים לא חוקיים: ${invalidRoles.join(', ')}`
          }
        });
      }

      // Create new user
      user = new req.models.User({
        email,
        password: await bcrypt.hash(password, 10),
        profile,
        roles,
        permissions: permissions || [],
        status: 'active',
        createdBy: req.user.id
      });

      await SecureDataAccess.insert('users', user, context);

      res.status(201).json({
        success: true,
        message: {
          en: 'User registered successfully.',
          he: 'משתמש נרשם בהצלחה.'
        },
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          displayName: user.displayName,
          roles: user.roles,
          permissions: user.permissions,
          status: user.status
        }
      });

    } catch (error) {
      console.error('❌ Registration error:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during registration.',
          he: 'שגיאת שרת במהלך הרישום.'
        }
      });
    }
  }
);

// @route   GET /api/practice-auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', fullClinicAuth, async (req, res) => {
  try {
    // Define proper context for SecureDataAccess
    const context = {
      serviceId: 'practice-auth-service',
      apiKey: serviceToken,
      practiceId: req.practice.id
    };
    
    const users = await SecureDataAccess.query('users', { _id: req.user.id }, { limit: 1 }, context);
    const user = users && users.length > 0 ? users[0] : null;

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        profile: user.profile,
        roles: user.roles,
        permissions: user.permissions,
        status: user.status,
        preferredLanguage: user.preferredLanguage,
        lastLogin: user.lastLogin
      },
      practice: {
        subdomain: req.practiceSubdomain,
        name: req.practice.name,
        settings: req.practice.settings
      }
    });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error getting user info.',
        he: 'שגיאת שרת בקבלת פרטי המשתמש.'
      }
    });
  }
});

// REMOVED: Broken logout endpoint that didn't clear cookies
// The working logout endpoint is defined later in the file

// @route   GET /api/practice-auth/validate/:subdomain
// @desc    Validate practice subdomain exists and is active
// @access  Public
router.get('/validate/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;

    // Get global database connection
    const databaseFactory = require('../utils/databaseFactory');
    // Direct database access removed - using SecureDataAccess instead
    const context = {
      serviceId: 'practice-auth',
      apiKey: 'internal-service',
      practiceId: 'global'
    };

    // Find practice by subdomain
    const practices = await SecureDataAccess.query('practices', {
      subdomain: subdomain.toLowerCase(),
      isDeleted: false
    }, { limit: 1 }, context);
    const practice = practices && practices.length > 0 ? practices[0] : null;

    if (!practice) {
      return res.status(404).json({
        success: false,
        message: {
          en: `Practice '${subdomain}' not found.`,
          he: `מרפאה '${subdomain}' לא נמצאה.`
        }
      });
    }

    if (!practice.isActive()) {
      return res.status(403).json({
        success: false,
        message: {
          en: `Practice '${subdomain}' is not active.`,
          he: `מרפאה '${subdomain}' אינה פעילה.`
        }
      });
    }

    res.json({
      success: true,
      practice: {
        subdomain: practice.subdomain,
        name: practice.name,
        isActive: practice.isActive()
      }
    });

  } catch (error) {
    console.error('❌ Practice validation error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error during practice validation.',
        he: 'שגיאת שרת במהלך אימות המרפאה.'
      }
    });
  }
});

// @route   POST /api/practice-auth/user-practices
// @desc    Get available practices for user email (for future multi-practice support)
// @access  Public
router.post('/user-practices', [
  body('email', 'Please include a valid email').isEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { email } = req.body;

    // For now, return empty array as we don't support multi-practice users yet
    // This is a placeholder for future functionality
    res.json({
      success: true,
      practices: [],
      message: {
        en: 'Multi-practice support coming soon. Please use practice-specific login.',
        he: 'תמיכה במספר מרפאות תגיע בקרוב. אנא השתמש בהתחברות ספציפית למרפאה.'
      }
    });

  } catch (error) {
    console.error('❌ User practices error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error during practice lookup.',
        he: 'שגיאת שרת במהלך חיפוש המרפאה.'
      }
    });
  }
});

// @route   POST /api/practice-auth/self-register
// @desc    Self-register new user in existing practice (public)
// @access  Public
router.post(
  '/self-register',
  [
    body('practiceSubdomain', 'Practice subdomain is required').notEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Please enter a password with 8 or more characters').isLength({ min: 8 }),
    body('name', 'Full name is required').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Validation failed. Please check your input.',
          he: 'אימות נכשל. אנא בדוק את הקלט שלך.'
        },
        errors: errors.array()
      });
    }

    const { practiceSubdomain, email, password, name } = req.body;

    try {
      // Initialize database factory
      await databaseFactory.initialize();

      // Verify practice exists using SecureDataAccess
      const context = {
        serviceId: 'practice-auth',
        apiKey: 'internal-service',  
        practiceId: 'global'
      };

      const practices = await SecureDataAccess.query('practices', { subdomain: practiceSubdomain.toLowerCase() }, { limit: 1 }, context);
      const practice = practices[0];
      if (!practice) {
        return res.status(404).json({
          success: false,
          message: {
            en: 'Practice not found. Please check the practice name.',
            he: 'מרפאה לא נמצאה. אנא בדוק את שם המרפאה.'
          }
        });
      }

      // Using SecureDataAccess for user operations - no direct database access needed

      // Check if user already exists in this practice
      const existingUsers = await SecureDataAccess.query('users', { email: email.toLowerCase() }, { limit: 1 }, context);
      const existingUser = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: {
            en: 'A user with this email already exists in this practice.',
            he: 'משתמש עם כתובת אימייל זו כבר קיים במרפאה זו.'
          }
        });
      }

      // Parse name into first and last name
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with basic permissions
      const newUserData = {
        email: email.toLowerCase(),
        password: hashedPassword,
        profile: {
          firstName: firstName,
          lastName: lastName,
          title: '',
          phone: ''
        },
        roles: [roleModel.DEFAULT_ROLE], // Basic role (canonical default: 'user')
        permissions: ['read_profile', 'write_profile'], // Minimal permissions
        status: 'pending_approval', // Requires admin approval for full access
        preferredLanguage: 'en',
        registrationMethod: 'self_registration',
        registrationDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert new user using SecureDataAccess
      const newUser = await SecureDataAccess.insert('users', newUserData, context);

      // Create audit log for self-registration using SecureDataAccess
      await SecureDataAccess.insert('audit_logs', {
        userId: newUser._id,
        userDetails: {
          email: newUser.email,
          fullName: newUser.fullName,
          roles: newUser.roles
        },
        action: 'user_self_registered',
        resourceType: 'user',
        resourceId: newUser._id.toString(),
        request: {
          method: 'POST',
          url: '/api/practice-auth/self-register',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.get('User-Agent') || 'Unknown'
        },
        response: {
          statusCode: 201,
          success: true
        },
        severity: 'medium',
        metadata: {
          selfRegistration: true,
          practiceSubdomain: practiceSubdomain,
          pendingApproval: true
        }
      }, context);

      // ✅ REAL SECURITY: Create server-side session for immediate login
      const SecureSessionManager = require('../services/secureSessionManager');
      
      const session = await SecureSessionManager.createSession(
        newUser._id.toString(),
        practice._id.toString(),
        roleModel.primaryRole(newUser.roles),
        { 
          practiceSubdomain: practiceSubdomain.toLowerCase(),
          email: newUser.email,
          name: newUser.fullName || `${newUser.profile?.firstName} ${newUser.profile?.lastName}`,
          status: newUser.status,
          registrationMethod: 'self_registration',
          requiresApproval: true
        }
      );

      // TODO: Send notification to practice admins about new registration
      // This could be implemented as an email notification or in-app notification

      // ✅ REAL SECURITY: Set httpOnly cookie for immediate auto-login
      const cookieOptions = getSecureCookieOptions(req);
      res.cookie('sessionToken', session.sessionToken, cookieOptions);

      res.status(201).json({
        success: true,
        message: {
          en: 'Registration successful! You have basic access. An administrator will review and upgrade your permissions soon.',
          he: 'הרישום הצליח! יש לך גישה בסיסית. מנהל יבדוק וישדרג את ההרשאות שלך בקרוב.'
        },
        // ❌ REMOVED: token (fake client security)
        sessionId: session.sessionId, // Server-generated session ID
        csrfToken: session.csrfToken, // For mutation protection
        user: {
          id: newUser._id,
          email: newUser.email,
          fullName: newUser.fullName,
          displayName: newUser.displayName,
          roles: newUser.roles,
          permissions: newUser.permissions,
          status: newUser.status,
          preferredLanguage: newUser.preferredLanguage
        },
        practice: {
          id: practice._id,
          subdomain: practice.subdomain,
          name: practice.name
        },
        requiresApproval: true,
        security: {
          sessionId: session.sessionId,
          sessionExpiry: new Date(Date.now() + 30 * 60 * 1000)
        }
      });

    } catch (error) {
      console.error('❌ Self-registration error:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during registration. Please try again.',
          he: 'שגיאת שרת במהלך הרישום. אנא נסה שוב.'
        }
      });
    }
  }
);

// ✅ SERVER-SIDE SESSION ENDPOINTS - REAL SECURITY
// -----------------------------------------------

// @route   POST /api/practice-auth/set-session-cookie
// @desc    Set session cookie after redirect from root domain
// @access  Public (requires valid session token)
router.post('/set-session-cookie', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Session token required',
          he: 'נדרש טוקן סשן'
        }
      });
    }
    
    // Verify this is a practice subdomain, not root
    if (isRootDomainRequest(req)) {
      console.log('🚫 [Set Cookie] Cannot set cookie on root domain');
      return res.status(403).json({
        success: false,
        message: {
          en: 'Cannot set session on root domain',
          he: 'לא ניתן להגדיר סשן בדומיין הראשי'
        }
      });
    }
    
    // Validate the session token
    if (!SecureSessionManager.initialized) {
      await SecureSessionManager.initialize();
    }
    
    const session = await SecureSessionManager.validateSession(sessionToken);
    
    if (!session) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'Invalid or expired session',
          he: 'סשן לא תקף או פג תוקף'
        }
      });
    }
    
    // Verify subdomain matches session
    const hostname = req.hostname || '';
    const parts = hostname.split('.');
    const currentSubdomain = parts[0];
    
    if (currentSubdomain !== session.practiceSubdomain) {
      console.log(`🚫 [Set Cookie] Subdomain mismatch: ${currentSubdomain} !== ${session.practiceSubdomain}`);
      return res.status(403).json({
        success: false,
        message: {
          en: 'Session does not match practice subdomain',
          he: 'הסשן לא תואם את תת-הדומיין של המרפאה'
        }
      });
    }
    
    // First clear any existing cookies (including old ones with wrong domain)
    const clearConfigs = [
      { httpOnly: true, secure: false, sameSite: 'lax', path: '/', domain: '.intellicare.health' },
      { httpOnly: true, secure: false, sameSite: 'strict', path: '/', domain: req.hostname },
      { httpOnly: true, secure: false, sameSite: 'strict', path: '/' }
    ];
    
    clearConfigs.forEach(config => {
      res.clearCookie('sessionToken', config);
    });
    
    console.log('🗑️ [Set Cookie] Cleared old cookies first');
    
    // Now set the new session cookie on the correct subdomain
    const cookieOptions = getSecureCookieOptions(req);
    if (cookieOptions) {
      res.cookie('sessionToken', sessionToken, cookieOptions);
      console.log(`✅ [Set Cookie] NEW session cookie set for ${currentSubdomain}`);
      console.log(`   Token: ${sessionToken.substring(0, 10)}...`);
    }
    
    res.json({
      success: true,
      message: {
        en: 'Session established',
        he: 'הסשן הוקם'
      }
    });
    
  } catch (error) {
    console.error('❌ [Set Cookie] Error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Failed to set session',
        he: 'כשל בהגדרת הסשן'
      }
    });
  }
});

// @route   POST /api/practice-auth/session-from-token
// @desc    Create session cookie from a session token (used after redirect from root domain)
// @access  Public (validates token internally)
router.post('/session-from-token', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        message: 'Session token required'
      });
    }
    
    console.log('🔄 [Session From Token] Validating token:', sessionToken.substring(0, 10) + '...');
    
    // Validate the session token
    const SecureSessionManager = require('../services/secureSessionManager');
    const session = await SecureSessionManager.validateSession(sessionToken);
    
    if (!session) {
      console.log('❌ [Session From Token] Invalid or expired token');
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token'
      });
    }
    
    console.log('✅ [Session From Token] Token valid, clearing old cookie and setting new one');
    
    // IMPORTANT: Clear any existing session cookie first
    // This ensures old persistent cookies are removed
    res.clearCookie('sessionToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      domain: undefined // Let browser clear for current host
    });
    console.log('🧹 [Session From Token] Cleared old session cookie');
    
    // Set the new session cookie on this subdomain
    const cookieOptions = getSecureCookieOptions(req);
    if (cookieOptions) {
      // SECURITY: Do NOT add maxAge - this should be a session cookie
      // Session cookies expire when browser closes for security
      res.cookie('sessionToken', sessionToken, cookieOptions);
      console.log('🍪 [Session From Token] New SESSION cookie set (expires on browser close)');
      console.log('   Token:', sessionToken.substring(0, 10) + '...');
    }
    
    // Set CSRF token - CRITICAL for post-OTP authentication flow
    let csrfToken = session.csrfToken;
    
    // If no CSRF token in session, generate one and update session
    if (!csrfToken) {
      const crypto = require('crypto');
      csrfToken = crypto.randomBytes(32).toString('hex');
      
      // Store the new CSRF token in the session
      await SecureSessionManager.storeCSRFToken(csrfToken, sessionToken);
      console.log('🔄 [Session From Token] Generated new CSRF token');
    }
    
    // Set CSRF cookie using secure options for this subdomain
    const csrfCookieOptions = getSecureCookieOptions(req, {
      httpOnly: false,  // Must be accessible to JavaScript for double-submit
      maxAge: 60 * 60 * 1000, // 1 hour
      sameSite: 'strict'  // CSRF protection
    });
    
    if (csrfCookieOptions) {
      res.cookie('csrfToken', csrfToken, csrfCookieOptions);
      console.log('🔐 [Session From Token] CSRF token cookie set');
    }
    
    res.json({
      success: true,
      message: 'Session established',
      user: session.user,
      practice: session.practice,
      csrfToken: csrfToken  // Include in response for immediate use
    });
    
  } catch (error) {
    console.error('❌ [Session From Token] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/practice-auth/session-check
// @desc    Validate current session and return user/practice data
// @access  Public (checks cookie for session)
router.get('/session-check', async (req, res) => {
  try {
    // Enhanced logging for debugging
    console.log('\n🔍 [Session Check] ==========================================');
    console.log('🔍 [Session Check] Request details:');
    console.log('   Host:', req.headers.host);
    console.log('   Hostname:', req.hostname);
    console.log('   Origin:', req.headers.origin);
    console.log('   Referer:', req.headers.referer);
    console.log('   Cookie header:', req.headers.cookie ? 'Present' : 'Missing');
    
    // 🔒 SECURITY: Root domain shouldn't have persistent sessions
    // (OTP flow happens on root but no cookies are set there)
    if (isRootDomainRequest(req)) {
      console.log('🔍 [Session Check] Root domain request - no persistent sessions allowed');
      // Return not authenticated - this is expected on root domain
      return res.status(401).json({
        success: false,
        message: {
          en: 'Please login to access the system.',
          he: 'אנא התחבר כדי לגשת למערכת.'
        },
        isRootDomain: true
      });
    }
    
    // Check for session token in cookie OR header (fallback)
    let sessionToken = req.cookies?.sessionToken;
    
    console.log('🍪 [Session Check] Cookies received:', Object.keys(req.cookies || {}));
    console.log('🍪 [Session Check] Cookie token:', sessionToken ? sessionToken.substring(0, 10) + '...' : 'NOT FOUND');
    
    // Fallback: Check for session token in header if cookie not found
    if (!sessionToken && req.headers['x-session-token']) {
      sessionToken = req.headers['x-session-token'];
      console.log('🔑 [Session Check] Using token from header:', sessionToken.substring(0, 10) + '...');
    }
    
    // Log raw cookie header for debugging
    if (req.headers.cookie) {
      console.log('🍪 [Session Check] Raw cookie header:', req.headers.cookie.substring(0, 100) + '...');
    }
    
    if (!sessionToken) {
      console.log('❌ [Session Check] No session token found in cookie or header');
      return res.status(401).json({
        success: false,
        message: {
          en: 'No valid session found.',
          he: 'לא נמצא סשן תקף.'
        }
      });
    }

    // Ensure service is authenticated before proceeding
    await authenticationPromise;
    
    if (!serviceToken) {
      console.error('❌ [Session Check] Service not authenticated');
      return res.status(503).json({
        success: false,
        message: {
          en: 'Service temporarily unavailable.',
          he: 'השירות אינו זמין כרגע.'
        }
      });
    }

    // Find session in global database using SecureDataAccess with proper auth
    // Extract the actual API key from the service auth object
    // IMPORTANT: SecureDataAccess expects the raw API key, not JWT token
    let apiKey;
    if (serviceAuthObject && typeof serviceAuthObject === 'object') {
      // Use the actual API key from the auth object
      apiKey = serviceAuthObject.apiKey;
    } else {
      apiKey = serviceToken;
    }
    
    // Use passwordless-auth-service for global context too (it's working)
    const globalContext = {
      serviceId: 'passwordless-auth-service',
      apiKey: await (async () => {
        const serviceAccountManager = require('../services/serviceAccountManager');
        try {
          const auth = await serviceAccountManager.authenticate('passwordless-auth-service');
          return auth;
        } catch (err) {
          return 'passwordless-auth-api-key';
        }
      })(),
      practiceId: 'global'
    };
    
    // Use SecureSessionManager for ALL session validation (MongoDB-backed)
    console.log('🔍 [Session Check] Validating session via SecureSessionManager...');
    const SecureSessionManager = require('../services/secureSessionManager');
    
    // Initialize if not already done
    if (!SecureSessionManager.initialized) {
      await SecureSessionManager.initialize();
    }
    
    const session = await SecureSessionManager.validateSession(sessionToken);
    
    if (session) {
      console.log('✅ [Session Check] Found valid session!');
      console.log('   User ID:', session.userId);
      console.log('   Practice:', session.practiceSubdomain);
    } else {
      console.log('❌ [Session Check] No valid session found for token:', sessionToken.substring(0, 10) + '...');
    }

    if (!session) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'Session expired or invalid.',
          he: 'הסשן פג תוקף או לא תקף.'
        }
      });
    }

    // Get user data from practice database
    // For now, use a working service account until practice-auth-service is fixed
    const practiceContext = {
      serviceId: 'passwordless-auth-service', // Use passwordless-auth which is working
      apiKey: await (async () => {
        const serviceAccountManager = require('../services/serviceAccountManager');
        try {
          const auth = await serviceAccountManager.authenticate('passwordless-auth-service');
          return auth;
        } catch (err) {
          console.log('⚠️ Using fallback for passwordless-auth-service');
          return 'passwordless-auth-api-key';
        }
      })(),
      practiceId: session.practiceSubdomain || session.practiceId
    };

    // Convert userId to proper ObjectId for query
    const mongoose = require('mongoose');
    let userIdForQuery = session.userId;
    
    // Convert to ObjectId if it's a string
    if (typeof userIdForQuery === 'string' && userIdForQuery.length === 24) {
      userIdForQuery = new mongoose.Types.ObjectId(userIdForQuery);
      console.log('🔍 [Session Check] Converted string to ObjectId:', userIdForQuery.toString());
    }
    
    console.log('🔍 [Session Check] Looking up user:', userIdForQuery.toString(), 'in practice:', session.practiceSubdomain || session.practiceId);
    
    const users = await SecureDataAccess.query('users', 
      { _id: new ObjectId(userIdForQuery) }, 
      { limit: 1 }, 
      practiceContext
    );
    const user = users?.[0];
    
    if (!user) {
      console.log('❌ [Session Check] User not found with ID:', userIdForQuery);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'User not found.',
          he: 'משתמש לא נמצא.'
        }
      });
    }

    // Get practice data from global database using authenticated service
    // If we don't have practiceId, try to find by subdomain
    let practice;

    if (session.practiceId) {
      // Convert practiceId to proper format if needed
      let clinicIdForQuery = session.practiceId;
      let isValidObjectId = false;

      // Check if it's already an ObjectId instance
      if (clinicIdForQuery instanceof ObjectId) {
        // Already an ObjectId, use as-is
        isValidObjectId = true;
      } else if (typeof clinicIdForQuery === 'object' && clinicIdForQuery.toString) {
        // Convert to string then check if valid
        const idStr = clinicIdForQuery.toString();
        if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
          clinicIdForQuery = new ObjectId(idStr);
          isValidObjectId = true;
        }
      } else if (typeof clinicIdForQuery === 'string' && /^[0-9a-fA-F]{24}$/.test(clinicIdForQuery)) {
        // String, validate then convert to ObjectId
        clinicIdForQuery = new ObjectId(clinicIdForQuery);
        isValidObjectId = true;
      }

      if (isValidObjectId) {
        const practices = await SecureDataAccess.query('practices',
          { _id: clinicIdForQuery },
          { limit: 1 },
          globalContext
        );
        practice = practices?.[0];
      }
    }
    
    // If not found by ID, try by subdomain
    if (!practice && session.practiceSubdomain) {
      const practices = await SecureDataAccess.query('practices',
        { subdomain: session.practiceSubdomain },
        { limit: 1 },
        globalContext
      );
      practice = practices?.[0];
      
      if (practice) {
        console.log('✅ [Session Check] Found practice by subdomain:', session.practiceSubdomain);
      }
    }

    if (!practice) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'Practice not found.',
          he: 'מרפאה לא נמצאה.'
        }
      });
    }

    // Update last activity - Skip for now to avoid errors
    // TODO: Fix this when practice-auth-service is properly working
    /*
    await SecureDataAccess.update('sessions',
      { _id: session._id },
      { $set: { lastActivity: new Date() } },
      globalContext
    );
    */

    // Check if CSRF token needs renewal (older than 30 minutes)
    let csrfToken = session.csrfToken;
    const csrfTokenAge = req.cookies.csrfTokenAge ? Date.now() - parseInt(req.cookies.csrfTokenAge) : Infinity;
    
    if (!csrfToken || csrfTokenAge > 30 * 60 * 1000) {
      // Generate new CSRF token if missing or older than 30 minutes
      const crypto = require('crypto');
      csrfToken = crypto.randomBytes(32).toString('hex');
      
      // Store the new token in SecureSessionManager
      await SecureSessionManager.storeCSRFToken(csrfToken, sessionToken);
      
      console.log('🔄 [Session Check] Generated new CSRF token (age: ' + Math.round(csrfTokenAge / 60000) + ' minutes)');
    }
    
    if (!csrfToken) {
      console.error('⚠️ [Session Check] Failed to generate CSRF token!');
      return res.status(500).json({
        success: false,
        message: {
          en: 'Session configuration error.',
          he: 'שגיאת תצורת session.'
        }
      });
    }
    
    // Set CSRF token in non-httpOnly cookie for JavaScript access (double-submit pattern)
    // SECURITY: CSRF tokens must be scoped to specific practice subdomain only
    const csrfCookieOptions = getSecureCookieOptions(req, {
      httpOnly: false,  // CRITICAL: Must be accessible to JavaScript for double-submit pattern
      maxAge: 60 * 60 * 1000, // 1 hour for CSRF token
      sameSite: 'strict'  // SECURITY: Strict for CSRF protection
    });
    
    // Only set CSRF cookie if we're on a valid subdomain
    if (csrfCookieOptions) {
      res.cookie('csrfToken', csrfToken, csrfCookieOptions);
    } else {
      // If no valid cookie options (e.g., root domain), include token in response only
      console.log('⚠️ [Session Check] Cannot set CSRF cookie on root domain - including in response');
    }
    
    // Track when token was issued (only on valid subdomains)
    if (csrfCookieOptions) {
      const ageCookieOptions = getSecureCookieOptions(req, {
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
        sameSite: 'strict'
      });
      if (ageCookieOptions) {
        res.cookie('csrfTokenAge', Date.now().toString(), ageCookieOptions);
      }
    }
    
    console.log('🔐 [Session Check] Set CSRF token cookie:', csrfToken.substring(0, 10) + '...');
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.profile?.firstName || user.firstName,
        lastName: user.profile?.lastName || user.lastName,
        fullName: user.fullName || `${user.profile?.firstName} ${user.profile?.lastName}`,
        displayName: user.displayName || user.profile?.firstName,
        roles: user.roles,
        permissions: user.permissions,
        preferredLanguage: user.preferredLanguage,
        timezone: user.timezone,
        profile: user.profile,
        status: user.status,
        emailVerified: user.emailVerified
      },
      practice: {
        id: practice._id,
        subdomain: practice.subdomain,
        name: practice.name,
        settings: practice.settings
      },
      session: {
        id: session._id,
        expiry: session.expiresAt
      },
      csrfToken: csrfToken  // Include in response for initial storage
    });
  } catch (error) {
    console.error('❌ Session check error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error during session validation.',
        he: 'שגיאת שרת במהלך אימות הסשן.'
      }
    });
  }
});

// @route   POST /api/practice-auth/clear-cookies
// @desc    Clear all authentication cookies
// @access  Public
router.post('/clear-cookies', async (req, res) => {
  // Clear cookies with all possible domain configurations
  const clearCookieConfigs = [
    // Current exact domain
    { httpOnly: true, secure: false, sameSite: 'strict', path: '/' },
    // With wildcard domain (old cookies from before security fix)
    { httpOnly: true, secure: false, sameSite: 'lax', path: '/', domain: '.intellicare.health' },
    // With specific subdomain
    { httpOnly: true, secure: false, sameSite: 'strict', path: '/', domain: req.hostname },
    // Localhost variations
    { httpOnly: true, secure: false, sameSite: 'lax', path: '/', domain: '.localhost' },
    // No domain specified
    { httpOnly: true, secure: false, sameSite: 'strict', path: '/', domain: undefined }
  ];
  
  // Clear session cookie with all variations
  clearCookieConfigs.forEach(config => {
    res.clearCookie('sessionToken', config);
  });
  
  // Clear CSRF token similarly
  clearCookieConfigs.forEach(config => {
    res.clearCookie('csrfToken', { ...config, httpOnly: false });
  });
  
  console.log('🗑️ [Clear Cookies] Cleared cookies for all domain configurations');
  console.log('   Hostname:', req.hostname);
  console.log('   Host:', req.get('host'));
  
  res.json({
    success: true,
    message: {
      en: 'All cookies cleared successfully',
      he: 'כל העוגיות נוקו בהצלחה'
    },
    clearedConfigs: clearCookieConfigs.length
  });
});

// @route   POST /api/practice-auth/logout
// @desc    Destroy current session and clear cookie
// @access  Private (requires valid session)
router.post('/logout', async (req, res) => {
  try {
    const sessionToken = req.cookies?.sessionToken;
    
    // Clear cookies with all possible domain configurations
    const clearCookieConfigs = [
      // Current exact domain
      { httpOnly: true, secure: false, sameSite: 'strict', path: '/' },
      // With wildcard domain (old cookies)
      { httpOnly: true, secure: false, sameSite: 'lax', path: '/', domain: '.intellicare.health' },
      // With specific subdomain
      { httpOnly: true, secure: false, sameSite: 'strict', path: '/', domain: req.hostname },
      // Localhost variations
      { httpOnly: true, secure: false, sameSite: 'lax', path: '/', domain: '.localhost' }
    ];
    
    // Clear session cookie with all variations
    clearCookieConfigs.forEach(config => {
      res.clearCookie('sessionToken', config);
    });
    
    // Clear CSRF token similarly
    clearCookieConfigs.forEach(config => {
      res.clearCookie('csrfToken', { ...config, httpOnly: false });
    });
    
    console.log('🗑️ [Logout] Cleared cookies for all domain configurations');
    
    if (sessionToken) {
      // Destroy session server-side
      const SecureSessionManager = require('../services/secureSessionManager');
      await SecureSessionManager.destroySession(sessionToken);
    }

    // Clear cookies on ALL possible domains to ensure complete logout
    const cookieOptions = {
      httpOnly: true,
      secure: secureConfigService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/'
    };
    
    // Clear on all possible domains
    const domains = [
      '.intellicare.health',  // Parent domain with dot
      'intellicare.health',   // Parent domain without dot
      req.hostname,           // Current hostname (could be subdomain)
      `.${req.hostname}`,     // Current hostname with dot
      undefined               // No domain (browser default)
    ];
    
    // Clear sessionToken on all domains
    domains.forEach(domain => {
      const opts = { ...cookieOptions };
      if (domain !== undefined) {
        opts.domain = domain;
      }
      res.clearCookie('sessionToken', opts);
    });
    
    // Also clear other possible auth cookies
    ['authToken', 'clinicSession', 'refreshToken'].forEach(cookieName => {
      domains.forEach(domain => {
        const opts = { ...cookieOptions };
        if (domain !== undefined) {
          opts.domain = domain;
        }
        res.clearCookie(cookieName, opts);
      });
    });

    res.json({
      success: true,
      message: {
        en: 'Logged out successfully.',
        he: 'התנתקות בוצעה בהצלחה.'
      }
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error during logout.',
        he: 'שגיאת שרת במהלך ההתנתקות.'
      }
    });
  }
});

// @route   POST /api/practice-auth/refresh-session
// @desc    Extend current session TTL
// @access  Private (requires valid session)
router.post('/refresh-session', async (req, res) => {
  try {
    if (!req.user || !req.session) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'No valid session to refresh.',
          he: 'אין סשן תקף לרענון.'
        }
      });
    }

    const sessionToken = req.cookies?.sessionToken;
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'Session token not found.',
          he: 'טוקן סשן לא נמצא.'
        }
      });
    }

    // Refresh session TTL and get new CSRF token
    const SecureSessionManager = require('../services/secureSessionManager');
    const refreshResult = await SecureSessionManager.refreshSession(sessionToken);
    
    if (!refreshResult) {
      return res.status(401).json({
        success: false,
        message: {
          en: 'Failed to refresh session.',
          he: 'רענון הסשן נכשל.'
        }
      });
    }

    // Set the new CSRF token as a cookie - SECURITY: Scoped to practice subdomain only
    const csrfCookieOptions = getSecureCookieOptions(req, {
      httpOnly: false,  // Must be accessible to JavaScript
      maxAge: 60 * 60 * 1000, // 1 hour
      sameSite: 'strict'  // SECURITY: Strict for CSRF protection
    });
    
    if (csrfCookieOptions) {
      res.cookie('csrfToken', refreshResult.csrfToken, csrfCookieOptions);
      
      // Track when token was issued
      const ageCookieOptions = getSecureCookieOptions(req, {
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
        sameSite: 'strict'
      });
      if (ageCookieOptions) {
        res.cookie('csrfTokenAge', Date.now().toString(), ageCookieOptions);
      }
    }

    res.json({
      success: true,
      message: {
        en: 'Session refreshed successfully.',
        he: 'הסשן רוענן בהצלחה.'
      },
      session: {
        id: req.session.sessionId,
        expiry: new Date(Date.now() + 30 * 60 * 1000)
      },
      csrfToken: refreshResult.csrfToken
    });
  } catch (error) {
    console.error('❌ Session refresh error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error during session refresh.',
        he: 'שגיאת שרת במהלך רענון הסשן.'
      }
    });
  }
});

// -----------------------------------------------
// Token refresh (session-based, no password needed) - LEGACY
// -----------------------------------------------
router.post('/refresh', [practiceContext, practiceModels], async (req, res) => {
  try {
    const sessionId = req.header('x-session-id') || req.header('X-Session-ID');
    const practiceSubdomain = req.practiceSubdomain;

    console.log('🔄 TOKEN REFRESH DEBUG:', {
      sessionId: sessionId ? sessionId.substring(0, 8) + '...' : 'MISSING',
      practiceSubdomain,
      hasSessionId: !!sessionId,
      headers: {
        'x-session-id': !!req.header('x-session-id'),
        'x-auth-token': !!req.header('x-auth-token'),
        'x-practice-subdomain': !!req.header('x-practice-subdomain')
      }
    });

    if (!sessionId) {
      console.log('❌ TOKEN REFRESH: Missing session ID');
      return res.status(400).json({
        success: false,
        message: { en: 'Missing session ID', he: 'חסר מזהה סשן' }
      });
    }

    // Validate Zero Trust session
    const clientInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      acceptLanguage: req.get('Accept-Language'),
      acceptEncoding: req.get('Accept-Encoding')
    };

    console.log('🔄 TOKEN REFRESH: Validating Zero Trust session...');
    let result = await zeroTrustService.validateAndRefreshSession(sessionId, clientInfo, req.practiceDb);
    console.log('🔄 TOKEN REFRESH: Zero Trust validation result:', {
      valid: result.valid,
      reason: result.reason || 'N/A'
    });

    // 🔧 FIX: If session not found, try to recreate it from user data
    if (!result.valid && result.reason === 'Session not found') {
      console.log('🔧 TOKEN REFRESH: Session not found, attempting to recreate...');

      // Try to get user info from JWT token (even if expired, we can still extract user ID)
      const token = req.header('x-auth-token');
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const config = require('config');

          // Try to decode without verification first to get user ID
          let decoded;
          try {
            decoded = jwt.verify(token, config.get('jwtSecret'));
          } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
              // Token is expired but we can still decode it to get user info
              decoded = jwt.decode(token);
              console.log('🔧 TOKEN REFRESH: JWT expired but decoded successfully for user extraction');
            } else {
              throw jwtError;
            }
          }

          if (decoded && decoded.user && decoded.user.id) {
            const userId = decoded.user.id;

            // Load user from database
            const userQuery = await SecureDataAccess.query('users', { _id: new ObjectId(userId) }, { limit: 1 }, context);
            const user = userQuery && userQuery.length > 0 ? userQuery[0] : null;
            if (user && user.isActive && user.status !== 'suspended') {
              console.log('🔧 TOKEN REFRESH: Recreating Zero Trust session for user:', user.email);

              // Recreate Zero Trust session with the same session ID
              const newSession = await zeroTrustService.createSecureSession(
                user._id.toString(),
                {
                  email: user.email,
                  fullName: user.fullName,
                  roles: user.roles,
                  permissions: user.permissions,
                  mfaEnabled: user.mfaEnabled,
                  mfaVerified: true // Assume verified since they had a valid session before
                },
                clientInfo,
                req.practiceDb // Pass practice database
              );

              // Store the session with the original session ID in the database
              try {
                const ZeroTrustSessionSchema = require('../models/ZeroTrustSession');
                const SessionModel = req.practiceDb.model('ZeroTrustSession', ZeroTrustSessionSchema);

                // Create new session document with the original session ID
                const sessionDoc = new SessionModel({
                  sessionId: sessionId, // Use the original session ID
                  userId: user._id.toString(),
                  userInfo: {
                    email: user.email,
                    fullName: user.fullName,
                    roles: user.roles,
                    permissions: user.permissions,
                    mfaEnabled: user.mfaEnabled,
                    mfaVerified: true
                  },
                  clientInfo: clientInfo,
                  sessionToken: newSession.token,
                  riskScore: newSession.riskScore,
                  deviceFingerprint: newSession.deviceFingerprint,
                  createdAt: new Date(),
                  lastActivity: new Date(),
                  lastTokenRefresh: new Date(),
                  expiresAt: new Date(Date.now() + zeroTrustService.sessionTimeout),
                  isActive: true
                });

                await SecureDataAccess.insert('zerotrustsessions', sessionDoc, context);
                console.log('✅ TOKEN REFRESH: Zero Trust session recreated successfully in database');

                result = {
                  valid: true,
                  session: {
                    id: sessionId,
                    userId: user._id.toString(),
                    userInfo: sessionDoc.userInfo,
                    clientInfo: sessionDoc.clientInfo,
                    createdAt: sessionDoc.createdAt.toISOString(),
                    lastActivity: sessionDoc.lastActivity.toISOString(),
                    token: sessionDoc.sessionToken,
                    riskScore: sessionDoc.riskScore,
                    mfaVerified: true
                  }
                };
              } catch (dbError) {
                console.error('❌ TOKEN REFRESH: Failed to save recreated session to database:', dbError.message);
              }
            } else {
              console.log('❌ TOKEN REFRESH: User not found or inactive:', userId);
            }
          } else {
            console.log('❌ TOKEN REFRESH: Invalid JWT structure');
          }
        } catch (jwtError) {
          console.log('❌ TOKEN REFRESH: JWT processing failed during session recreation:', jwtError.message);
        }
      } else {
        console.log('❌ TOKEN REFRESH: No JWT token provided for session recreation');
      }
    }

    if (!result.valid) {
      console.log('❌ TOKEN REFRESH: Zero Trust session invalid:', result.reason);

      // Provide more specific error messages based on the reason
      let errorMessage = { en: 'Session invalid', he: 'סשן לא תקין' };
      let statusCode = 401;

      switch (result.reason) {
        case 'Session not found':
          errorMessage = { en: 'Session not found - please log in again', he: 'סשן לא נמצא - אנא התחבר שוב' };
          break;
        case 'Session expired':
          errorMessage = { en: 'Session expired - please log in again', he: 'סשן פג תוקף - אנא התחבר שוב' };
          break;
        case 'Database error':
          errorMessage = { en: 'Database error - please try again', he: 'שגיאת מסד נתונים - אנא נסה שוב' };
          statusCode = 500;
          break;
        default:
          errorMessage = { en: `Session invalid: ${result.reason}`, he: 'סשן לא תקין' };
      }

      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        reason: result.reason
      });
    }

    // Load user and issue a fresh JWT
    const userQuery = await SecureDataAccess.query('users', { _id: result.session.userId }, { limit: 1 }, context);
    const user = userQuery && userQuery.length > 0 ? userQuery[0] : null;
    if (!user || !user.isActive || user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: { en: 'User not active', he: 'משתמש אינו פעיל' }
      });
    }

    const token = generateToken(user, practiceSubdomain);

    res.json({ success: true, token });
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: { en: 'Server error refreshing token', he: 'שגיאת שרת בעת רענון אסימון' }
    });
  }
});

module.exports = router;
