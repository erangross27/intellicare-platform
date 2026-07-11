const databaseFactory = require('../utils/databaseFactory');
const secureConfigService = require('../services/secureConfigService');

/**
 * Practice Context Middleware
 *
 * Detects practice from subdomain/header and adds practice context to request
 * Routes requests to appropriate practice database
 */

// Simple in-memory cache for practice lookups (5 minute TTL)
const practiceCache = new Map();
const PRACTICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extract practice subdomain from request
 * Supports multiple detection methods:
 * 1. Subdomain from Host header (clinic1.intellicare.com)
 * 2. X-Practice-Subdomain header
 * 3. Query parameter (?practice=clinic1)
 * 4. Request body practice field
 */
function extractPracticeSubdomain(req) {
  // Method 1: Extract from subdomain
  const host = req.get('host') || req.get('x-forwarded-host') || '';
  const hostParts = host.split('.');

  // Check for subdomain pattern: clinic1.intellicare.com
  if (hostParts.length >= 3 && !['www', 'api', 'admin'].includes(hostParts[0])) {
    const subdomain = hostParts[0];
    if (subdomain && subdomain !== 'localhost' && subdomain !== '127') {
      return subdomain;
    }
  }

  // Method 2: Check custom header
  const headerPractice = req.get('x-practice-subdomain');
  if (headerPractice) {
    return headerPractice;
  }

  // Method 3: Check query parameter
  if (req.query.practice) {
    return req.query.practice;
  }

  // Method 4: Check request body
  if (req.body && req.body.practice) {
    return req.body.practice;
  }

  // Method 5: Extract from origin header (for CORS requests)
  const origin = req.get('origin');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originHost = originUrl.hostname;
      const originParts = originHost.split('.');
      // Check for subdomain pattern: clinic1.localhost OR clinic1.intellicare.health
      if (originParts.length >= 2) {
        const possibleSubdomain = originParts[0];
        const domain = originParts.slice(1).join('.');

        // Support localhost and production domains
        if ((domain === 'localhost' || domain.includes('intellicare.health') || domain.includes('intellicare.com')) &&
            possibleSubdomain &&
            !['www', 'api', 'admin'].includes(possibleSubdomain)) {
          return possibleSubdomain;
        }
      }
    } catch (error) {
      // Silently handle origin parsing errors
    }
  }

  // Method 6: Extract from JWT token if present
  if (req.user && req.user.practiceSubdomain) {
    return req.user.practiceSubdomain;
  }
  return null;
}

/**
 * Practice Context Middleware
 * Adds practice context to all requests
 */
async function practiceContext(req, res, next) {
  if (process.env.QUIET_LOGS !== 'true') console.log('🏥 Practice context middleware - URL:', req.url);
  try {
    // Check if practice context already set (cached from earlier in request)
    if (req.practice && req.practiceSubdomain) {
      if (process.env.QUIET_LOGS !== 'true') console.log('   - Using cached practice context:', req.practiceSubdomain);
      return next();
    }

    // Extract practice subdomain
    const practiceSubdomain = extractPracticeSubdomain(req);
    if (process.env.QUIET_LOGS !== 'true') console.log('   - Extracted subdomain:', practiceSubdomain);

    if (!practiceSubdomain) {
      // 🔒 SECURITY: No fallbacks allowed - require explicit practice context
      return res.status(400).json({
        success: false,
        message: {
          en: 'Practice context required. Please specify practice subdomain.',
          he: 'נדרש הקשר מרפאה. אנא ציין תת-דומיין של המרפאה.'
        }
      });
    } else {
      req.practiceSubdomain = practiceSubdomain;
    }

    // Validate practice subdomain format
    if (!/^[a-z0-9-]+$/.test(req.practiceSubdomain)) {
      return res.status(400).json({
        success: false,
        message: {
          en: 'Invalid practice subdomain format.',
          he: 'פורמט תת-דומיין מרפאה לא חוקי.'
        }
      });
    }

    // FIRST verify practice exists in global database (before creating DB connection)
    try {
      // Check cache first
      const cacheKey = `practice_${req.practiceSubdomain}`;
      const cached = practiceCache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp < PRACTICE_CACHE_TTL)) {
        if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [Practice Context] Using cached practice data for: ${req.practiceSubdomain}`);
        req.practice = cached.practice;
      } else {
        const globalDb = await databaseFactory.getGlobalDatabase();
        const Practice = globalDb.model('Practice', require('../models/Practice').schema);
        
        // For practice verification, we need to use direct database access since
        // this is a critical middleware that runs before authentication
        // The database security interceptor has been updated to allow this
        if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [Practice Context] Searching for practice: ${req.practiceSubdomain}`);
        
        // Use SecureDataAccess for practice lookup
        const SecureDataAccess = require('../services/secureDataAccess');
        const context = {
          serviceId: 'practice-context-middleware',
          operation: 'findPractice',
          practiceId: 'global'
        };
        
        const practices = await SecureDataAccess.query('practices', { 
          subdomain: req.practiceSubdomain,
          isDeleted: { $ne: true }  // Exclude deleted practices
        }, { limit: 1 }, context);
        
        let practice = practices && practices.length > 0 ? practices[0] : null;

        if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 [Practice Context] Query result:`, practice ? `Found practice: ${practice.name}` : 'No practice found');

      // DISABLED: Auto-creation was masking real practice creation errors
      // Only enable for explicit development testing
      if (!practice && secureConfigService.get('ENABLE_AUTO_CREATE_PRACTICES') === 'true') {
        try {
          const practiceName = req.practiceSubdomain === 'developer'
            ? 'המרפאה של הפיתוח'  // Use proper Hebrew name for dev
            : `${req.practiceSubdomain} Practice`;

          practice = await Practice.create({
            name: practiceName,
            subdomain: req.practiceSubdomain,
            status: 'active',
            subscription: { plan: 'basic', maxUsers: 100, maxPatients: 5000, features: ['ai_analysis','document_upload','multi_user'] },
            settings: { timezone: 'UTC', language: 'en', dateFormat: 'YYYY-MM-DD' }
          });
          if (process.env.QUIET_LOGS !== 'true') console.log(`🆕 Auto-created practice: ${req.practiceSubdomain} with name: ${practiceName}`);
        } catch (e) {
          console.warn('⚠️ Failed auto-create practice:', e.message);
        }
      }

      if (!practice) {
        return res.status(404).json({
          success: false,
            message: {
              en: `Practice '${req.practiceSubdomain}' not found or inactive.`,
              he: `מרפאה '${req.practiceSubdomain}' לא נמצאה או לא פעילה.`
            }
        });
      }
      
      // Cache the practice data
      practiceCache.set(cacheKey, {
        practice: practice,
        timestamp: Date.now()
      });

      req.practice = practice;
    }

      // Check if practice is active
      if (req.practice && req.practice.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: {
            en: `Practice '${req.practiceSubdomain}' is not active.`,
            he: `מרפאה '${req.practiceSubdomain}' אינה פעילה.`
          }
        });
      }

      // Practice is already set in req.practice from cache or fresh lookup
      req.practiceId = req.practice._id;  // Keep for relationships and backward compatibility
      req.practiceSubdomain = req.practice.subdomain;  // Add for database routing (prevents ObjectId usage)

      // Set practiceContext for routes that expect it
      req.practiceContext = {
        practiceId: req.practice.subdomain,  // Use subdomain as practiceId for consistency
        practice: req.practice,
        subdomain: req.practice.subdomain,
        language: req.practice.settings?.language || 'en',
        country: req.practice.contact?.address?.country || 'Israel',
        timezone: req.practice.settings?.timezone || 'UTC',  // Add practice timezone for agent awareness
        user: req.user || req.session?.user || null
      };

      // NOW get the practice database connection (after verifying practice exists)
      // This is REQUIRED for security - SecureDataAccess needs it
      // Pass true for isInternalCall since this is a legitimate middleware operation
      if (process.env.QUIET_LOGS !== 'true') console.log(`🔗 Getting practice database for: ${req.practiceSubdomain}`);
      req.practiceDb = await databaseFactory.getPracticeDatabase(req.practiceSubdomain, true);
      if (process.env.QUIET_LOGS !== 'true') console.log(`✅ Practice database connection established: ${!!req.practiceDb}`);

    } catch (error) {
      console.error('❌ Failed to get practice database:', error);
      return res.status(500).json({
        success: false,
        message: {
          en: 'Failed to connect to practice database.',
          he: 'נכשל בחיבור למסד נתונים של המרפאה.'
        }
      });
    }

    next();

  } catch (error) {
    console.error('❌ Practice context middleware error:', error);
    return res.status(500).json({
      success: false,
      message: {
        en: 'Internal server error in practice context.',
        he: 'שגיאת שרת פנימית בהקשר המרפאה.'
      }
    });
  }
}

/**
 * Practice-Aware Model Factory Middleware
 * Adds practice-specific models to request object
 */
function practiceModels(req, res, next) {
  if (!req.practiceDb) {
    console.error('❌ Practice database not available in practiceModels middleware');
    console.error('   Request URL:', req.originalUrl);
    console.error('   Practice subdomain:', req.practiceSubdomain);
    console.error('   Practice ID:', req.practiceId);
    console.error('   Practice object exists:', !!req.practice);
    return res.status(500).json({
      success: false,
      message: {
        en: 'Practice database not available.',
        he: 'מסד נתונים של המרפאה אינו זמין.'
      }
    });
  }

  try {
    // Import model factories
    const User = require('../models/User');
    const PatientSchemaFactory = require('../models/PatientSchemaFactory');
    const Document = require('../models/Document');
    const ChatSession = require('../models/ChatSession');
    const ChatMessage = require('../models/ChatMessage');
    const AuditLog = require('../models/AuditLog');
    const DeletedPatient = require('../models/DeletedPatient');
    const EmailVerification = require('../models/EmailVerification');
    const LoginToken = require('../models/LoginToken');
    const ZeroTrustSession = require('../models/ZeroTrustSession');
    const PendingUpload = require('../models/PendingUpload');
    const appointmentSchema = require('../models/Appointment');
    const providerAvailabilitySchema = require('../models/ProviderAvailability');

    // Get practice's country for patient schema
    const practiceCountry = req.practice?.contact?.address?.country || 'Israel';
    // Log patient schema info (suppressed in quiet mode)
    if (secureConfigService.get('QUIET_LOGS') !== 'true' && secureConfigService.get('NODE_ENV') !== 'test') {
      if (process.env.QUIET_LOGS !== 'true') console.log(`🌍 Using patient schema for country: ${practiceCountry}`);
    }

    // Create practice-specific models
    req.models = {
      User: User.createModel(req.practiceDb),
      Patient: PatientSchemaFactory.createPatientModel(req.practiceDb, practiceCountry),
      Document: Document.createModel(req.practiceDb),
      ChatSession: ChatSession.createModel(req.practiceDb),
      ChatMessage: ChatMessage.createModel(req.practiceDb),
      AuditLog: AuditLog.createModel(req.practiceDb),
      DeletedPatient: DeletedPatient.createModel(req.practiceDb),
      EmailVerification: EmailVerification.createModel(req.practiceDb),
      LoginToken: LoginToken.createModel(req.practiceDb),
      ZeroTrustSession: req.practiceDb.model('ZeroTrustSession', ZeroTrustSession),
      Appointment: req.practiceDb.model('Appointment', appointmentSchema),
      ProviderAvailability: req.practiceDb.model('ProviderAvailability', providerAvailabilitySchema),
      PendingUpload: (() => {
        // Create PendingUpload model for this practice database
        try {
          return req.practiceDb.model('PendingUpload');
        } catch (error) {
          // Model doesn't exist yet, create it with the schema from the imported model
          const PendingUploadSchema = PendingUpload.schema.clone();
          return req.practiceDb.model('PendingUpload', PendingUploadSchema);
        }
      })()
    };

    next();

  } catch (error) {
    console.error('❌ Failed to create practice models:', error);
    return res.status(500).json({
      success: false,
      message: {
        en: 'Failed to initialize practice models.',
        he: 'נכשל באתחול מודלים של המרפאה.'
      }
    });
  }
}

// Helpers
// Map route-level actions to schema enum values
function normalizeAction(action, req) {
  const act = (action || '').toString();
  switch (act) {
    case 'CREATE':
      if (req?.originalUrl?.includes('/api/chat/')) return 'chat_session_created';
      if (req?.originalUrl?.includes('/api/patients')) return 'patient_created';
      if (req?.originalUrl?.includes('/api/documents')) return 'document_uploaded';
      return 'system_backup';
    case 'DELETE':
      if (req?.originalUrl?.includes('/api/chat/')) return 'chat_session_deleted';
      if (req?.originalUrl?.includes('/api/patients')) return 'patient_deleted';
      if (req?.originalUrl?.includes('/api/documents')) return 'document_deleted';
      if (req?.originalUrl?.includes('/api/users')) return 'user_deleted';
      return 'system_restore';
    case 'BULK_UPDATE':
      if (req?.originalUrl?.includes('/api/chat/')) return 'chat_sessions_bulk_updated';
      if (req?.originalUrl?.includes('/api/documents')) return 'documents_bulk_updated';
      if (req?.originalUrl?.includes('/api/patients')) return 'patients_bulk_updated';
      return 'database_migration';
    case 'BULK_DELETE':
      if (req?.originalUrl?.includes('/api/chat/')) return 'chat_sessions_bulk_deleted';
      if (req?.originalUrl?.includes('/api/documents')) return 'documents_bulk_deleted';
      if (req?.originalUrl?.includes('/api/patients')) return 'patients_bulk_deleted';
      return 'database_migration';
    case 'UPLOAD':
      if (req?.originalUrl?.includes('/api/documents')) return 'document_uploaded';
      return 'document_uploaded';
    case 'user_deletion':
      return 'user_deleted';
    default:
      return act;
  }
}

function normalizeResourceType(resourceType) {
  const r = (resourceType || '').toString().toLowerCase();
  if (r === 'chat_session' || r === 'chat_session'.toUpperCase()) return 'chat_session';
  if (r === 'chat_message' || r === 'chat_message'.toUpperCase()) return 'chat_message';
  if (r === 'patient' || r === 'patient'.toUpperCase()) return 'patient';
  if (r === 'document' || r === 'document'.toUpperCase()) return 'document';
  if (r === 'user' || r === 'user'.toUpperCase()) return 'user';
  if (r === 'analytics') return 'analytics';
  return r;
}

// Audit Logging Middleware
// Automatically logs actions for HIPAA compliance
function auditLogger(action, resourceType) {
  return async (req, res, next) => {
    // Store original res.json to capture response
    const originalJson = res.json;

    res.json = function(data) {
      // Log the action after response
      setImmediate(async () => {
        try {
          if (req.models && req.models.AuditLog && req.user) {
            await req.models.AuditLog.logAction({
              userId: req.user.id,
              userDetails: {
                email: req.user.email,
                fullName: req.user.fullName || 'Unknown',
                roles: req.user.roles || []
              },
              action: normalizeAction(action, req),
              resourceType: normalizeResourceType(resourceType),
              resourceId: req.params.id || req.body.id || null,
              request: {
                method: req.method,
                url: req.originalUrl,
                userAgent: req.get('User-Agent') || 'Unknown',
                ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1'
              },
              response: {
                statusCode: res.statusCode,
                success: res.statusCode < 400
              },
              metadata: {
                practiceSubdomain: req.practiceSubdomain,
                timestamp: new Date()
              }
            });
          } else if (req.models && req.models.AuditLog && !req.user) {
            // Anonymous / system-level action logging (minimal)
            try {
              await req.models.AuditLog.logAction({
                userId: 'system', // Will be converted to ObjectId by logAction method
                userDetails: { email: 'system', fullName: 'System', roles: ['system'] },
                action: normalizeAction(action, req),
                resourceType: normalizeResourceType(resourceType),
                resourceId: req.params.id || null,
                request: {
                  method: req.method,
                  url: req.originalUrl,
                  userAgent: req.get('User-Agent') || 'Unknown',
                  ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1'
                },
                response: { statusCode: res.statusCode, success: res.statusCode < 400 },
                metadata: { practiceSubdomain: req.practiceSubdomain, timestamp: new Date(), anonymous: true }
              });
            } catch (error) {
              console.error('❌ System audit logging failed:', error);
              // Don't fail the request if audit logging fails
            }
          }
        } catch (error) {
          console.error('❌ Audit logging failed:', error);
          // Don't fail the request if audit logging fails
        }
      });

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
}

module.exports = {
  practiceContext,
  practiceModels,
  auditLogger,
  extractPracticeSubdomain
};
