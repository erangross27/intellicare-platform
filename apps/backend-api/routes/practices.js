const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const databaseFactory = require('../utils/databaseFactory');
const { generateToken } = require('../middleware/practiceAuth');
const { auth: authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('../services/secureDataAccess');

const router = express.Router();

// Helper function to determine cookie domain based on environment
const getCookieDomain = (req) => {
  const host = req.get('host') || '';
  
  // ALWAYS use wildcard domain for intellicare.health (works for thousands of subdomains)
  if (host.includes('intellicare.health')) {
    return '.intellicare.health';
  }
  
  // For localhost development with subdomains
  if (host.includes('localhost')) {
    // Use .localhost to allow subdomain sharing in development
    return '.localhost';
  }
  
  // Default: no domain (browser sets to current host only)
  return undefined;
};

// Store deletion confirmation tokens temporarily (in production, use Redis)
const deletionConfirmations = new Map();

// @route   POST /api/practices/create
// @desc    Create new practice with admin user
// @access  Public (no auth required for practice creation)
router.post(
  '/create',
  [
    body('name', 'Practice name is required').notEmpty().trim(),
    body('subdomain', 'Subdomain is required').notEmpty().trim().isLength({ min: 3, max: 30 }),
    body('subdomain', 'Subdomain must contain only letters, numbers, and hyphens').matches(/^[a-z0-9-]+$/),
    body('address.street', 'Street address is required').notEmpty().trim(),
    body('address.city', 'City is required').notEmpty().trim(),
    body('address.country', 'Country is required').notEmpty().trim(),
    body('adminUser.email', 'Valid email is required').isEmail(),
    body('adminUser.password', 'Password must be at least 8 characters').isLength({ min: 8 }),
    body('adminUser.firstName', 'First name is required').notEmpty().trim(),
    body('adminUser.lastName', 'Last name is required').notEmpty().trim(),
    body('settings.language', 'Language is required').isIn(['en', 'he']),
    body('settings.timezone', 'Timezone is required').notEmpty(),
    body('settings.patientIdFormat', 'Patient ID format is required').isIn(['israeli_id', 'us_ssn', 'uk_nhs', 'ca_health'])
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

    const { name, subdomain, address, adminUser, settings } = req.body;

    try {
      // Initialize database factory if not already done
      // databaseFactory initialized in server.js

      // Define proper context for SecureDataAccess
      const context = {
        serviceId: 'practice-management-service',
        apiKey: req.headers['x-api-key'] || 'internal-service',
        practiceId: 'global'
      };

      // Check if subdomain already exists
      const existingClinicResults = await SecureDataAccess.query('practices', { subdomain: subdomain.toLowerCase() }, { limit: 1 }, context);

      const existingClinic = existingClinicResults[0];
      if (existingClinic) {
        return res.status(409).json({
          success: false,
          message: {
            en: `Subdomain '${subdomain}' is already taken. Please choose a different one.`,
            he: `תת-דומיין '${subdomain}' כבר תפוס. אנא בחר אחר.`
          }
        });
      }

      // Create practice in global database
      const newClinic = {
        name: name.trim(),
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
          language: settings.language,
          timezone: settings.timezone,
          dateFormat: settings.language === 'he' ? 'DD/MM/YYYY' : 'MM/DD/YYYY',
          currency: settings.language === 'he' ? 'ILS' : 'USD',
          patientIdFormat: settings.patientIdFormat,
          workingHours: {
            start: '08:00',
            end: '18:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          },
          security: {
            sessionTimeout: 480, // 8 hours
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
        contact: {
          address: {
            street: address.street.trim(),
            city: address.city.trim(),
            state: address.state?.trim() || '',
            country: address.country.trim(),
            postalCode: address.postalCode?.trim() || ''
          },
          phone: address.phone?.trim() || '',
          email: adminUser.email.toLowerCase().trim(),
          website: `https://${subdomain.toLowerCase()}.intellicare.com`
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdClinic = await SecureDataAccess.insert('practices', newClinic, context);
      console.log(`✅ Created practice: ${newClinic.subdomain}`);

      // Initialize practice-specific database
      const practiceDb = await databaseFactory.initializeClinicDatabase(subdomain.toLowerCase());
      console.log(`✅ Initialized database for practice: ${subdomain.toLowerCase()}`);

      // Get default permissions for admin role (includes ALL medical collections)
      const { getDefaultRoleMap } = require('../rbac/rbacService');
      const defaultRoleMap = getDefaultRoleMap();
      const adminRole = defaultRoleMap.find(r => r.roleId === 'admin');
      const adminPermissions = adminRole ? adminRole.permissions : [];

      // Create admin user in practice database
      const adminUserDoc = {
        email: adminUser.email.toLowerCase().trim(),
        password: adminUser.password,  // Let the model handle hashing
        profile: {
          firstName: adminUser.firstName.trim(),
          lastName: adminUser.lastName.trim(),
          title: adminUser.title?.trim() || 'Dr.',
          phone: adminUser.phone?.trim() || ''
        },
        roles: ['admin', 'doctor'],
        permissions: adminPermissions,  // Use default admin permissions including ALL medical collections
        status: 'active',
        preferredLanguage: settings.language,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Define context for practice-specific user creation
      const userContext = {
        serviceId: 'practice-management-service',
        apiKey: req.headers['x-api-key'] || 'internal-service',
        practiceId: createdClinic._id || subdomain.toLowerCase()
      };

      const createdUser = await SecureDataAccess.insert('users', adminUserDoc, userContext);
      console.log(`✅ Created admin user: ${adminUserDoc.email}`);

      // Initialize RBAC policy for new practice with default role map
      const RolePermissionPolicy = require('../models/RolePermissionPolicy').createModel(practiceDb);
      const existingPolicy = await RolePermissionPolicy.findOne();

      if (!existingPolicy) {
        const policyDoc = {
          roles: defaultRoleMap,  // Use the same default role map we got for admin permissions
          updatedAt: new Date(),
          updatedBy: createdUser._id
        };
        await RolePermissionPolicy.create(policyDoc);
        console.log(`✅ Initialized RBAC policy for practice: ${subdomain.toLowerCase()}`);
      }

      // ✅ REAL SECURITY: Create server-side session for new practice admin
      const SecureSessionManager = require('../services/secureSessionManager');
      
      const session = await SecureSessionManager.createSession(
        adminUserDoc._id.toString(),
        newClinic._id.toString(),
        'admin',
        { 
          practiceSubdomain: subdomain.toLowerCase(),
          email: adminUserDoc.email,
          name: adminUserDoc.fullName || `${adminUserDoc.profile?.firstName} ${adminUserDoc.profile?.lastName}`,
          clinicCreator: true,
          isFirstLogin: true
        }
      );

      // Create audit log for practice creation
      const AuditLog = require('../models/AuditLog');
      const AuditLogModel = AuditLog.createModel(practiceDb);
      
      await AuditLogModel.logAction({
        userId: adminUserDoc._id,
        userDetails: {
          email: adminUserDoc.email,
          fullName: adminUserDoc.fullName,
          roles: adminUserDoc.roles
        },
        action: 'user_created',
        resourceType: 'user',
        resourceId: adminUserDoc._id.toString(),
        request: {
          method: 'POST',
          url: '/api/practices/create',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.get('User-Agent') || 'Unknown'
        },
        response: {
          statusCode: 201,
          success: true
        },
        severity: 'medium',
        metadata: {
          clinicCreation: true,
          firstUser: true
        }
      });

      // ✅ REAL SECURITY: Set httpOnly cookie for immediate admin access
      res.cookie('sessionToken', session.sessionToken, {
        httpOnly: true,
        secure: secureConfigService.get('NODE_ENV', 'development') === 'production',
        sameSite: 'lax', // Allow cross-subdomain access
        domain: getCookieDomain(req), // Dynamic domain detection
        maxAge: 30 * 60 * 1000 // 30 minutes
      });

      res.status(201).json({
        success: true,
        message: {
          en: 'Practice created successfully! You are now logged in as the administrator.',
          he: 'המרפאה נוצרה בהצלחה! אתה מחובר כעת כמנהל.'
        },
        // ❌ REMOVED: token (fake client security)
        sessionId: session.sessionId, // Server-generated session ID
        csrfToken: session.csrfToken, // For mutation protection
        practice: {
          id: newClinic._id,
          name: newClinic.name,
          subdomain: newClinic.subdomain,
          settings: newClinic.settings
        },
        user: {
          id: adminUserDoc._id,
          email: adminUserDoc.email,
          fullName: adminUserDoc.fullName,
          displayName: adminUserDoc.displayName,
          roles: adminUserDoc.roles,
          permissions: adminUserDoc.permissions,
          preferredLanguage: adminUserDoc.preferredLanguage
        },
        security: {
          sessionId: session.sessionId,
          sessionExpiry: new Date(Date.now() + 30 * 60 * 1000),
          isFirstLogin: true
        }
      });

    } catch (error) {
      console.error('❌ Practice creation error:', error);
      
      // Cleanup on error - remove practice from global database if it was created
      try {
        const globalDb = await /* SECURITY: Direct database access removed - use SecureDataAccess */null;
        const Practice = globalDb.model('Practice', require('../models/Practice').schema);
        await Practice.deleteOne({ subdomain: subdomain.toLowerCase() });
        await databaseFactory.closeClinicDatabase(subdomain.toLowerCase());
      } catch (cleanupError) {
        console.error('❌ Cleanup error:', cleanupError);
      }

      res.status(500).json({
        success: false,
        message: {
          en: 'Server error during practice creation. Please try again.',
          he: 'שגיאת שרת במהלך יצירת המרפאה. אנא נסה שוב.'
        }
      });
    }
  }
);

// @route   GET /api/practices/check-subdomain/:subdomain
// @desc    Check if subdomain is available
// @access  Public
router.get('/check-subdomain/:subdomain', async (req, res) => {
  const { subdomain } = req.params;

  // Validate subdomain format
  if (!subdomain || !/^[a-z0-9-]+$/.test(subdomain) || subdomain.length < 3 || subdomain.length > 30) {
    return res.status(400).json({
      success: false,
      available: false,
      message: {
        en: 'Subdomain must be 3-30 characters long and contain only letters, numbers, and hyphens.',
        he: 'תת-דומיין חייב להיות באורך 3-30 תווים ולהכיל רק אותיות, מספרים ומקפים.'
      }
    });
  }

  try {
    // databaseFactory initialized in server.js
    const globalDb = await /* SECURITY: Direct database access removed - use SecureDataAccess */null;
    const Practice = globalDb.model('Practice', require('../models/Practice').schema);

    const existingClinicResults = await SecureDataAccess.query('practices', { subdomain: subdomain.toLowerCase() }, { limit: 1 }, context);


    const existingClinic = existingClinicResults[0];
    const available = !existingClinic;

    res.json({
      success: true,
      available,
      subdomain: subdomain.toLowerCase(),
      message: available ? {
        en: `Subdomain '${subdomain}' is available.`,
        he: `תת-דומיין '${subdomain}' זמין.`
      } : {
        en: `Subdomain '${subdomain}' is already taken.`,
        he: `תת-דומיין '${subdomain}' כבר תפוס.`
      }
    });

  } catch (error) {
    console.error('❌ Subdomain check error:', error);
    res.status(500).json({
      success: false,
      available: false,
      message: {
        en: 'Server error during subdomain check.',
        he: 'שגיאת שרת במהלך בדיקת תת-דומיין.'
      }
    });
  }
});

// @route   GET /api/practices/info
// @desc    Get current practice information
// @access  Private (Authenticated users)
router.get('/info', authenticateToken, async (req, res) => {
  try {
    // Check user role - only admins and managers can view full practice info
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('systemAdmin');
    const isManager = userRoles.includes('manager') || userRoles.includes('clinicManager');
    
    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        message: {
          en: 'Only administrators and managers can view practice information',
          he: 'רק מנהלים ומנהלי מערכת יכולים לצפות בפרטי המרפאה'
        }
      });
    }
    
    // Get practice information from request (set by middleware)
    const practice = req.practice;
    
    if (!practice) {
      // Try to get from database if not in request
      // Check multiple sources for subdomain
      const subdomain = req.subdomainInfo?.subdomain || 
                       req.headers['x-practice-subdomain'] || 
                       req.user?.practiceSubdomain || 
                       req.get('host')?.split('.')[0];
      
      if (!subdomain) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Practice information not found',
            he: 'מידע על המרפאה לא נמצא'
          }
        });
      }

      // Use SecureDataAccess with proper context
      const context = {
        serviceId: 'practice-info-service',
        operation: 'get-practice-info',
        practiceId: 'global'
      };
      
      const clinicDataResults = await SecureDataAccess.query('practices', { subdomain }, { limit: 1 }, context);

      
      const practiceData = clinicDataResults[0];
      
      if (!practiceData) {
        return res.status(404).json({
          success: false,
          message: {
            en: 'Practice not found',
            he: 'המרפאה לא נמצאה'
          }
        });
      }

      // Include stats if requested
      const includeStats = req.query.includeStats === 'true';
      
      const response = {
        success: true,
        data: {
          name: practiceData.name,
          subdomain: practiceData.subdomain,
          country: practiceData.contact?.address?.country || practiceData.address?.country || practiceData.country || 'Israel', // Include country
          address: practiceData.contact?.address || practiceData.address, // Include full address
          settings: practiceData.settings,
          contact: practiceData.contact,
          subscription: practiceData.subscription,
          status: practiceData.status
        }
      };

      if (includeStats) {
        // Get statistics from practice database using SecureDataAccess
        const statsContext = {
          serviceId: 'practice-info-service',
          operation: 'get-practice-stats',
          practiceId: practiceData._id?.toString() || subdomain
        };
        
        try {
          const [users, patients] = await Promise.all([
            SecureDataAccess.query('users', {}, { count: true }, statsContext),
            SecureDataAccess.query('patients', {}, { count: true }, statsContext)
          ]);

          response.data.stats = {
            users,
            patients,
            lastUpdated: new Date()
          };
        } catch (statsError) {
          console.log('Could not retrieve stats:', statsError.message);
          response.data.stats = {
            users: 0,
            patients: 0,
            lastUpdated: new Date()
          };
        }
      }

      return res.json(response);
    }

    // Use practice from request if available
    const includeStats = req.query.includeStats === 'true';
    const includeFinancial = req.query.includeFinancial === 'true' && isAdmin; // Only admins can see financial
    
    const response = {
      success: true,
      data: {
        name: practice.name,
        subdomain: practice.subdomain,
        country: practice.contact?.address?.country || practice.address?.country || practice.country || 'Israel', // Include country
        address: practice.contact?.address || practice.address, // Include full address
        settings: practice.settings,
        contact: practice.contact,
        subscription: practice.subscription,
        status: practice.status
      }
    };
    
    // Add financial data if requested and user is admin
    if (includeFinancial) {
      response.data.billing = practice.billing;
      response.data.revenue = practice.revenue;
      response.data.costs = practice.costs;
    }

    if (includeStats) {
      // Get statistics from practice database using SecureDataAccess
      const statsContext = {
        serviceId: 'practice-info-service',
        operation: 'get-practice-stats',
        practiceId: practice._id?.toString() || practice.subdomain
      };
      
      try {
        const [users, patients] = await Promise.all([
          SecureDataAccess.query('users', {}, { count: true }, statsContext),
          SecureDataAccess.query('patients', {}, { count: true }, statsContext)
        ]);

        response.data.stats = {
          users,
          patients,
          lastUpdated: new Date()
        };
      } catch (statsError) {
        console.log('Could not retrieve stats:', statsError.message);
        response.data.stats = {
          users: 0,
          patients: 0,
          lastUpdated: new Date()
        };
      }
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Get practice info error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Failed to retrieve practice information',
        he: 'שגיאה בקבלת מידע על המרפאה'
      }
    });
  }
});

// @route   POST /api/practices/delete/request
// @desc    Step 1: Request practice deletion (requires admin authentication)
// @access  Private (System Admin only)
router.post('/delete/request', authenticateToken, async (req, res) => {
  try {
    const { practiceSubdomain, reason } = req.body;
    const user = req.user;

    // Check if user is a system administrator
    if (!user.roles || !user.roles.includes('system_admin')) {
      return res.status(403).json({
        success: false,
        message: {
          en: 'Access denied. Only system administrators can delete practices.',
          he: 'הגישה נדחתה. רק מנהלי מערכת יכולים למחוק מרפאות.'
        }
      });
    }

    if (!practiceSubdomain || !reason) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Practice subdomain and deletion reason are required.',
          he: 'נדרש תת-דומיין של המרפאה וסיבת המחיקה.'
        }
      });
    }

    // Get practice info
    const globalDb = await /* SECURITY: Direct database access removed - use SecureDataAccess */null;
    const Practice = globalDb.model('Practice', require('../models/Practice').schema);
    const practiceResults = await SecureDataAccess.query('practices', { subdomain: practiceSubdomain }, { limit: 1 }, context);

    const practice = practiceResults[0];

    if (!practice) {
      return res.status(404).json({
        success: false,
        message: {
          en: 'Practice not found.',
          he: 'מרפאה לא נמצאה.'
        }
      });
    }

    // Generate confirmation token
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store confirmation details (expires in 15 minutes)
    deletionConfirmations.set(confirmationToken, {
      practiceSubdomain,
      practiceName: practice.name,
      confirmationCode,
      requestedBy: user.email,
      requestedAt: new Date(),
      reason,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    // Clear expired confirmations
    setTimeout(() => {
      deletionConfirmations.delete(confirmationToken);
    }, 15 * 60 * 1000);

    // Log deletion request
    console.log(`🚨 DELETION REQUEST: ${user.email} requested deletion of practice ${practiceSubdomain}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Confirmation code: ${confirmationCode}`);

    // In production, send confirmation code via email
    // For now, return it in the response (development only)
    res.json({
      success: true,
      message: {
        en: `Deletion request initiated for practice "${practice.name}". Please confirm with the code sent to your email.`,
        he: `בקשת מחיקה החלה עבור מרפאה "${practice.name}". אנא אשר עם הקוד שנשלח למייל שלך.`
      },
      data: {
        confirmationToken,
        practiceName: practice.name,
        practiceSubdomain,
        // Remove this in production - code should only be sent via email
        confirmationCode: secureConfigService.get('NODE_ENV') === 'development' ? confirmationCode : undefined,
        expiresIn: '15 minutes'
      }
    });

  } catch (error) {
    console.error('❌ Practice deletion request error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error during deletion request.',
        he: 'שגיאת שרת במהלך בקשת המחיקה.'
      }
    });
  }
});

// @route   POST /api/practices/delete/confirm
// @desc    Step 2: Confirm practice deletion with code
// @access  Private (System Admin only)
router.post('/delete/confirm', authenticateToken, async (req, res) => {
  try {
    const { confirmationToken, confirmationCode, finalConfirmation } = req.body;
    const user = req.user;

    // Check if user is a system administrator
    if (!user.roles || !user.roles.includes('system_admin')) {
      return res.status(403).json({
        success: false,
        message: {
          en: 'Access denied. Only system administrators can delete practices.',
          he: 'הגישה נדחתה. רק מנהלי מערכת יכולים למחוק מרפאות.'
        }
      });
    }

    if (!confirmationToken || !confirmationCode) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Confirmation token and code are required.',
          he: 'נדרש טוקן אישור וקוד.'
        }
      });
    }

    // Get confirmation details
    const confirmationData = deletionConfirmations.get(confirmationToken);

    if (!confirmationData) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Invalid or expired confirmation token.',
          he: 'טוקן אישור לא תקף או שפג תוקפו.'
        }
      });
    }

    // Check if expired
    if (new Date() > confirmationData.expiresAt) {
      deletionConfirmations.delete(confirmationToken);
      return res.status(400).json({
        success: false,
        message: {
          en: 'Confirmation token has expired. Please request deletion again.',
          he: 'טוקן האישור פג תוקף. אנא בקש מחיקה שוב.'
        }
      });
    }

    // Verify confirmation code
    if (confirmationData.confirmationCode !== confirmationCode) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Invalid confirmation code.',
          he: 'קוד אישור לא תקף.'
        }
      });
    }

    // Require final confirmation string
    const expectedConfirmation = `DELETE ${confirmationData.practiceName}`;
    if (finalConfirmation !== expectedConfirmation) {
      return res.json({
        success: false,
        requiresFinalConfirmation: true,
        message: {
          en: `To permanently delete this practice, please provide the exact text: "${expectedConfirmation}"`,
          he: `כדי למחוק לצמיתות את המרפאה, אנא ספק את הטקסט המדויק: "${expectedConfirmation}"`
        },
        data: {
          practiceName: confirmationData.practiceName,
          practiceSubdomain: confirmationData.practiceSubdomain
        }
      });
    }

    // All confirmations passed - proceed with deletion
    console.log(`🗑️ DELETION CONFIRMED: Starting deletion of practice ${confirmationData.practiceSubdomain}`);

    const globalDb = await /* SECURITY: Direct database access removed - use SecureDataAccess */null;
    const Practice = globalDb.model('Practice', require('../models/Practice').schema);
    
    // Create audit log entry before deletion
    const AuditLog = require('../models/AuditLog');
    try {
      const practiceDb = await /* SECURITY: Direct database access removed - use SecureDataAccess */null;
      const AuditLogModel = AuditLog.createModel(practiceDb);
      
      await AuditLogModel.logAction({
        userId: user._id,
        userDetails: {
          email: user.email,
          fullName: user.fullName
        },
        action: 'practice_deletion',
        resourceType: 'practice',
        resourceId: confirmationData.practiceSubdomain,
        severity: 'critical',
        metadata: {
          reason: confirmationData.reason,
          requestedBy: confirmationData.requestedBy,
          confirmedBy: user.email,
          practiceName: confirmationData.practiceName
        }
      });
    } catch (logError) {
      console.error('Failed to create audit log:', logError);
    }

    // Step 1: Remove practice from global database
    await Practice.findOneAndDelete({ subdomain: confirmationData.practiceSubdomain });
    console.log(`✅ Practice record removed from global database: ${confirmationData.practiceName}`);

    // Step 2: Drop the entire practice database
    try {
      const practiceDb = await /* SECURITY: Direct database access removed - use SecureDataAccess */null;
      await practiceDb.dropDatabase();
      console.log(`✅ Practice database dropped: intellicare_practice_${confirmationData.practiceSubdomain}`);
    } catch (dbError) {
      console.error(`❌ Failed to drop practice database: ${dbError.message}`);
    }

    // Step 3: Remove from database factory cache
    try {
      await databaseFactory.removeClinicDatabase(confirmationData.practiceSubdomain);
      console.log(`✅ Practice removed from database factory cache`);
    } catch (cacheError) {
      console.error(`⚠️ Failed to remove from cache: ${cacheError.message}`);
    }

    // Clear confirmation data
    deletionConfirmations.delete(confirmationToken);

    console.log(`🗑️ DELETION COMPLETE: ${confirmationData.practiceName} (${confirmationData.practiceSubdomain})`);

    res.json({
      success: true,
      message: {
        en: `Practice "${confirmationData.practiceName}" has been permanently deleted.`,
        he: `מרפאה "${confirmationData.practiceName}" נמחקה לצמיתות.`
      },
      data: {
        deletedClinic: confirmationData.practiceName,
        deletedSubdomain: confirmationData.practiceSubdomain,
        deletedBy: user.email,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Practice deletion confirmation error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error during deletion confirmation.',
        he: 'שגיאת שרת במהלך אישור המחיקה.'
      }
    });
  }
});

// @route   POST /api/practices/delete/cancel
// @desc    Cancel a pending deletion request
// @access  Private (System Admin only)
router.post('/delete/cancel', authenticateToken, async (req, res) => {
  try {
    const { confirmationToken } = req.body;
    const user = req.user;

    // Check if user is a system administrator
    if (!user.roles || !user.roles.includes('system_admin')) {
      return res.status(403).json({
        success: false,
        message: {
          en: 'Access denied. Only system administrators can manage practice deletions.',
          he: 'הגישה נדחתה. רק מנהלי מערכת יכולים לנהל מחיקות מרפאות.'
        }
      });
    }

    if (!confirmationToken) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Confirmation token is required.',
          he: 'נדרש טוקן אישור.'
        }
      });
    }

    const confirmationData = deletionConfirmations.get(confirmationToken);
    
    if (!confirmationData) {
      return res.status(404).json({
        success: false,
        message: {
          en: 'No pending deletion request found.',
          he: 'לא נמצאה בקשת מחיקה ממתינה.'
        }
      });
    }

    // Remove the confirmation
    deletionConfirmations.delete(confirmationToken);

    console.log(`✅ Deletion cancelled for practice ${confirmationData.practiceSubdomain} by ${user.email}`);

    res.json({
      success: true,
      message: {
        en: `Deletion request for practice "${confirmationData.practiceName}" has been cancelled.`,
        he: `בקשת המחיקה עבור מרפאה "${confirmationData.practiceName}" בוטלה.`
      }
    });

  } catch (error) {
    console.error('❌ Error cancelling deletion:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Server error while cancelling deletion.',
        he: 'שגיאת שרת בעת ביטול המחיקה.'
      }
    });
  }
});

// @route   GET /api/practices/statistics
// @desc    Get practice statistics (users, patients, appointments, etc.)
// @access  Private (Admin/Manager only)
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    // Check user role - only admins and managers can view statistics
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('systemAdmin');
    const isManager = userRoles.includes('manager') || userRoles.includes('clinicManager');
    
    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        message: {
          en: 'Only administrators and managers can view practice statistics',
          he: 'רק מנהלים ומנהלי מערכת יכולים לצפות בסטטיסטיקות המרפאה'
        }
      });
    }

    // Get practice subdomain from multiple sources
    const subdomain = req.subdomainInfo?.subdomain || 
                     req.headers['x-practice-subdomain'] || 
                     req.user?.practiceSubdomain || 
                     req.get('host')?.split('.')[0];
    
    if (!subdomain) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Practice information not found',
          he: 'מידע על המרפאה לא נמצא'
        }
      });
    }

    // Get practice ID from global database first
    const globalContext = {
      serviceId: 'practice-statistics-service',
      operation: 'get-practice-id',
      practiceId: 'global'
    };
    
    const clinicInfoResults = await SecureDataAccess.query('practices', { subdomain }, { limit: 1 }, globalContext);

    
    const practiceInfo = clinicInfoResults[0];
    
    if (!practiceInfo) {
      return res.status(404).json({
        success: false,
        message: {
          en: 'Practice not found',
          he: 'המרפאה לא נמצאה'
        }
      });
    }
    
    // Set up context for practice-specific queries
    const statsContext = {
      serviceId: 'practice-statistics-service',
      operation: 'get-statistics',
      practiceId: practiceInfo._id?.toString() || subdomain
    };
    
    // Calculate date ranges
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Get statistics using SecureDataAccess
    const [
      totalUsers,
      activeUsers,
      totalPatients,
      newPatientsThisMonth,
      newPatientsLastMonth
    ] = await Promise.all([
      SecureDataAccess.query('users', {}, { count: true }, statsContext),
      SecureDataAccess.query('users', { status: 'active' }, { count: true }, statsContext),
      SecureDataAccess.query('patients', {}, { count: true }, statsContext),
      SecureDataAccess.query('patients', { createdAt: { $gte: startOfMonth } }, { count: true }, statsContext),
      SecureDataAccess.query('patients', {
        createdAt: {
          $gte: startOfLastMonth,
          $lt: startOfMonth
        }
      }, { count: true }, statsContext)
    ]);

    // Calculate growth
    const patientGrowth = newPatientsLastMonth > 0 
      ? ((newPatientsThisMonth - newPatientsLastMonth) / newPatientsLastMonth * 100).toFixed(1)
      : 100;

    // Get all users to calculate role distribution
    const allUsersForRoles = await SecureDataAccess.query('users', {}, {}, statsContext);
    
    // Calculate role distribution manually
    const roleCount = {};
    allUsersForRoles.forEach(user => {
      if (user.roles && Array.isArray(user.roles)) {
        user.roles.forEach(role => {
          roleCount[role] = (roleCount[role] || 0) + 1;
        });
      }
    });
    
    const userRoleDistribution = Object.entries(roleCount)
      .map(([role, count]) => ({ _id: role, count }))
      .sort((a, b) => b.count - a.count);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPatients = await SecureDataAccess.query('patients', {
      createdAt: { $gte: sevenDaysAgo }
    }, { count: true }, statsContext);
    const recentUsers = await SecureDataAccess.query('users', {
      lastLogin: { $gte: sevenDaysAgo }
    }, { count: true }, statsContext);

    // Response
    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          totalPatients,
          newPatientsThisMonth,
          patientGrowth: `${patientGrowth}%`
        },
        activity: {
          recentPatients,
          recentUsers,
          periodDays: 7
        },
        userRoles: userRoleDistribution.map(role => ({
          role: role._id,
          count: role.count
        })),
        generated: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Get practice statistics error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Failed to retrieve practice statistics',
        he: 'שגיאה בקבלת סטטיסטיקות המרפאה'
      }
    });
  }
});

// @route   PUT /api/practices/settings
// @desc    Update practice settings
// @access  Private (Admin only)
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    // Check user role - only admins can update settings
    const userRoles = req.user?.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('systemAdmin');
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: {
          en: 'Only administrators can update practice settings',
          he: 'רק מנהלים יכולים לעדכן הגדרות מרפאה'
        }
      });
    }

    const { settings, contact } = req.body;
    
    if (!settings && !contact) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'No settings provided to update',
          he: 'לא סופקו הגדרות לעדכון'
        }
      });
    }

    // Get practice subdomain from multiple sources
    const subdomain = req.subdomainInfo?.subdomain || 
                     req.headers['x-practice-subdomain'] || 
                     req.user?.practiceSubdomain || 
                     req.get('host')?.split('.')[0];
    
    if (!subdomain) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Practice information not found',
          he: 'מידע על המרפאה לא נמצא'
        }
      });
    }

    // Get global database and practice model
    // databaseFactory initialized in server.js
    const globalDb = await /* SECURITY: Direct database access removed - use SecureDataAccess */null;
    const Practice = globalDb.model('Practice', require('../models/Practice').schema);
    
    // Find and update practice
    const updateData = {};
    
    if (settings) {
      // Validate and sanitize settings
      const allowedSettings = [
        'language', 'timezone', 'dateFormat', 'currency',
        'patientIdFormat', 'workingHours', 'security'
      ];
      
      Object.keys(settings).forEach(key => {
        if (allowedSettings.includes(key)) {
          updateData[`settings.${key}`] = settings[key];
        }
      });
    }
    
    if (contact) {
      // Validate and sanitize contact info
      const allowedContact = ['phone', 'email', 'website'];
      
      Object.keys(contact).forEach(key => {
        if (allowedContact.includes(key)) {
          updateData[`contact.${key}`] = contact[key];
        }
      });
      
      // Handle address separately if provided
      if (contact.address) {
        const allowedAddress = ['street', 'city', 'state', 'country', 'postalCode'];
        Object.keys(contact.address).forEach(key => {
          if (allowedAddress.includes(key)) {
            updateData[`contact.address.${key}`] = contact.address[key];
          }
        });
      }
    }
    
    // Update timestamp
    updateData.updatedAt = new Date();
    
    // Perform update
    const updatedClinic = await Practice.findOneAndUpdate(
      { subdomain },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedClinic) {
      return res.status(404).json({
        success: false,
        message: {
          en: 'Practice not found',
          he: 'המרפאה לא נמצאה'
        }
      });
    }

    // Create audit log
    const practiceDb = await /* SECURITY: Direct database access removed - use SecureDataAccess */null;
    const AuditLog = require('../models/AuditLog');
    const AuditLogModel = AuditLog.createModel(practiceDb);
    
    await AuditLogModel.logAction({
      userId: req.user._id,
      userDetails: {
        email: req.user.email,
        fullName: req.user.fullName,
        roles: req.user.roles
      },
      action: 'practice_settings_updated',
      resourceType: 'practice',
      resourceId: updatedClinic._id.toString(),
      request: {
        method: 'PUT',
        url: '/api/practices/settings',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Unknown'
      },
      response: {
        statusCode: 200,
        success: true
      },
      severity: 'medium',
      metadata: {
        updatedFields: Object.keys(updateData)
      }
    });

    res.json({
      success: true,
      message: {
        en: 'Practice settings updated successfully',
        he: 'הגדרות המרפאה עודכנו בהצלחה'
      },
      data: {
        settings: updatedClinic.settings,
        contact: updatedClinic.contact,
        updatedAt: updatedClinic.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Update practice settings error:', error);
    res.status(500).json({
      success: false,
      message: {
        en: 'Failed to update practice settings',
        he: 'שגיאה בעדכון הגדרות המרפאה'
      }
    });
  }
});

module.exports = router;
