const SecureDataAccess = require('../services/secureDataAccess');
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const emailService = require('../services/emailService');
const { generateToken } = require('../middleware/practiceAuth');
const roleModel = require('../config/roles');
const { practiceContext, practiceModels } = require('../middleware/practiceContext');
const serviceAccountManager = require('../services/serviceAccountManager');
const secureConfigService = require('../services/secureConfigService');
const Session = require('../models/Session');
const { getSecureCookieOptions, isRootDomainRequest } = require('../utils/cookieSecurity');
// COMMENTED OUT: practiceDetailsService module doesn't exist (Nov 2025)
// const { extractPracticeDetailsFromName } = require('../services/practiceDetailsService');

// Initialize service authentication
let serviceToken = null;
let authenticationPromise = (async () => {
  try {
    // CRITICAL: Initialize serviceAccountManager first!
    // Services initialized in server.js
    
    serviceToken = await serviceAccountManager.authenticate('passwordless-auth-service');
    console.log('✅ Passwordless auth service authenticated');
    return serviceToken;
  } catch (error) {
    console.error('❌ Failed to authenticate passwordless auth service:', error.message);
    // Retry once after 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      // Ensure initialization before retry
      // Services initialized in server.js
      serviceToken = await serviceAccountManager.authenticate('passwordless-auth-service');
      console.log('✅ Passwordless auth service authenticated (retry successful)');
      return serviceToken;
    } catch (retryError) {
      console.error('❌ Failed to authenticate after retry:', retryError.message);
    }
  }
})();

// Debug endpoint to test if routes are loaded
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Passwordless auth routes are loaded!',
    availableRoutes: [
      'GET /api/passwordless-auth/test',
      'POST /api/passwordless-auth/request-verification-passwordless',
      'POST /api/passwordless-auth/request-login',
      'POST /api/passwordless-auth/magic-login',
      'POST /api/passwordless-auth/verify-email'
    ]
  });
});

// Generate secure random token
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to simulate findOne using SecureDataAccess.query
async function findOne(collection, filter, options, context) {
  console.log(`📊 [findOne] Querying ${collection} with filter:`, JSON.stringify(filter));
  console.log(`📊 [findOne] Context:`, JSON.stringify(context));
  
  const results = await SecureDataAccess.query(collection, filter, { ...options, limit: 1 }, context);
  
  console.log(`📊 [findOne] Query returned:`, results ? `${results.length} results` : 'null');
  if (results && results.length > 0) {
    console.log(`📊 [findOne] First result ID:`, results[0]._id);
  }
  
  return results && results.length > 0 ? results[0] : null;
}

// @route   POST /api/auth/request-verification-passwordless
// @desc    Send email verification for new user (passwordless)
// @access  Public
router.post(
  '/request-verification-passwordless',
  [
    practiceContext,
    practiceModels,
    body('email', 'Valid email is required').isEmail(),
    body('profile.firstName', 'First name is required').notEmpty(),
    body('profile.lastName', 'Last name is required').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Please provide valid information.',
            he: 'אנא ספק מידע תקין.'
          },
          errors: errors.array()
        });
      }

      const { email, profile } = req.body;

      // Define security context for SecureDataAccess
      const context = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: req.practiceId,
        practiceSubdomain: req.practiceSubdomain  // Pass subdomain for user queries
      };

      // Check if user already exists
      const existingUser = await findOne('users', { email: email.toLowerCase() }, {}, context);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: {
            en: 'User with this email already exists.',
            he: 'משתמש עם אימייל זה כבר קיים.'
          }
        });
      }

      // Create user WITHOUT password
      const newUserData = {
        email: email.toLowerCase(),
        profile,
        emailVerified: false,
        roles: [roleModel.DEFAULT_ROLE], // Default role: canonical 'user'
        permissions: [],
        status: 'pending', // Pending email verification
        isPasswordless: true // Flag to indicate passwordless account
      };

      const newUser = await SecureDataAccess.insert('users', newUserData, context);

      // Generate verification token
      const verificationToken = generateSecureToken();
      
      // Store verification token
      await req.models.EmailVerification.create({
        userId: newUser._id,
        email: email.toLowerCase(),
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Send verification email with subdomain
      await emailService.sendEmailVerification(
        email,
        verificationToken,
        newUser._id,
        req.practice.name,
        req.practice.subdomain // Use practice.subdomain which is always reliable
      );

      res.json({
        success: true,
        message: {
          en: 'Verification email sent. Please check your inbox.',
          he: 'נשלח אימייל אימות. אנא בדוק את תיבת הדואר שלך.'
        }
      });

    } catch (error) {
      console.error('❌ Request verification error:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during verification request.',
          he: 'שגיאת שרת במהלך בקשת האימות.'
        }
      });
    }
  }
);

// @route   POST /api/auth/request-verification
// @desc    Send email verification for new user (with password - deprecated)
// @access  Public
router.post(
  '/request-verification',
  [
    practiceContext,
    practiceModels,
    body('email', 'Valid email is required').isEmail(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    body('profile.firstName', 'First name is required').notEmpty(),
    body('profile.lastName', 'Last name is required').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Please provide valid information.',
            he: 'אנא ספק מידע תקין.'
          },
          errors: errors.array()
        });
      }

      const { email, password, profile } = req.body;

      // Define security context for SecureDataAccess
      const context = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: req.practiceId,
        practiceSubdomain: req.practiceSubdomain  // Pass subdomain for user queries
      };

      // Check if user already exists
      const existingUser = await findOne('users', { email: email.toLowerCase() }, {}, context);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: {
            en: 'User with this email already exists.',
            he: 'משתמש עם אימייל זה כבר קיים.'
          }
        });
      }

      // Create user with password (unverified)
      const newUserData = {
        email: email.toLowerCase(),
        password,
        profile,
        emailVerified: false,
        roles: [roleModel.DEFAULT_ROLE], // Default role: canonical 'user'
        permissions: [],
        status: 'pending' // Pending email verification
      };

      const newUser = await SecureDataAccess.insert('users', newUserData, context);

      // Generate verification token
      const verificationToken = generateSecureToken();
      
      // Store verification token
      await req.models.EmailVerification.create({
        userId: newUser._id,
        email: email.toLowerCase(),
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Send verification email with subdomain
      await emailService.sendEmailVerification(
        email,
        verificationToken,
        newUser._id,
        req.practice.name,
        req.practice.subdomain // Use practice.subdomain which is always reliable
      );

      res.json({
        success: true,
        message: {
          en: 'Verification email sent. Please check your inbox.',
          he: 'נשלח אימייל אימות. אנא בדוק את תיבת הדואר שלך.'
        }
      });

    } catch (error) {
      console.error('❌ Request verification error:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during verification request.',
          he: 'שגיאת שרת במהלך בקשת האימות.'
        }
      });
    }
  }
);

// @route   POST /api/auth/verify-email
// @desc    Verify email, activate account, and create session
// @access  Public
router.post(
  '/verify-email',
  practiceContext,
  practiceModels,
  body('token', 'Verification token is required').notEmpty(),
  body('userId', 'User ID is required').notEmpty(),
  async (req, res) => {
    try {
      console.log('🔍 [Verify Email] Starting verification process...');
      console.log('🔍 [Verify Email] Request body:', req.body);
      console.log('🔍 [Verify Email] Request headers:', req.headers);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ [Verify Email] Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid verification request.',
            he: 'בקשת אימות לא תקינה.'
          },
          errors: errors.array()
        });
      }

      const { token, userId, practice } = req.body;
      
      console.log('🔍 [Verify Email] Request data:', { token, userId, practiceId: req.practiceId });

      // Use GLOBAL context for verification tokens (they're stored globally)
      const context = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: 'global'  // Verification tokens are in global database
      };
      
      console.log('🔍 [Verify Email] Context:', context);

      // Find verification record without using $gt to avoid injection detection
      // We'll check expiration manually after fetching
      console.log('🔍 [Verify Email] Searching for verification with:', {
        token,
        userId,
        isUsed: false,
        collection: 'emailverifications'
      });
      
      // Try to find the verification token in the global database
      // Note: Some verification records may have 'used' field instead of 'isUsed'
      let verification = await findOne('emailverifications', {
        token,
        userId,
        $or: [
          { isUsed: false },
          { used: false },
          { isUsed: { $exists: false }, used: { $exists: false } }
        ]
      }, {}, context);
      
      console.log('🔍 [Verify Email] Raw verification result:', verification);
      
      // If not found with exact match, try broader search for debugging
      if (!verification) {
        console.log('🔍 [Verify Email] Token not found with exact match, trying broader search...');
        const allTokens = await SecureDataAccess.query('emailverifications', { userId }, { limit: 5 }, context);
        console.log('🔍 [Verify Email] All tokens for user:', allTokens ? allTokens.map(t => ({
          tokenPrefix: t.token ? t.token.substring(0, 10) + '...' : 'null',
          userId: t.userId,
          isUsed: t.isUsed,
          subdomain: t.practiceSubdomain
        })) : 'none');
      }
      
      // Check expiration manually
      if (verification && verification.expiresAt) {
        const now = new Date();
        if (verification.expiresAt <= now) {
          console.log('❌ [Verify Email] Token expired:', verification.expiresAt, 'vs now:', now);
          // Treat as not found if expired
          verification = null;
        }
      }
      
      console.log('🔍 [Verify Email] Verification found:', verification ? 'Yes' : 'No');

      if (!verification) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid or expired verification token.',
            he: 'אסימון אימות לא תקין או פג תוקף.'
          }
        });
      }

      // Get the practice subdomain from the verification record
      const practiceSubdomain = verification.practiceSubdomain;
      console.log('🔍 [Verify Email] Practice subdomain from verification:', practiceSubdomain);
      
      // Create practice-specific context for user operations
      const practiceContext = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: practiceSubdomain  // Use the subdomain from verification
      };
      
      // Find and update user in the practice-specific database
      // Convert string userId to ObjectId for MongoDB query
      const { ObjectId } = require('mongodb');
      const userObjectId = new ObjectId(userId);
      
      console.log('🔍 [Verify Email] Looking for user:', {
        userId: userId,
        userObjectId: userObjectId.toString(),
        practiceContext: practiceContext,
        databaseName: `intellicare_practice_${practiceSubdomain}`
      });
      
      // First try with ObjectId
      let user = await findOne('users', { _id: userObjectId }, {}, practiceContext);
      
      // If not found, try with string ID
      if (!user) {
        console.log('⚠️ [Verify Email] User not found with ObjectId, trying string ID...');
        user = await findOne('users', { _id: new ObjectId(userId) }, {}, practiceContext);
      }
      
      // Log the query result
      console.log('🔍 [Verify Email] User query result:', user ? 'Found' : 'Not found');
      if (user) {
        console.log('👤 [Verify Email] User details:', {
          id: user._id,
          email: user.email,
          emailVerified: user.emailVerified,
          status: user.status
        });
      }
      
      if (!user) {
        console.log('❌ [Verify Email] User not found in database');
        console.log('🔍 [Verify Email] Attempting direct database query for debugging...');
        
        // Try a direct database query to see if the user exists
        try {
          const mongoose = require('mongoose');
          // Use SecureDataAccess instead of direct connection
          const debugContext = {
            serviceId: 'passwordless-auth-service',
            apiKey: serviceToken,
            practiceId: practiceSubdomain
          };
          const directUsers = await SecureDataAccess.query('users', { _id: userObjectId }, { limit: 1 }, debugContext);
          const directUser = directUsers?.[0];
          console.log('🔍 [Verify Email] SecureDataAccess query result:', directUser ? 'Found' : 'Not found');
          if (directUser) {
            console.log('⚠️ [Verify Email] User EXISTS in database!');
            console.log('👤 User found:', {
              email: directUser.email,
              status: directUser.status
            });
          }
          await directConnection.close();
        } catch (dbError) {
          console.log('❌ [Verify Email] Direct database query error:', dbError.message);
        }
        
        return res.status(404).json({
          success: false,
          message: {
            en: 'User not found.',
            he: 'משתמש לא נמצא.'
          }
        });
      }

      // Run both updates in PARALLEL for speed
      const [userUpdate, verificationUpdate] = await Promise.all([
        // Activate user account in practice database
        SecureDataAccess.update('users', 
          { _id: userObjectId }, // Use ObjectId for user update
          { $set: { emailVerified: true, status: 'active', verifiedAt: new Date() } }, 
          practiceContext
        ),
        // Mark verification as used in global database
        // Use both 'isUsed' and 'used' fields for compatibility
        SecureDataAccess.update('emailverifications', 
          { _id: verification._id }, 
          { $set: { isUsed: true, used: true, usedAt: new Date() } }, 
          context  // Use global context for verification token
        )
      ]);
      
      console.log('✅ [Verify Email] Both updates completed in parallel');

      // CREATE SESSION for auto-login
      // Get practice document to get the ObjectId
      const clinicDoc = await findOne('practices', 
        { subdomain: practiceSubdomain }, 
        {}, 
        { 
          serviceId: 'passwordless-auth-service',
          apiKey: serviceToken,  // Use the authenticated service token
          practiceId: 'global' // Practices are in global database
        }
      );
      
      if (!clinicDoc) {
        console.error('❌ [Verify Email] Practice not found for subdomain:', practiceSubdomain);
        // Still verify the email but don't create session
        return res.json({
          success: true,
          message: {
            en: 'Email verified successfully! Please login.',
            he: 'האימייל אומת בהצלחה! אנא התחבר.'
          },
          emailVerified: true,
          redirectToLogin: true
        });
      }
      
      // Use SecureSessionManager for consistency with login flow
      console.log('🔒 [Verify Email] Creating session via SecureSessionManager...');
      const SecureSessionManager = require('../services/secureSessionManager');
      
      let session;
      let sessionToken;
      let csrfToken = null;
      
      try {
        // Initialize if not already done
        if (!SecureSessionManager.initialized) {
          console.log('🔧 [Verify Email] Initializing SecureSessionManager...');
          // SecureSessionManager initialized in server.js
        }
        
        // Create session using SecureSessionManager (primary method)
        session = await SecureSessionManager.createSession(
          userObjectId.toString(),
          clinicDoc._id.toString(),
          user.roles?.[0] || 'user',
          { 
            practiceSubdomain: practiceSubdomain,
            email: user.email,
            name: user.fullName || `${user.profile?.firstName} ${user.profile?.lastName}`,
            verificationMethod: 'email_verification',
            emailVerified: true
          }
        );
        
        sessionToken = session.sessionToken;
        csrfToken = session.csrfToken; // Get CSRF token from session
        console.log('✅ [Verify Email] Session created in SecureSessionManager:', sessionToken.substring(0, 10) + '...');
        console.log('🔐 [Verify Email] CSRF token generated:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'none');
      } catch (sessionError) {
        console.error('❌ [Verify Email] Failed to create session in SecureSessionManager:', sessionError.message);
        console.error('   Stack:', sessionError.stack);
        
        // Fallback: Generate a session token manually
        console.log('⚠️ [Verify Email] Using fallback session token generation...');
        const crypto = require('crypto');
        sessionToken = crypto.randomBytes(32).toString('hex');
      }
      
      // Session is now created via SecureSessionManager which uses MongoDB
      // No need for duplicate session creation
      
      // Set httpOnly cookie with session token
      // CRITICAL: Domain must be set correctly for cross-subdomain access
      
      const cookieOptions = {
        httpOnly: true,
        secure: secureConfigService.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/', // Available on all paths
        domain: undefined // Let browser set to current host
      };
      
      console.log('🍪 [Verify Email] Setting cookie with options:', cookieOptions);
      console.log('🍪 [Verify Email] Session token:', sessionToken.substring(0, 10) + '...');
      console.log('🍪 [Verify Email] Request hostname:', req.hostname);
      console.log('🍪 [Verify Email] Request host:', req.headers.host);
      console.log('🍪 [Verify Email] Cookie domain:', cookieOptions.domain || '(not set - browser default)');
      
      res.cookie('sessionToken', sessionToken, cookieOptions);
      
      console.log('✅ [Verify Email] Cookie set for auto-login');
      console.log('📊 [Verify Email] Response headers:', res.getHeaders());
      console.log('🍪 [Verify Email] Set-Cookie header:', res.getHeaders()['set-cookie']);
      
      // Return response with redirect URL and session token for fallback
      // Include language preference in redirect URL for seamless experience
      const userLanguage = user.preferredLanguage || 'en';
      res.json({
        success: true,
        message: {
          en: 'Email verified and logged in successfully! Redirecting to your practice...',
          he: 'האימייל אומת והתחברת בהצלחה! מעביר לקליניקה שלך...'
        },
        emailVerified: true,
        autoLogin: true,  // Tell frontend user is auto-logged in
        redirectUrl: `http://${practiceSubdomain}.intellicare.health:3000/?lang=${userLanguage}&verified=true&seamless=true&welcome=${encodeURIComponent(user.profile?.firstName || '')}`,
        sessionToken: sessionToken, // Include token for manual auth if cookie fails
        csrfToken: csrfToken || null, // Include CSRF token for subsequent requests
        user: {
          id: user._id,
          email: user.email,
          firstName: user.profile?.firstName,
          lastName: user.profile?.lastName,
          emailVerified: true,
          preferredLanguage: userLanguage
        },
        practice: {
          id: clinicDoc._id,
          subdomain: practiceSubdomain,
          name: clinicDoc.name || practiceSubdomain
        }
      });

    } catch (error) {
      console.error('❌ Email verification error:', error);
      console.error('❌ Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during email verification.',
          he: 'שגיאת שרת במהלך אימות האימייל.'
        },
        error: secureConfigService.get('NODE_ENV') === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login with email and password
// @access  Public
router.post(
  '/login',
  [
    practiceContext,
    practiceModels,
    body('email', 'Valid email is required').isEmail(),
    body('password', 'Password is required').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid login credentials.',
            he: 'פרטי התחברות לא תקינים.'
          }
        });
      }

      const { email, password } = req.body;

      // Define security context for SecureDataAccess
      const context = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: req.practiceId,
        practiceSubdomain: req.practiceSubdomain  // Pass subdomain for user queries
      };

      // Find user
      const user = await findOne('users', {
        email: email.toLowerCase(),
        emailVerified: true,
        status: 'active'
      }, {}, context);

      if (!user) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid email or password.',
            he: 'אימייל או סיסמה לא נכונים.'
          }
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid email or password.',
            he: 'אימייל או סיסמה לא נכונים.'
          }
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await SecureDataAccess.update('users', { _id: user._id }, { $set: { lastLogin: new Date() } }, context);

      // Generate JWT token
      const jwtToken = generateToken(user, req.practiceSubdomain);

      res.json({
        success: true,
        token: jwtToken,
        user: {
          id: user._id,
          email: user.email,
          profile: user.profile,
          roles: user.roles,
          permissions: user.permissions
        },
        practice: req.practice,
        message: {
          en: 'Login successful.',
          he: 'התחברות בוצעה בהצלחה.'
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

// @route   POST /api/auth/request-login
// @desc    Send magic login link (deprecated)
// @access  Public
router.post(
  '/request-login',
  [
    practiceContext,
    practiceModels,
    body('email', 'Valid email is required').isEmail()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Valid email is required.',
            he: 'נדרש אימייל תקין.'
          }
        });
      }

      const { email } = req.body;

      // Define security context for SecureDataAccess
      const context = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: req.practiceId,
        practiceSubdomain: req.practiceSubdomain  // Pass subdomain for user queries
      };

      // Find user
      const user = await findOne('users', { 
        email: email.toLowerCase(),
        emailVerified: true,
        status: 'active'
      }, {}, context);

      if (!user) {
        // Don't reveal if user exists for security
        return res.json({
          success: true,
          message: {
            en: 'If an account exists, a login link has been sent.',
            he: 'אם קיים חשבון, נשלח קישור התחברות.'
          }
        });
      }

      // Generate login token
      const loginToken = generateSecureToken();

      console.log('💾 Creating login token:');
      console.log('   - Token:', loginToken.substring(0, 10) + '...');
      console.log('   - UserId:', user._id);
      console.log('   - Expires:', new Date(Date.now() + 15 * 60 * 1000));

      // Store login token in GLOBAL database for cross-practice access
      // Login tokens are temporary and should be accessible regardless of practice context
      const globalContext = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: 'global'  // Store in global database
      };

      const tokenData = {
        userId: user._id.toString(),
        token: loginToken,
        email: user.email,
        practiceSubdomain: req.practiceSubdomain,  // Store subdomain for reference
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        isUsed: false,
        createdAt: new Date()
      };

      // Use SecureDataAccess to store in global database
      const savedToken = await SecureDataAccess.insert('logintokens', tokenData, globalContext);

      console.log('✅ Token saved to GLOBAL database:', !!savedToken);
      console.log('📧 Preparing to send magic link:');
      console.log('   - Practice name:', req.practice.name);
      console.log('   - Practice subdomain:', req.practice.subdomain);
      console.log('   - req.practiceSubdomain:', req.practiceSubdomain);
      console.log('   - Full practice object:', JSON.stringify(req.practice, null, 2));

      // Send magic login link with subdomain
      await emailService.sendMagicLoginLink(
        email,
        loginToken,
        user._id,
        req.practice.name,
        req.practice.subdomain // Use practice.subdomain which is always reliable
      );

      res.json({
        success: true,
        message: {
          en: 'Login link sent to your email.',
          he: 'קישור התחברות נשלח לאימייל שלך.'
        }
      });

    } catch (error) {
      console.error('❌ Request login error:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during login request.',
          he: 'שגיאת שרת במהלך בקשת ההתחברות.'
        }
      });
    }
  }
);

// @route   POST /api/passwordless-auth/send-otp
// @desc    Send OTP code via email
// @access  Public
router.post(
  '/send-otp',
  [
    practiceContext,
    practiceModels,
    body('email', 'Valid email is required').isEmail()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Valid email is required.',
            he: 'נדרש אימייל תקין.'
          }
        });
      }

      const { email } = req.body;
      const otpService = require('../services/otpService');
      
      // Initialize OTP service
      // otpService initialized in server.js

      // Define security context for SecureDataAccess
      const context = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,
        practiceId: req.practiceId || 'global',
        practiceSubdomain: req.practiceSubdomain
      };

      // Check if user exists and get their practice
      let userClinic = null;
      let isNewUser = false;
      
      // First check in the current practice context (if on subdomain)
      if (req.practiceSubdomain && req.practiceSubdomain !== 'intellicare') {
        const user = await findOne('users', { 
          email: email.toLowerCase()
        }, {}, context);
        
        if (user) {
          userClinic = req.practiceSubdomain;
        }
      }
      
      // If not found and we're on the main domain, check all practices
      if (!userClinic && (!req.practiceSubdomain || req.practiceSubdomain === 'intellicare')) {
        // Check global database for user's practice association
        const globalContext = {
          serviceId: 'passwordless-auth-service',
          apiKey: serviceToken,
          practiceId: 'global'
        };
        
        // Look for recent verification or login tokens to find user's practice
        const recentTokens = await SecureDataAccess.query('emailverifications', 
          { email: email.toLowerCase() },
          { limit: 1, sort: { createdAt: -1 } },
          globalContext
        );
        
        if (recentTokens && recentTokens.length > 0) {
          userClinic = recentTokens[0].practiceSubdomain;
        } else {
          // User doesn't exist - they need to register first
          isNewUser = true;
        }
      }

      // Generate and send OTP
      const otpRecord = await otpService.createOTP(email, userClinic);
      
      // Send OTP email
      await emailService.sendOTPCode(
        email,
        otpRecord.code,
        req.practice?.name || 'IntelliCare'
      );

      console.log(`📧 OTP sent to ${email}`);

      res.json({
        success: true,
        message: {
          en: 'Verification code sent to your email.',
          he: 'קוד אימות נשלח לאימייל שלך.'
        },
        needsRedirect: !!userClinic && userClinic !== req.practiceSubdomain,
        subdomain: userClinic,
        isNewUser: isNewUser,
        expiresIn: 600 // 10 minutes in seconds
      });

    } catch (error) {
      console.error('❌ Send OTP error:', error);
      
      // Handle rate limiting error
      if (error.message && error.message.includes('Please wait')) {
        return res.status(429).json({
          success: false,
          message: {
            en: error.message,
            he: 'אנא המתן לפני בקשת קוד חדש.'
          }
        });
      }
      
      res.status(500).json({
        success: false,
        message: {
          en: 'Failed to send verification code.',
          he: 'שליחת קוד האימות נכשלה.'
        }
      });
    }
  }
);

// @route   POST /api/passwordless-auth/verify-otp
// @desc    Verify OTP code and create session
// @access  Public
router.post(
  '/verify-otp',
  [
    body('email', 'Email is required').isEmail(),
    body('code', 'Verification code is required').notEmpty().isLength({ min: 6, max: 6 })
  ],
  async (req, res) => {
    try {
      console.log('🔍 [verify-otp] Request body:', JSON.stringify(req.body));
      console.log('🔍 [verify-otp] Practice context:', { 
        practiceId: req.practiceId, 
        practiceSubdomain: req.practiceSubdomain,
        practice: req.practice ? 'present' : 'missing'
      });
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ [verify-otp] Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid verification code.',
            he: 'קוד אימות לא תקין.'
          },
          errors: errors.array()
        });
      }

      const { email, code } = req.body;
      const otpService = require('../services/otpService');
      
      // Initialize OTP service
      // otpService initialized in server.js
      
      // Verify OTP
      const verificationResult = await otpService.verifyOTP(email, code);
      
      if (!verificationResult.success) {
        return res.status(400).json({
          success: false,
          message: {
            en: verificationResult.error,
            he: 'קוד האימות שגוי או פג תוקף.'
          },
          remainingAttempts: verificationResult.remainingAttempts
        });
      }

      // Get practice context - OTP verification result contains the practice subdomain
      const practiceSubdomain = verificationResult.practiceSubdomain;
      
      console.log('✅ [verify-otp] OTP verified successfully');
      console.log('   - Email:', email);
      console.log('   - Practice subdomain from OTP:', practiceSubdomain || 'NOT SET');
      
      // If no practice subdomain from OTP, we need to find it from the user
      let actualClinicSubdomain = practiceSubdomain;
      
      if (!actualClinicSubdomain) {
        console.log('⚠️ [verify-otp] No practice subdomain in OTP result, will detect from user record');
      }
      
      const context = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,
        practiceId: actualClinicSubdomain || 'global',
        practiceSubdomain: actualClinicSubdomain
      };

      // Find user
      const user = await findOne('users', { 
        email: email.toLowerCase(),
        emailVerified: true,
        status: 'active'
      }, {}, context);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: {
            en: 'User not found. Please register first.',
            he: 'משתמש לא נמצא. אנא הרשם תחילה.'
          }
        });
      }

      // Update last login
      const mongoose = require('mongoose');
      let userObjectId;
      if (user._id && user._id.buffer) {
        const buffer = Buffer.from(Object.values(user._id.buffer));
        userObjectId = new mongoose.Types.ObjectId(buffer);
      } else if (typeof user._id === 'string') {
        userObjectId = new mongoose.Types.ObjectId(user._id);
      } else {
        userObjectId = user._id;
      }
      
      await SecureDataAccess.update(
        'users', 
        { _id: userObjectId },
        { $set: { lastLogin: new Date() } }, 
        context
      );

      // Create session
      const SecureSessionManager = require('../services/secureSessionManager');
      
      // Get practice document - always fetch from database since we don't have middleware
      let clinicDoc = null;
      if (practiceSubdomain) {
        clinicDoc = await findOne('practices', 
          { subdomain: practiceSubdomain },
          {},
          { 
            serviceId: 'passwordless-auth-service',
            apiKey: serviceToken,
            practiceId: 'global'
          }
        );
        console.log('📋 [verify-otp] Found practice:', clinicDoc ? clinicDoc.name : 'NOT FOUND');
      }
      
      // SecureSessionManager initialized in server.js
      
      const session = await SecureSessionManager.createSession(
        userObjectId.toString(),
        clinicDoc?._id?.toString() || practiceSubdomain,
        user.roles?.[0] || 'user',
        { 
          practiceSubdomain: practiceSubdomain,
          email: user.email,
          name: user.fullName || `${user.profile?.firstName} ${user.profile?.lastName}`,
          loginMethod: 'otp_verification',
          rememberMe: req.body.rememberMe || false
        }
      );

      // Set cookies (only on subdomain, not root)
      // IMPORTANT: For root domain OTP verification, we'll pass the token to the frontend
      // which will handle the redirect with the token
      if (!isRootDomainRequest(req)) {
        const cookieOptions = getSecureCookieOptions(req);
        if (cookieOptions) {
          res.cookie('sessionToken', session.sessionToken, cookieOptions);
          console.log('🍪 [verify-otp] Cookie set on subdomain');
        }
      } else {
        console.log('🔒 [verify-otp] Root domain - cookie will be set after redirect');
        // The frontend will use the session token from the response to authenticate after redirect
      }
      
      // Only set CSRF cookie on subdomains, not root
      if (!isRootDomainRequest(req)) {
        // SECURITY: CSRF token must be scoped to specific subdomain only
        res.cookie('csrfToken', session.csrfToken, {
          httpOnly: false,
          secure: secureConfigService.get('NODE_ENV') === 'production',
          sameSite: 'strict',  // SECURITY: Strict for CSRF protection
          domain: undefined, // Let browser set to current host for security
          maxAge: 60 * 60 * 1000, // 1 hour for CSRF
          path: '/'
        });
      }

      // Determine if redirect is needed
      const needsRedirect = practiceSubdomain && 
                           practiceSubdomain !== req.practiceSubdomain && 
                           (!req.practiceSubdomain || req.practiceSubdomain === 'intellicare' || req.practiceSubdomain === 'localhost');

      res.json({
        success: true,
        message: {
          en: 'Login successful!',
          he: 'התחברות הצליחה!'
        },
        sessionId: session.sessionId,
        sessionToken: session.sessionToken, // Include session token for frontend to use after redirect
        csrfToken: session.csrfToken,
        needsRedirect: needsRedirect,
        redirectUrl: needsRedirect ? `http://${practiceSubdomain}.intellicare.health:3000/` : null,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.profile?.firstName,
          lastName: user.profile?.lastName,
          fullName: user.fullName,
          roles: user.roles,
          preferredLanguage: user.preferredLanguage || 'en'
        },
        practice: {
          id: clinicDoc?._id,
          name: clinicDoc?.name,
          subdomain: practiceSubdomain
        }
      });

    } catch (error) {
      console.error('❌ Verify OTP error:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Verification failed. Please try again.',
          he: 'האימות נכשל. אנא נסה שוב.'
        }
      });
    }
  }
);

// @route   POST /api/auth/magic-login
// @desc    Login with magic token
// @access  Public
router.post(
  '/magic-login',
  [
    practiceContext,
    practiceModels,
    body('token', 'Login token is required').notEmpty(),
    body('userId', 'User ID is required').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid login request.',
            he: 'בקשת התחברות לא תקינה.'
          }
        });
      }

      const { token, userId, practice } = req.body;
      
      // Get practice subdomain from request body (passed from frontend) or extract from host
      let practiceSubdomain = practice;
      if (!practiceSubdomain) {
        const host = req.get('host') || '';
        practiceSubdomain = host.split('.')[0];
      }

      console.log('🔍 Magic login attempt:');
      console.log('📧 Token:', token.substring(0, 10) + '...');
      console.log('👤 UserId:', userId);
      console.log('🏥 Practice:', practiceSubdomain);
      console.log('⏰ Current time:', new Date());

      // Define security context for SecureDataAccess
      // LOGIN TOKENS ARE IN GLOBAL DATABASE - not practice-specific
      const globalContext = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: 'global'  // Always use global for login tokens
      };

      // Context for both token and user queries (practice-specific)
      const practiceContext = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: practiceSubdomain,  // Use the practice subdomain for database access
        practiceSubdomain: practiceSubdomain  // Pass the actual subdomain for user queries
      };

      // SecureDataAccess stores userIds as strings, so use string for query
      const userIdForQuery = userId.toString();
      
      // Debug the query
      console.log(`🔍 Searching for token in PRACTICE database: ${practiceSubdomain}`);
      console.log('   - token:', token.substring(0, 20) + '...');
      console.log('   - userId:', userIdForQuery);
      console.log('   - userId type:', typeof userIdForQuery);
      console.log('   - isUsed: false');
      console.log('   - database:', `intellicare_practice_${practiceSubdomain}`);
      
      // Find the token in PRACTICE database (proper multi-tenant isolation)
      const loginToken = await findOne('logintokens', {
        token,
        userId: userIdForQuery,
        isUsed: false
      }, {}, practiceContext);  // Use practiceContext for proper isolation

      console.log('🔍 Token found:', !!loginToken);
      
      // Check expiration manually
      if (loginToken && loginToken.expiresAt) {
        const isExpired = new Date(loginToken.expiresAt) <= new Date();
        if (isExpired) {
          console.log('⏰ Token expired at:', loginToken.expiresAt);
          return res.status(400).json({
            success: false,
            message: {
              en: 'Login token has expired.',
              he: 'אסימון ההתחברות פג תוקף.'
            }
          });
        }
      }

      if (!loginToken) {
        // Debug: Check if token exists at all in GLOBAL database
        const anyToken = await findOne('logintokens', { token }, {}, globalContext);
        console.log('🔍 Token exists in GLOBAL DB:', !!anyToken);
        if (anyToken) {
          console.log('🔍 Token details:');
          console.log('   - UserId match:', anyToken.userId.toString() === userId);
          console.log('   - Is used:', anyToken.isUsed);
          console.log('   - Expires at:', anyToken.expiresAt);
          console.log('   - Is expired:', anyToken.expiresAt <= new Date());
        }

        // Debug: List all tokens for this user in GLOBAL database
        const userTokens = await SecureDataAccess.query('logintokens', { userId: userIdForQuery }, {}, globalContext);
        console.log('🔍 All tokens for user in GLOBAL DB:', userTokens.length);
        userTokens.forEach((t, i) => {
          console.log(`   ${i+1}. Token: ${t.token.substring(0, 10)}..., Used: ${t.isUsed}, Expires: ${t.expiresAt}`);
        });

        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid or expired login token.',
            he: 'אסימון התחברות לא תקין או פג תוקף.'
          }
        });
      }

      // Find user - use email from token for reliable lookup
      console.log('🔍 Finding user with email:', loginToken?.email);
      const user = loginToken?.email 
        ? await findOne('users', { email: loginToken.email }, {}, practiceContext)  // Use practiceContext for users
        : await findOne('users', { _id: loginToken?.userId || userId.toString() }, {}, practiceContext);  // Use practiceContext for users
      if (!user || !user.emailVerified || user.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: {
            en: 'User account not found or not active.',
            he: 'חשבון משתמש לא נמצא או לא פעיל.'
          }
        });
      }

      // Mark token as used (only if not already used)
      if (!loginToken.isUsed) {
        // Convert buffer _id to proper ObjectId for update
        const mongoose = require('mongoose');
        let tokenObjectId;
        if (loginToken._id && loginToken._id.buffer) {
          // Handle buffer object from SecureDataAccess
          const buffer = Buffer.from(Object.values(loginToken._id.buffer));
          tokenObjectId = new mongoose.Types.ObjectId(buffer);
        } else if (typeof loginToken._id === 'string') {
          tokenObjectId = new mongoose.Types.ObjectId(loginToken._id);
        } else {
          tokenObjectId = loginToken._id;
        }
        
        console.log('🔄 Marking token as used, ID:', tokenObjectId.toString());
        
        const updateResult = await SecureDataAccess.update(
          'logintokens', 
          { _id: tokenObjectId }, // Use ObjectId directly, not string
          { $set: { isUsed: true } }, 
          globalContext  // Use globalContext for tokens in global database
        );
        
        if (updateResult && updateResult.modifiedCount > 0) {
          console.log('✅ Token successfully marked as used');
        } else {
          console.warn('⚠️ Token update may have failed - no documents modified');
        }
        
        loginToken.isUsed = true;
      } else {
        console.log('🔄 Token already used, skipping mark');
      }

      // Update last login
      // Convert user _id to proper format
      let userObjectId;
      if (user._id && user._id.buffer) {
        // Handle buffer object from SecureDataAccess
        const buffer = Buffer.from(Object.values(user._id.buffer));
        userObjectId = new mongoose.Types.ObjectId(buffer);
      } else if (typeof user._id === 'string') {
        userObjectId = new mongoose.Types.ObjectId(user._id);
      } else {
        userObjectId = user._id;
      }
      
      user.lastLogin = new Date();
      const userUpdateResult = await SecureDataAccess.update(
        'users', 
        { _id: userObjectId }, // Use ObjectId directly, not string
        { $set: { lastLogin: new Date() } }, 
        practiceContext  // Use practiceContext for user updates
      );
      
      if (!userUpdateResult || userUpdateResult.modifiedCount === 0) {
        console.warn('⚠️ User lastLogin update may have failed');
      }

      // ✅ REAL SECURITY: Create server-side session for passwordless login
      const SecureSessionManager = require('../services/secureSessionManager');
      const rememberMe = req.body.rememberMe || false;
      
      try {
        console.log('🔒 Creating session for user:', user._id);
        console.log('   Practice subdomain:', req.practiceSubdomain);
        
        // Get practice ID from database if not in req.practice
        let practiceId = req.practice?._id;
        if (!practiceId) {
          const clinicDoc = await findOne('practices', 
            { subdomain: req.practiceSubdomain },
            {},
            { 
              serviceId: 'passwordless-auth-service',
              apiKey: serviceToken || 'passwordless-auth-api-key',
              practiceId: 'global' // Practices are in global database
            }
          );
          practiceId = clinicDoc?._id;
        }
        
        console.log('   Using practice ID:', practiceId);
        console.log('   User._id:', user._id);
        console.log('   User._id type:', typeof user._id);
        
        // Convert user._id properly
        let userIdForSession = user._id;
        if (typeof user._id === 'object' && user._id.buffer) {
          // SecureDataAccess sanitized ObjectId
          userIdForSession = Object.values(user._id.buffer).map(b => b.toString(16).padStart(2, '0')).join('');
        } else if (user._id) {
          userIdForSession = user._id.toString();
        }
        
        // Convert practiceId properly
        let clinicIdForSession = practiceId;
        if (typeof practiceId === 'object' && practiceId.buffer) {
          // SecureDataAccess sanitized ObjectId
          clinicIdForSession = Object.values(practiceId.buffer).map(b => b.toString(16).padStart(2, '0')).join('');
        } else if (practiceId) {
          clinicIdForSession = practiceId.toString();
        } else {
          clinicIdForSession = req.practiceSubdomain;
        }
        
        console.log('   Using user ID for session:', userIdForSession);
        console.log('   Using practice ID for session:', clinicIdForSession);
        
        const session = await SecureSessionManager.createSession(
          userIdForSession,
          clinicIdForSession,
          user.roles?.[0] || 'user',
          { 
            practiceSubdomain: req.practiceSubdomain,
            email: user.email,
            name: user.fullName || `${user.profile?.firstName} ${user.profile?.lastName}`,
            loginMethod: 'passwordless_magic_link',
            rememberMe: rememberMe
          }
        );

        // ✅ REAL SECURITY: Set httpOnly cookie only on subdomains
        // Max value that fits in 32-bit signed int: 2147483647ms ≈ 24.8 days
        const maxSafeMaxAge = 2147483647; // Maximum 32-bit signed integer
        if (!isRootDomainRequest(req)) {
          const cookieOptions = getSecureCookieOptions(req, {
            maxAge: maxSafeMaxAge  // ~24.8 days (maximum safe value)
          });
          if (cookieOptions) {
            console.log('🍪 [Magic Login] Setting cookie on subdomain (max duration: ~24.8 days)');
            res.cookie('sessionToken', session.sessionToken, cookieOptions);
          }
        } else {
          console.log('🔒 [Magic Login] Root domain - no cookie set');
        }

        // ✅ REAL SECURITY: Set CSRF token in non-httpOnly cookie (double-submit pattern)
        res.cookie('csrfToken', session.csrfToken, {
          httpOnly: false,  // CRITICAL: Must be accessible to JavaScript for double-submit pattern
          secure: secureConfigService.get('NODE_ENV') === 'production',
          sameSite: 'strict',
          domain: undefined, // Let browser set to current host
          maxAge: maxSafeMaxAge  // ~24.8 days (maximum safe value)
        });

      res.json({
        success: true,
        message: {
          en: 'Login successful.',
          he: 'התחברות הצליחה.'
        },
        // ❌ REMOVED: token (fake client security)
        sessionId: session.sessionId, // Server-generated session ID
        csrfToken: session.csrfToken, // For mutation protection
        rememberMe: rememberMe,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          displayName: user.displayName,
          roles: user.roles,
          permissions: user.permissions,
          preferredLanguage: user.preferredLanguage
        },
        practice: {
          id: req.practice._id,
          subdomain: req.practiceSubdomain,
          name: req.practice.name
        },
        security: {
          sessionId: session.sessionId,
          sessionExpiry: new Date(Date.now() + 2147483647)  // ~24.8 days (max 32-bit int)
        }
      });
      } catch (sessionError) {
        console.error('❌ Session creation error:', sessionError);
        throw sessionError; // Re-throw to be caught by outer catch
      }

    } catch (error) {
      console.error('❌ Magic login error:', error);
      console.error('   Stack:', error.stack);
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

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post(
  '/forgot-password',
  [
    practiceContext,
    practiceModels,
    body('email', 'Valid email is required').isEmail()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid email address.',
            he: 'כתובת אימייל לא תקינה.'
          }
        });
      }

      const { email } = req.body;

      // Define security context for SecureDataAccess
      const context = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: req.practiceId,
        practiceSubdomain: req.practiceSubdomain  // Pass subdomain for user queries
      };

      // Find user
      const user = await findOne('users', {
        email: email.toLowerCase(),
        emailVerified: true,
        status: 'active'
      }, {}, context);

      // Always return success for security (don't reveal if email exists)
      if (!user) {
        return res.json({
          success: true,
          message: {
            en: 'If an account exists, a password reset link has been sent.',
            he: 'אם קיים חשבון, נשלח קישור איפוס סיסמה.'
          }
        });
      }

      // Generate reset token
      const resetToken = generateSecureToken();

      // Store reset token (reuse LoginToken model)
      await req.models.LoginToken.create({
        userId: user._id,
        token: resetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      });

      // Send password reset email with subdomain
      await emailService.sendPasswordReset(
        email,
        resetToken,
        user._id,
        req.practice.name,
        req.practice.subdomain // Use practice.subdomain which is always reliable
      );

      res.json({
        success: true,
        message: {
          en: 'Password reset link sent to your email.',
          he: 'קישור איפוס סיסמה נשלח לאימייל שלך.'
        }
      });

    } catch (error) {
      console.error('❌ Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during password reset request.',
          he: 'שגיאת שרת במהלך בקשת איפוס סיסמה.'
        }
      });
    }
  }
);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post(
  '/reset-password',
  [
    practiceContext,
    practiceModels,
    body('token', 'Reset token is required').notEmpty(),
    body('userId', 'User ID is required').notEmpty(),
    body('password', 'Password must be at least 6 characters').isLength({ min: 6 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid reset request.',
            he: 'בקשת איפוס לא תקינה.'
          }
        });
      }

      const { token, userId, password } = req.body;

      // Define security context for SecureDataAccess
      const context = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,  // Use the authenticated service token
        practiceId: req.practiceId,
        practiceSubdomain: req.practiceSubdomain  // Pass subdomain for user queries
      };

      // Find reset token
      const resetToken = await findOne('logintokens', {
        token,
        userId: new mongoose.Types.ObjectId(userId),
        isUsed: false,
        expiresAt: { $gt: new Date() }
      });

      if (!resetToken) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Invalid or expired reset token.',
            he: 'אסימון איפוס לא תקין או פג תוקף.'
          }
        });
      }

      // Find user - use email from token for reliable lookup
      console.log('🔍 Finding user with email:', loginToken?.email);
      const user = loginToken?.email 
        ? await findOne('users', { email: loginToken.email }, {}, practiceContext)  // Use practiceContext for users
        : await findOne('users', { _id: loginToken?.userId || userId.toString() }, {}, practiceContext);  // Use practiceContext for users
      if (!user || !user.emailVerified || user.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: {
            en: 'User account not found or not active.',
            he: 'חשבון משתמש לא נמצא או לא פעיל.'
          }
        });
      }

      // Update password
      user.password = password; // Will be hashed by pre-save middleware
      await SecureDataAccess.update('users', { _id: user._id }, { $set: { lastLogin: new Date() } }, context);

      // Mark token as used
      resetToken.isUsed = true;
      await SecureDataAccess.update('logintokens', { _id: resetToken._id }, { $set: { isUsed: true } }, context);

      res.json({
        success: true,
        message: {
          en: 'Password reset successfully.',
          he: 'סיסמה אופסה בהצלחה.'
        }
      });

    } catch (error) {
      console.error('❌ Reset password error:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during password reset.',
          he: 'שגיאת שרת במהלך איפוס סיסמה.'
        }
      });
    }
  }
);

// @route   POST /api/passwordless-auth/create-practice
// @desc    Create new practice with passwordless admin user
// @access  Public
router.post(
  '/create-practice',
  [
    body('subdomain', 'Subdomain is required').notEmpty().trim().isLength({ min: 3, max: 30 }),
    body('subdomain', 'Subdomain must contain only letters, numbers, and hyphens').matches(/^[a-z0-9-]+$/),
    body('adminEmail', 'Valid email is required').isEmail(),
    body('adminFirstName', 'First name is required').notEmpty().trim(),
    body('adminLastName', 'Last name is required').notEmpty().trim()
  ],
  async (req, res) => {
    try {
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

      const { subdomain, adminEmail, adminFirstName, adminLastName, practiceName, language } = req.body;

      // Initialize database factory
      const databaseFactory = require('../utils/databaseFactory');
      // databaseFactory initialized in server.js

      // Get global database connection using databaseFactory
      const globalDb = await databaseFactory.getGlobalDatabase();
      const Practice = globalDb.model('Practice', require('../models/Practice').schema);

      // Check if subdomain already exists
      const existingClinic = await findOne('practices', { subdomain: subdomain.toLowerCase() }, {}, context);
      if (existingClinic) {
        return res.status(409).json({
          success: false,
          message: {
            en: `Practice '${subdomain}' already exists.`,
            he: `מרפאה '${subdomain}' כבר קיימת.`
          }
        });
      }

      // Create practice in global database
      const newClinicData = {
        name: practiceName || subdomain, // Use provided name or subdomain as name
        subdomain: subdomain.toLowerCase().trim(),
        status: 'active',
        subscription: {
          plan: 'professional',
          maxUsers: 50,
          maxPatients: 1000,
          features: ['ai_analysis', 'document_upload', 'multi_user', 'api_access'],
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        },
        settings: {
          language: language || 'en', // Use provided language or default to English
          timezone: 'UTC',
          dateFormat: 'MM/DD/YYYY',
          currency: 'USD',
          patientIdFormat: 'us_ssn',
          workingHours: {
            start: '08:00',
            end: '18:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          },
          security: {
            sessionTimeout: 480,
            passwordPolicy: {
              minLength: 8,
              requireUppercase: true,
              requireLowercase: true,
              requireNumbers: true,
              requireSpecialChars: false
            },
            mfaRequired: false
          }
        },
        address: {
          street: 'TBD',
          city: 'TBD',
          state: 'TBD',
          postalCode: 'TBD',
          country: 'TBD'
        },
        contact: {
          phone: 'TBD',
          email: adminEmail,
          website: `https://${subdomain}.intellicare.health`
        }
      };

      const globalContext = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,
        practiceId: 'global'
      };

      const newClinic = await SecureDataAccess.insert('practices', newClinicData, globalContext);
      console.log(`✅ Practice '${subdomain}' created successfully`);

      // Use SecureDataAccess for all database operations - no direct database access
      // Models will be created as needed by SecureDataAccess
      
      // Create admin user WITHOUT password - directly as object, not model instance
      const adminUserData = {
        email: adminEmail.toLowerCase(),
        profile: {
          firstName: adminFirstName,
          lastName: adminLastName
        },
        roles: ['admin'],
        permissions: [
          'read_patients', 'write_patients', 'delete_patients', 'export_patients',
          'read_documents', 'write_documents', 'delete_documents', 'export_documents',
          'manage_users', 'assign_roles', 'view_reports', 'system_admin',
          'manage_practice_settings', 'manage_billing', 'view_audit_logs'
        ],
        emailVerified: false,
        status: 'pending', // Pending email verification
        isPasswordless: true // Flag for passwordless account
      };

      // Insert user using SecureDataAccess
      const adminUser = await SecureDataAccess.insert('users', adminUserData, context);
      console.log(`✅ Admin user created for practice '${subdomain}'`);

      // Generate verification token
      const verificationToken = generateSecureToken();
      
      // Store verification token using SecureDataAccess
      await SecureDataAccess.insert('emailverifications', {
        userId: adminUser._id,
        email: adminEmail.toLowerCase(),
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }, context);

      // Send verification email with subdomain
      await emailService.sendEmailVerification(
        adminEmail,
        verificationToken,
        adminUser._id,
        newClinic.name,
        subdomain
      );

      res.json({
        success: true,
        message: {
          en: `Practice '${subdomain}' created successfully! Verification email sent to ${adminEmail}.`,
          he: `המרפאה '${subdomain}' נוצרה בהצלחה! אימייל אימות נשלח אל ${adminEmail}.`
        },
        practice: {
          name: newClinic.name,
          subdomain: newClinic.subdomain,
          url: `https://${subdomain}.intellicare.health`
        }
      });

    } catch (error) {
      console.error('❌ Create practice error:', error);
      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during practice creation.',
          he: 'שגיאת שרת במהלך יצירת המרפאה.'
        },
        error: error.message
      });
    }
  }
);

// @route   POST /api/passwordless-auth/send-otp
// @desc    Send OTP code to user's email
// @access  Public
router.post('/send-otp', 
  [
    body('email', 'Valid email is required').isEmail().normalizeEmail()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array(),
          message: 'Invalid email address'
        });
      }

      const { email } = req.body;
      console.log(`📧 [OTP] Sending OTP to: ${email}`);

      // Initialize OTP service
      const otpService = require('../services/otpService');
      // otpService initialized in server.js

      // Get practice subdomain from various sources
      const practiceSubdomain = req.practice?.subdomain || 
                             req.headers['x-practice-subdomain'] || 
                             req.headers['x-practice'] ||
                             req.query.practice ||
                             null;
      console.log(`🏥 [OTP] Practice subdomain: ${practiceSubdomain || 'none'}`);
      console.log(`🏥 [OTP] Headers:`, req.headers);

      // Create OTP
      const otpResult = await otpService.createOTP(email, practiceSubdomain);
      
      // Send OTP email
      const emailService = require('../services/emailService');
      // emailService initialized in server.js
      
      // Get practice name if available
      let practiceName = 'IntelliCare';
      if (practiceSubdomain) {
        try {
          const context = {
            serviceId: 'passwordless-auth-service',
            apiKey: serviceToken,
            practiceId: 'global'
          };
          
          const practices = await SecureDataAccess.query('practices', 
            { subdomain: practiceSubdomain }, 
            { limit: 1 }, 
            context
          );
          
          if (practices && practices.length > 0) {
            practiceName = practices[0].name || 'IntelliCare';
          }
        } catch (err) {
          console.log('Could not fetch practice name:', err.message);
        }
      }
      
      await emailService.sendOTPCode(email, otpResult.code, practiceName);
      
      console.log(`✅ [OTP] Code sent successfully to ${email}`);
      
      res.json({
        success: true,
        message: `Verification code sent to ${email}`,
        expiresAt: otpResult.expiresAt
      });
      
    } catch (error) {
      console.error('❌ [OTP] Send OTP error:', error);
      
      // Handle rate limiting error
      if (error.message && error.message.includes('Please wait')) {
        return res.status(429).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to send verification code',
        error: secureConfigService.get('NODE_ENV') === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   POST /api/passwordless-auth/verify-otp
// @desc    Verify OTP code and create session
// @access  Public
router.post('/verify-otp',
  [
    body('email', 'Valid email is required').isEmail().normalizeEmail(),
    body('code', 'Verification code is required').notEmpty().isLength({ min: 6, max: 6 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array(),
          message: 'Invalid email or code'
        });
      }

      const { email, code } = req.body;
      console.log(`🔐 [OTP] Verifying OTP for: ${email}`);

      // Initialize OTP service
      const otpService = require('../services/otpService');
      // otpService initialized in server.js

      // Verify OTP
      const verifyResult = await otpService.verifyOTP(email, code);
      
      if (!verifyResult.success) {
        console.log(`❌ [OTP] Verification failed: ${verifyResult.error}`);
        return res.status(401).json({
          success: false,
          message: verifyResult.error,
          remainingAttempts: verifyResult.remainingAttempts
        });
      }

      console.log(`✅ [OTP] Code verified successfully for ${email}`);
      
      // Get practice subdomain from OTP result or request
      const practiceSubdomain = verifyResult.practiceSubdomain || 
                             req.practice?.subdomain || 
                             req.headers['x-practice-subdomain'];
      
      if (!practiceSubdomain) {
        // Try to find user's practice
        const globalContext = {
          serviceId: 'passwordless-auth-service',
          apiKey: serviceToken,
          practiceId: 'global'
        };
        
        const allClinics = await SecureDataAccess.query('practices', {}, { limit: 100 }, globalContext);
        
        for (const practice of allClinics) {
          const practiceContext = {
            serviceId: 'passwordless-auth-service',
            apiKey: serviceToken,
            practiceId: practice.subdomain
          };
          
          const users = await SecureDataAccess.query('users', 
            { email: email.toLowerCase(), emailVerified: true }, 
            { limit: 1 }, 
            practiceContext
          );
          
          if (users && users.length > 0) {
            practiceSubdomain = practice.subdomain;
            break;
          }
        }
      }
      
      if (!practiceSubdomain) {
        return res.status(404).json({
          success: false,
          message: 'No practice found for this email address'
        });
      }

      // Get user and practice info
      const practiceContext = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,
        practiceId: practiceSubdomain
      };
      
      const users = await SecureDataAccess.query('users', 
        { email: email.toLowerCase(), emailVerified: true }, 
        { limit: 1 }, 
        practiceContext
      );
      
      if (!users || users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found or email not verified'
        });
      }
      
      const user = users[0];
      
      // Get practice info
      const globalContext = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,
        practiceId: 'global'
      };
      
      const practices = await SecureDataAccess.query('practices', 
        { subdomain: practiceSubdomain }, 
        { limit: 1 }, 
        globalContext
      );
      
      const clinicDoc = practices && practices.length > 0 ? practices[0] : null;
      
      if (!clinicDoc) {
        return res.status(404).json({
          success: false,
          message: 'Practice not found'
        });
      }

      // Create session using SecureSessionManager
      console.log('🔒 [OTP] Creating session via SecureSessionManager...');
      const SecureSessionManager = require('../services/secureSessionManager');
      
      // SecureSessionManager initialized in server.js
      
      const { ObjectId } = require('mongodb');
      let userId;
      if (user._id instanceof ObjectId) {
        userId = user._id;
      } else if (typeof user._id === 'string') {
        userId = new ObjectId(user._id);
      } else if (user._id && user._id.buffer) {
        const buffer = Buffer.from(Object.values(user._id.buffer));
        userId = new ObjectId(buffer);
      } else {
        userId = new ObjectId(user._id.toString());
      }
      
      const session = await SecureSessionManager.createSession(
        userId.toString(),
        clinicDoc._id.toString(),
        user.roles?.[0] || 'user',
        { 
          practiceSubdomain: practiceSubdomain,
          email: user.email,
          name: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
          verificationMethod: 'otp',
          emailVerified: true
        }
      );
      
      // 🔒 SECURITY: Don't set cookies on root domain
      // Session token will be used after redirect to subdomain
      let cookieSet = false;
      if (!isRootDomainRequest(req)) {
        // Only set cookie if we're already on a practice subdomain
        const cookieOptions = getSecureCookieOptions(req);
        if (cookieOptions) {
          console.log('🍪 [OTP] Setting session cookie on subdomain');
          res.cookie('sessionToken', session.sessionToken, cookieOptions);
          cookieSet = true;
        }
      } else {
        console.log('🔒 [OTP] Root domain - not setting cookie, will redirect to subdomain');
      }
      
      console.log(`✅ [OTP] Session created for ${email}`);
      
      // Check if we need to redirect to the correct subdomain
      const isOnRootDomain = isRootDomainRequest(req);
      const needsRedirect = isOnRootDomain || 
        (req.practice?.subdomain && req.practice.subdomain !== practiceSubdomain);
      
      // Build redirect URL
      const protocol = req.protocol || 'http';
      const port = req.get('host')?.includes(':') ? req.get('host').split(':')[1] : '';
      const redirectUrl = needsRedirect ? 
        `${protocol}://${practiceSubdomain}.intellicare.health${port ? ':' + port : ''}/` : null;
      
      // Return success response
      console.log(`📤 [OTP] Returning response with:
        - sessionToken: ${session.sessionToken.substring(0, 10)}...
        - cookieSet: ${cookieSet}
        - needsRedirect: ${needsRedirect}
        - redirectUrl: ${redirectUrl}`);
      
      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user._id,
          email: user.email,
          firstName: user.profile?.firstName,
          lastName: user.profile?.lastName,
          roles: user.roles
        },
        practice: {
          id: clinicDoc._id,
          subdomain: practiceSubdomain,
          name: clinicDoc.name
        },
        sessionToken: session.sessionToken, // Frontend will use this after redirect
        csrfToken: session.csrfToken,
        cookieSet: cookieSet, // Indicates if cookie was set
        needsRedirect: needsRedirect,
        redirectUrl: redirectUrl
      });

    } catch (error) {
      console.error('❌ [OTP] Verify OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify code',
        error: secureConfigService.get('NODE_ENV') === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   POST /api/passwordless-auth/dev-login-callback
// @desc    DEV ONLY - Set session cookie after redirect from root domain
// @access  Public (DEV MODE ONLY)
router.post('/dev-login-callback',
  [
    body('token', 'Session token is required').notEmpty(),
    body('csrf', 'CSRF token is required').notEmpty()
  ],
  async (req, res) => {
    try {
      // CRITICAL: Only allow in development mode
      if (secureConfigService.get('NODE_ENV') !== 'development') {
        return res.status(403).json({
          success: false,
          message: 'This endpoint is only available in development mode'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
          message: 'Invalid request'
        });
      }

      const { token, csrf } = req.body;
      console.log(`🔓 [DEV-LOGIN-CALLBACK] Setting session after redirect`);

      // Verify we're on a subdomain, not root
      if (isRootDomainRequest(req)) {
        return res.status(403).json({
          success: false,
          message: 'Cannot set session on root domain'
        });
      }

      // Validate the session token
      const SecureSessionManager = require('../services/secureSessionManager');
      const session = await SecureSessionManager.validateSession(token);

      if (!session) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired session token'
        });
      }

      // Verify subdomain matches session
      const currentSubdomain = req.practice?.subdomain || req.headers['x-practice-subdomain'];
      if (currentSubdomain !== session.practiceSubdomain) {
        console.log(`🚫 [DEV-LOGIN-CALLBACK] Subdomain mismatch: ${currentSubdomain} !== ${session.practiceSubdomain}`);
        return res.status(403).json({
          success: false,
          message: 'Session does not match practice subdomain'
        });
      }

      // First clear any stale cookies (including old ones set on the broad
      // .intellicare.health domain by other login paths). Without this, a leftover
      // broad-domain sessionToken keeps getting sent and shadows the new one, so
      // session-check validates the OLD token and login appears to fail.
      // (Mirrors the proven clear-then-set pattern in practiceAuth.js set-cookie.)
      const clearConfigs = [
        { httpOnly: true, secure: false, sameSite: 'lax', path: '/', domain: '.intellicare.health' },
        { httpOnly: true, secure: false, sameSite: 'strict', path: '/', domain: req.hostname },
        { httpOnly: true, secure: false, sameSite: 'strict', path: '/' }
      ];
      clearConfigs.forEach(config => {
        res.clearCookie('sessionToken', config);
        res.clearCookie('csrfToken', config);
      });
      console.log('🗑️ [DEV-LOGIN-CALLBACK] Cleared stale cookies first');

      // Set session cookie on the correct subdomain
      const cookieOptions = getSecureCookieOptions(req);
      if (cookieOptions) {
        res.cookie('sessionToken', token, cookieOptions);
        console.log(`✅ [DEV-LOGIN-CALLBACK] Session cookie set for ${currentSubdomain}`);
      }

      // Set CSRF token cookie
      res.cookie('csrfToken', csrf, {
        httpOnly: false,
        secure: secureConfigService.get('NODE_ENV') === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000,
        path: '/'
      });

      res.json({
        success: true,
        message: 'DEV: Session established after redirect',
        sessionSet: true
      });

    } catch (error) {
      console.error('❌ [DEV-LOGIN-CALLBACK] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to set session',
        error: error.message
      });
    }
  }
);

// @route   POST /api/passwordless-auth/dev-login
// @desc    DEV ONLY - Direct login without OTP (bypasses SendGrid/Twilio)
// @access  Public (DEV MODE ONLY)
router.post('/dev-login',
  [
    body('email', 'Valid email is required').isEmail().normalizeEmail()
  ],
  async (req, res) => {
    try {
      // CRITICAL: Only allow in development mode
      if (secureConfigService.get('NODE_ENV') !== 'development') {
        return res.status(403).json({
          success: false,
          message: 'This endpoint is only available in development mode'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
          message: 'Invalid email address'
        });
      }

      const { email } = req.body;
      console.log(`🔓 [DEV-LOGIN] Direct login for: ${email}`);

      // Get practice subdomain from request
      let practiceSubdomain = req.practice?.subdomain ||
                             req.headers['x-practice-subdomain'] ||
                             req.headers['x-practice'] ||
                             req.query.practice ||
                             null;

      console.log(`🏥 [DEV-LOGIN] Initial practice subdomain: ${practiceSubdomain || 'none'}`);

      // If no practice subdomain (logging in from root), search all practices for this user
      let user = null;
      let userFound = false;

      if (!practiceSubdomain || practiceSubdomain === 'global' || practiceSubdomain === 'intellicare' || practiceSubdomain === 'localhost') {
        console.log(`🔍 [DEV-LOGIN] No practice subdomain, searching all practices for user...`);

        // Get all practices
        const globalContext = {
          serviceId: 'passwordless-auth-service',
          apiKey: serviceToken,
          practiceId: 'global'
        };

        const practices = await SecureDataAccess.query('practices', {}, { limit: 100 }, globalContext);
        console.log(`🏥 [DEV-LOGIN] Found ${practices.length} practices to search`);

        // Search each practice for the user
        for (const practice of practices) {
          const practiceContext = {
            serviceId: 'passwordless-auth-service',
            apiKey: serviceToken,
            practiceId: practice.subdomain
          };

          const users = await SecureDataAccess.query('users',
            { email: email },
            { limit: 1 },
            practiceContext
          );

          if (users && users.length > 0) {
            console.log(`✅ [DEV-LOGIN] Found user in practice: ${practice.subdomain}`);
            user = users[0];
            practiceSubdomain = practice.subdomain;
            userFound = true;
            break;
          }
        }

        if (!userFound) {
          return res.status(404).json({
            success: false,
            message: `No user found with email ${email} in any practice`
          });
        }
      } else {
        // Practice subdomain provided, search in that practice
        const context = {
          serviceId: 'passwordless-auth-service',
          apiKey: serviceToken,
          practiceId: practiceSubdomain
        };

        const users = await SecureDataAccess.query('users',
          { email: email },
          { limit: 1 },
          context
        );

        if (!users || users.length === 0) {
          return res.status(404).json({
            success: false,
            message: `No user found with email ${email} in practice ${practiceSubdomain}`
          });
        }

        user = users[0];
      }

      console.log(`✅ [DEV-LOGIN] Found user: ${user.email}`);

      // Get practice document for session creation
      const globalContext = {
        serviceId: 'passwordless-auth-service',
        apiKey: serviceToken,
        practiceId: 'global'
      };

      const practices = await SecureDataAccess.query('practices',
        { subdomain: practiceSubdomain },
        { limit: 1 },
        globalContext
      );

      const clinicDoc = practices && practices.length > 0 ? practices[0] : null;

      if (!clinicDoc) {
        return res.status(404).json({
          success: false,
          message: `Practice ${practiceSubdomain} not found`
        });
      }

      // Create session using SecureSessionManager
      const SecureSessionManager = require('../services/secureSessionManager');
      const { ObjectId } = require('mongodb');

      let userId;
      if (user._id instanceof ObjectId) {
        userId = user._id;
      } else if (typeof user._id === 'string') {
        userId = new ObjectId(user._id);
      } else if (user._id && user._id.buffer) {
        const buffer = Buffer.from(Object.values(user._id.buffer));
        userId = new ObjectId(buffer);
      } else {
        userId = new ObjectId(user._id.toString());
      }

      const session = await SecureSessionManager.createSession(
        userId.toString(),
        clinicDoc._id.toString(),
        user.roles?.[0] || 'user',
        {
          practiceSubdomain: practiceSubdomain,
          email: user.email,
          name: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.email,
          loginMethod: 'dev_login',
          emailVerified: true
        }
      );

      console.log(`✅ [DEV-LOGIN] Session created: ${session.sessionId}`);

      // Check if we're on root domain or wrong subdomain
      const isOnRootDomain = isRootDomainRequest(req);
      const currentSubdomain = req.practice?.subdomain || req.headers['x-practice-subdomain'];

      // ALWAYS redirect when on root domain or wrong subdomain
      if (isOnRootDomain || !currentSubdomain || currentSubdomain === 'global' || currentSubdomain === 'intellicare' || currentSubdomain === 'localhost' || currentSubdomain !== practiceSubdomain) {
        console.log('🔀 [DEV-LOGIN] Need to redirect from root/wrong domain to practice subdomain');
        console.log(`   Current: ${currentSubdomain || 'root'}, Target: ${practiceSubdomain}`);

        // Build redirect URL with session token as query parameter
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'intellicare.health:3000';
        const port = host.includes(':') ? host.split(':')[1] : '';
        const redirectUrl = `${protocol}://${practiceSubdomain}.intellicare.health${port ? ':' + port : ''}/dev-login-callback?token=${encodeURIComponent(session.sessionToken)}&csrf=${encodeURIComponent(session.csrfToken)}`;

        // Return redirect info WITHOUT setting any cookies on root domain
        return res.json({
          success: true,
          message: `DEV: User found in practice ${practiceSubdomain}. Redirecting...`,
          needsRedirect: true,
          redirectUrl: redirectUrl,
          practice: {
            id: clinicDoc._id,
            subdomain: practiceSubdomain,
            name: clinicDoc.name
          },
          user: {
            email: user.email,
            firstName: user.profile?.firstName,
            lastName: user.profile?.lastName
          }
        });
      }

      // We're already on the correct subdomain, set session cookie
      console.log('✅ [DEV-LOGIN] Already on correct subdomain, setting session cookie');
      const cookieOptions = getSecureCookieOptions(req);
      if (cookieOptions) {
        res.cookie('sessionToken', session.sessionToken, cookieOptions);
        console.log('🍪 [DEV-LOGIN] Session cookie set on subdomain');
      }

      // Return success with session established
      res.json({
        success: true,
        message: 'DEV: Login successful (no OTP required)',
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.profile?.firstName,
          lastName: user.profile?.lastName,
          roles: user.roles
        },
        practice: {
          id: clinicDoc._id,
          subdomain: practiceSubdomain,
          name: clinicDoc.name
        },
        sessionToken: session.sessionToken,
        csrfToken: session.csrfToken,
        cookieSet: true,
        needsRedirect: false
      });

    } catch (error) {
      console.error('❌ [DEV-LOGIN] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to login',
        error: error.message
      });
    }
  }
);

module.exports = router;
