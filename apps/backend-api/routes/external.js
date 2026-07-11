/**
 * External Integration API Routes
 * RESTful API endpoints for external healthcare system integrations including
 * drug information, provider directory, clinical research, and regulatory compliance.
 * 
 * Features:
 * - Drug information endpoints (OpenFDA integration)
 * - Provider directory endpoints (CMS + BetterDoctor)
 * - Clinical research endpoints (NIH + PubMed)
 * - Regulatory compliance endpoints (FDA + CMS)
 * - API health and monitoring endpoints
 * - Comprehensive error handling and validation
 * - Rate limiting and authentication
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');
const secureConfigService = require('../services/secureConfigService');

// Import external integration services
const drugInformationService = require('../services/drugInformationService');
const providerDirectoryService = require('../services/providerDirectoryService');
const clinicalResearchService = require('../services/clinicalResearchService');
const regulatoryComplianceService = require('../services/regulatoryComplianceService');
const externalApiGateway = require('../services/externalApiGatewayService');

// Import middleware
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const { validatePracticeAccess } = require('../middleware/practiceAccess');
const { practiceContext } = require('../middleware/practiceContext');

const router = express.Router();

// Rate limiting configuration
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: {
    error: {
      en: message,
      he: 'חרגת ממספר הבקשות המותר. נסה שוב מאוחר יותר'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply authentication and practice context to all routes
// IMPORTANT: practiceContext must come BEFORE authenticate because:
// - authenticate is actually practiceAuth (see middleware/auth.js line 38)
// - practiceAuth requires req.practiceDb to be set
// - practiceContext sets req.practiceDb
router.use(practiceContext);  // Sets req.practiceDb, req.practiceSubdomain, req.practice
router.use(authenticate);      // Uses practiceAuth which requires req.practiceDb
router.use(validatePracticeAccess);
router.use(auditLog('external_api_access'));

// ========== DRUG INFORMATION ENDPOINTS ==========

/**
 * @route GET /api/external/drugs/search
 * @desc Search drug information in FDA database
 * @access Private
 */
router.get('/drugs/search',
  createRateLimit(60000, 100, 'Too many drug searches. Please try again later.'),
  [
    query('q').isString().isLength({ min: 2, max: 100 }).withMessage('Query must be 2-100 characters'),
    query('ndc').optional().isString().matches(/^\d{10,11}$/).withMessage('NDC must be 10-11 digits'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid request parameters',
            he: 'פרמטרי בקשה לא תקינים'
          },
          details: errors.array()
        });
      }

      const { q: query, ndc, limit } = req.query;
      
      let result;
      if (ndc) {
        result = await drugInformationService.getDrugByNDC(ndc, { userId: req.user.id });
      } else {
        result = await drugInformationService.searchDrug(query, {
          limit: parseInt(limit) || 10,
          userId: req.user.id
        });
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Drug search error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to search drugs',
          he: 'שגיאה בחיפוש תרופות'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/drugs/safety-check
 * @desc Check drug safety and adverse events
 * @access Private
 */
router.post('/drugs/safety-check',
  createRateLimit(60000, 50, 'Too many safety checks. Please try again later.'),
  [
    body('drugName').isString().isLength({ min: 2, max: 100 }).withMessage('Drug name must be 2-100 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid request data',
            he: 'נתוני בקשה לא תקינים'
          },
          details: errors.array()
        });
      }

      const { drugName } = req.body;
      
      const safetyInfo = await drugInformationService.checkDrugSafety(drugName, {
        userId: req.user.id
      });

      res.json({
        success: true,
        data: safetyInfo
      });

    } catch (error) {
      console.error('Drug safety check error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to check drug safety',
          he: 'שגיאה בבדיקת בטיחות התרופה'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/drugs/interaction-check
 * @desc Check drug interactions between medications
 * @access Private
 */
router.post('/drugs/interaction-check',
  createRateLimit(60000, 30, 'Too many interaction checks. Please try again later.'),
  [
    body('medications').isArray({ min: 2, max: 20 }).withMessage('Must provide 2-20 medications'),
    body('medications.*').isString().isLength({ min: 2, max: 100 }).withMessage('Each medication name must be 2-100 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid medication list',
            he: 'רשימת תרופות לא תקינה'
          },
          details: errors.array()
        });
      }

      const { medications } = req.body;
      
      const interactions = await drugInformationService.checkDrugInteractions(medications, {
        userId: req.user.id
      });

      res.json({
        success: true,
        data: interactions
      });

    } catch (error) {
      console.error('Drug interaction check error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to check drug interactions',
          he: 'שגיאה בבדיקת אינטראקציות תרופות'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/drugs/validate-prescription
 * @desc Validate prescription information
 * @access Private
 */
router.post('/drugs/validate-prescription',
  createRateLimit(60000, 100, 'Too many prescription validations. Please try again later.'),
  [
    body('drugName').isString().isLength({ min: 2, max: 100 }).withMessage('Drug name required'),
    body('ndc').optional().isString().matches(/^\d{10,11}$/).withMessage('NDC must be 10-11 digits'),
    body('dosage').optional().isString().isLength({ max: 200 }).withMessage('Dosage too long'),
    body('existingMedications').optional().isArray().withMessage('Existing medications must be array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid prescription data',
            he: 'נתוני מרשם לא תקינים'
          },
          details: errors.array()
        });
      }

      const prescriptionData = {
        drugName: req.body.drugName,
        ndc: req.body.ndc,
        dosage: req.body.dosage,
        existingMedications: req.body.existingMedications || []
      };
      
      const validation = await drugInformationService.validatePrescription(prescriptionData, {
        userId: req.user.id
      });

      res.json({
        success: true,
        data: validation
      });

    } catch (error) {
      console.error('Prescription validation error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to validate prescription',
          he: 'שגיאה באימות המרשם'
        },
        message: error.message
      });
    }
  }
);

// ========== PROVIDER DIRECTORY ENDPOINTS ==========

/**
 * @route GET /api/external/providers/search
 * @desc Search healthcare providers
 * @access Private
 */
router.get('/providers/search',
  createRateLimit(60000, 100, 'Too many provider searches. Please try again later.'),
  [
    query('specialty').optional().isString().isLength({ max: 100 }),
    query('location').optional().isString().isLength({ max: 200 }),
    query('insuranceNetwork').optional().isString().isLength({ max: 100 }),
    query('radius').optional().isInt({ min: 1, max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid search parameters',
            he: 'פרמטרי חיפוש לא תקינים'
          },
          details: errors.array()
        });
      }

      const searchCriteria = {
        specialty: req.query.specialty,
        location: req.query.location,
        insuranceNetwork: req.query.insuranceNetwork,
        radius: parseInt(req.query.radius) || 25,
        limit: parseInt(req.query.limit) || 20
      };

      const providers = await providerDirectoryService.searchApiDoctors(searchCriteria, {
        userId: req.user.id
      });

      res.json({
        success: true,
        data: providers
      });

    } catch (error) {
      console.error('Provider search error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to search providers',
          he: 'שגיאה בחיפוש ספקים'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/external/providers/:npi
 * @desc Get provider by NPI number
 * @access Private
 */
router.get('/providers/:npi',
  createRateLimit(60000, 200, 'Too many provider lookups. Please try again later.'),
  async (req, res) => {
    try {
      const { npi } = req.params;
      
      if (!/^\d{10}$/.test(npi)) {
        return res.status(400).json({
          error: {
            en: 'Invalid NPI format',
            he: 'פורמט NPI לא תקין'
          }
        });
      }
      
      const provider = await providerDirectoryService.getDoctorByNPI(npi, {
        userId: req.user.id
      });

      res.json({
        success: true,
        data: provider
      });

    } catch (error) {
      console.error('Provider lookup error:', error);
      res.status(404).json({
        error: {
          en: 'Provider not found',
          he: 'ספק לא נמצא'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/providers/verify-network
 * @desc Verify provider insurance network
 * @access Private
 */
router.post('/providers/verify-network',
  createRateLimit(60000, 100, 'Too many network verifications. Please try again later.'),
  [
    body('providerNPI').isString().matches(/^\d{10}$/).withMessage('Valid NPI required'),
    body('insurancePlan').isString().isLength({ min: 2, max: 100 }).withMessage('Insurance plan required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid verification data',
            he: 'נתוני אימות לא תקינים'
          },
          details: errors.array()
        });
      }

      const { providerNPI, insurancePlan } = req.body;
      
      const verification = await providerDirectoryService.verifyInsuranceNetwork(
        providerNPI,
        insurancePlan,
        { userId: req.user.id }
      );

      res.json({
        success: true,
        data: verification
      });

    } catch (error) {
      console.error('Network verification error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to verify network',
          he: 'שגיאה באימות הרשת'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/external/providers/specialties
 * @desc Get list of medical specialties
 * @access Private
 */
router.get('/providers/specialties',
  createRateLimit(60000, 50, 'Too many specialty requests. Please try again later.'),
  async (req, res) => {
    try {
      const specialties = await providerDirectoryService.getSpecialties({
        userId: req.user.id
      });

      res.json({
        success: true,
        data: specialties
      });

    } catch (error) {
      console.error('Get specialties error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to get specialties',
          he: 'שגיאה בקבלת התמחויות'
        },
        message: error.message
      });
    }
  }
);

// ========== CLINICAL RESEARCH ENDPOINTS ==========

/**
 * @route GET /api/external/research/clinical-trials
 * @desc Search clinical trials
 * @access Private
 */
router.get('/research/clinical-trials',
  createRateLimit(60000, 50, 'Too many clinical trial searches. Please try again later.'),
  [
    query('condition').isString().isLength({ min: 2, max: 200 }).withMessage('Condition required'),
    query('intervention').optional().isString().isLength({ max: 200 }),
    query('location').optional().isString().isLength({ max: 200 }),
    query('phase').optional().isIn(['PHASE1', 'PHASE2', 'PHASE3', 'PHASE4']),
    query('recruitmentStatus').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid search parameters',
            he: 'פרמטרי חיפוש לא תקינים'
          },
          details: errors.array()
        });
      }

      const searchCriteria = {
        condition: req.query.condition,
        intervention: req.query.intervention,
        location: req.query.location,
        phase: req.query.phase,
        recruitmentStatus: req.query.recruitmentStatus || 'RECRUITING',
        limit: parseInt(req.query.limit) || 20
      };
      
      const trials = await clinicalResearchService.searchClinicalTrials(searchCriteria, {
        userId: req.user.id
      });

      res.json({
        success: true,
        data: trials
      });

    } catch (error) {
      console.error('Clinical trial search error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to search clinical trials',
          he: 'שגיאה בחיפוש ניסויים קליניים'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/research/match-patient
 * @desc Match patient to clinical trials
 * @access Private
 */
router.post('/research/match-patient',
  createRateLimit(60000, 20, 'Too many patient matching requests. Please try again later.'),
  [
    body('patientId').isString().isLength({ min: 1, max: 100 }).withMessage('Patient ID required'),
    body('condition').isString().isLength({ min: 2, max: 200 }).withMessage('Condition required'),
    body('age').optional().isInt({ min: 0, max: 150 }),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('location').optional().isString().isLength({ max: 200 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid patient data',
            he: 'נתוני מטופל לא תקינים'
          },
          details: errors.array()
        });
      }

      const patientProfile = {
        id: req.body.patientId,
        primaryCondition: req.body.condition,
        age: req.body.age,
        gender: req.body.gender,
        location: req.body.location
      };
      
      const matches = await clinicalResearchService.matchPatientToTrials(patientProfile, {
        userId: req.user.id
      });

      res.json({
        success: true,
        data: matches
      });

    } catch (error) {
      console.error('Patient trial matching error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to match patient to trials',
          he: 'שגיאה בהתאמת מטופל לניסויים'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/external/research/literature
 * @desc Search medical literature
 * @access Private
 */
router.get('/research/literature',
  createRateLimit(60000, 30, 'Too many literature searches. Please try again later.'),
  [
    query('query').isString().isLength({ min: 2, max: 500 }).withMessage('Search query required'),
    query('publishedAfter').optional().isISO8601(),
    query('studyTypes').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid search parameters',
            he: 'פרמטרי חיפוש לא תקינים'
          },
          details: errors.array()
        });
      }

      const options = {
        publishedAfter: req.query.publishedAfter,
        studyTypes: req.query.studyTypes ? req.query.studyTypes.split(',') : [],
        limit: parseInt(req.query.limit) || 20,
        userId: req.user.id
      };
      
      const literature = await clinicalResearchService.searchMedicalLiterature(
        req.query.query,
        options
      );

      res.json({
        success: true,
        data: literature
      });

    } catch (error) {
      console.error('Literature search error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to search literature',
          he: 'שגיאה בחיפוש ספרות'
        },
        message: error.message
      });
    }
  }
);

// ========== REGULATORY COMPLIANCE ENDPOINTS ==========

/**
 * @route GET /api/external/compliance/fda-alerts
 * @desc Get FDA safety alerts and recalls
 * @access Private
 */
router.get('/compliance/fda-alerts',
  createRateLimit(60000, 50, 'Too many FDA alert requests. Please try again later.'),
  [
    query('alertType').optional().isIn(['all', 'drug_recalls', 'device_recalls']),
    query('dateFrom').optional().isISO8601(),
    query('classification').optional().isIn(['Class I', 'Class II', 'Class III']),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid request parameters',
            he: 'פרמטרי בקשה לא תקינים'
          },
          details: errors.array()
        });
      }

      const options = {
        alertType: req.query.alertType || 'all',
        dateFrom: req.query.dateFrom,
        classification: req.query.classification,
        limit: parseInt(req.query.limit) || 50,
        userId: req.user.id
      };
      
      const alerts = await regulatoryComplianceService.getFDASafetyAlerts(options);

      res.json({
        success: true,
        data: alerts
      });

    } catch (error) {
      console.error('FDA alerts error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to get FDA alerts',
          he: 'שגיאה בקבלת התרעות FDA'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/compliance/generate-report
 * @desc Generate compliance report
 * @access Private
 */
router.post('/compliance/generate-report',
  createRateLimit(60000, 10, 'Too many compliance reports. Please try again later.'),
  [
    body('organizationId').isString().isLength({ min: 1, max: 100 }).withMessage('Organization ID required'),
    body('dateFrom').optional().isISO8601(),
    body('dateTo').optional().isISO8601(),
    body('frameworks').optional().isArray(),
    body('includeRecommendations').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid report parameters',
            he: 'פרמטרי דוח לא תקינים'
          },
          details: errors.array()
        });
      }

      const reportCriteria = {
        organizationId: req.body.organizationId,
        dateFrom: req.body.dateFrom,
        dateTo: req.body.dateTo,
        frameworks: req.body.frameworks || ['HIPAA', 'HITECH'],
        includeRecommendations: req.body.includeRecommendations !== false
      };
      
      const report = await regulatoryComplianceService.generateComplianceReport(reportCriteria, {
        userId: req.user.id
      });

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Compliance report error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to generate compliance report',
          he: 'שגיאה ביצירת דוח ציות'
        },
        message: error.message
      });
    }
  }
);

// ========== RECALL ALERT ENDPOINTS ==========

/**
 * @route GET /api/external/recalls/pending
 * @desc Get pending FDA recall alerts for provider review
 * @access Private
 */
router.get('/recalls/pending',
  createRateLimit(60000, 100, 'Too many recall alert requests. Please try again later.'),
  [
    query('severity').optional().isIn(['CRITICAL', 'HIGH', 'MODERATE', 'INFO']),
    query('hasAffectedPatients').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid request parameters',
            he: 'פרמטרי בקשה לא תקינים'
          },
          details: errors.array()
        });
      }

      const options = {
        severity: req.query.severity,
        hasAffectedPatients: req.query.hasAffectedPatients === 'true',
        practiceId: req.practiceId || 'global'
      };

      const alerts = await drugInformationService.getPendingRecallAlerts(options);

      res.json({
        success: true,
        data: alerts
      });

    } catch (error) {
      console.error('Pending recalls error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to get pending recall alerts',
          he: 'שגיאה בקבלת התרעות החזרות ממתינות'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/external/recalls/patient-alerts
 * @desc Get patient-specific recall alerts
 * @access Private
 */
router.get('/recalls/patient-alerts',
  createRateLimit(60000, 100, 'Too many patient recall requests. Please try again later.'),
  [
    query('patientId').optional().isString(),
    query('unreviewed').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid request parameters',
            he: 'פרמטרי בקשה לא תקינים'
          },
          details: errors.array()
        });
      }

      const options = {
        patientId: req.query.patientId,
        unreviewed: req.query.unreviewed === 'true',
        practiceId: req.practiceId || 'global'
      };

      const alerts = await drugInformationService.getPatientRecallAlerts(options);

      res.json({
        success: true,
        data: alerts
      });

    } catch (error) {
      console.error('Patient recall alerts error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to get patient recall alerts',
          he: 'שגיאה בקבלת התרעות החזרות למטופלים'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/external/recalls/provider-alerts
 * @desc Get recall alerts for the current provider's patients only
 * @access Private - Requires authentication
 *
 * SECURITY: Uses SecureDataAccess layer for all database queries
 * - Service account authentication required
 * - Practice isolation enforced via context.practiceSubdomain
 * - All queries are audited for HIPAA compliance
 */
router.get('/recalls/provider-alerts',
  createRateLimit(60000, 100, 'Too many provider alert requests. Please try again later.'),
  async (req, res) => {
    try {
      // Get current user info from authenticated session
      const userId = req.user?.id || req.user?._id || req.session?.userId;
      const userEmail = req.user?.email || req.session?.userEmail;
      const userName = req.user?.name || req.session?.userName || userEmail;
      // Get practice subdomain from middleware chain (set by practiceContext)
      const practiceSubdomain = req.practiceSubdomain || req.practice?.subdomain;

      console.log(`[FDA Recall Route] Provider alerts request:`, {
        userId,
        userEmail,
        userName,
        practiceSubdomain,
        hasPractice: !!req.practice,
        hasPracticeDb: !!req.practiceDb
      });

      if (!userId && !userEmail && !userName) {
        return res.status(401).json({
          error: {
            en: 'Authentication required',
            he: 'נדרש אימות'
          }
        });
      }

      // Validate practice context is available
      if (!practiceSubdomain) {
        console.error('[FDA Recall Route] Practice subdomain not available');
        return res.status(400).json({
          error: {
            en: 'Practice context required',
            he: 'נדרש הקשר מרפאה'
          }
        });
      }

      // STEP 1: Fetch fresh data from FDA (iRES) and update database
      // This ensures we always show the latest FDA information
      console.log('[FDA Recall] Refreshing data from FDA API...');
      let refreshResult;
      try {
        refreshResult = await drugInformationService.checkForNewAlerts();
        console.log(`[FDA Recall] Refresh complete - Source: ${refreshResult.source}, Processed: ${refreshResult.processed}`);
      } catch (refreshError) {
        // Log error but continue - we can still return cached data
        console.error('[FDA Recall] Refresh failed, using cached data:', refreshError.message);
        refreshResult = { source: 'cache', processed: 0, error: refreshError.message };
      }

      // STEP 2: Get all recall alerts and filter by provider
      // SECURITY: SecureDataAccess enforces practice isolation via practiceSubdomain
      const allAlerts = await drugInformationService.getProviderRecallAlerts({
        providerName: userName,
        providerEmail: userEmail,
        userId: userId,
        practiceSubdomain: practiceSubdomain
      });

      res.json({
        success: true,
        data: allAlerts,
        provider: userName || userEmail,
        practiceSubdomain: practiceSubdomain,
        count: allAlerts.length,
        dataSource: refreshResult.source || 'unknown',
        lastChecked: refreshResult.timestamp || new Date().toISOString()
      });

    } catch (error) {
      console.error('Provider recall alerts error:', error.message);
      console.error('Provider recall alerts stack:', error.stack);
      res.status(500).json({
        error: {
          en: 'Failed to get provider recall alerts',
          he: 'שגיאה בקבלת התרעות החזרות לרופא'
        },
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

/**
 * @route GET /api/external/recalls/stats
 * @desc Get recall alert statistics
 * @access Private
 */
router.get('/recalls/stats',
  createRateLimit(60000, 100, 'Too many stats requests. Please try again later.'),
  async (req, res) => {
    try {
      const stats = await drugInformationService.getRecallAlertStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Recall stats error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to get recall statistics',
          he: 'שגיאה בקבלת סטטיסטיקות החזרות'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/recalls/acknowledge/:alertId
 * @desc Acknowledge a recall alert
 * @access Private
 */
router.post('/recalls/acknowledge/:alertId',
  createRateLimit(60000, 50, 'Too many acknowledgement requests. Please try again later.'),
  [
    body('actionsTaken').optional().isArray()
  ],
  async (req, res) => {
    try {
      const { alertId } = req.params;

      await drugInformationService.acknowledgeRecallAlert(alertId, {
        providerId: req.user.id,
        userId: req.user.id,
        practiceId: req.practiceId || 'global',
        actionsTaken: req.body.actionsTaken || []
      });

      res.json({
        success: true,
        message: {
          en: 'Recall alert acknowledged successfully',
          he: 'התרעת החזרה אושרה בהצלחה'
        }
      });

    } catch (error) {
      console.error('Acknowledge recall error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to acknowledge recall alert',
          he: 'שגיאה באישור התרעת החזרה'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/recalls/review-patient/:alertId
 * @desc Review a patient-specific recall alert
 * @access Private
 */
router.post('/recalls/review-patient/:alertId',
  createRateLimit(60000, 50, 'Too many review requests. Please try again later.'),
  [
    body('actionTaken').optional().isString(),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const { alertId } = req.params;

      await drugInformationService.reviewPatientRecallAlert(alertId, {
        providerId: req.user.id,
        userId: req.user.id,
        practiceId: req.practiceId || 'global',
        actionTaken: req.body.actionTaken,
        notes: req.body.notes
      });

      res.json({
        success: true,
        message: {
          en: 'Patient recall alert reviewed successfully',
          he: 'התרעת החזרה למטופל נבדקה בהצלחה'
        }
      });

    } catch (error) {
      console.error('Review patient recall error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to review patient recall alert',
          he: 'שגיאה בבדיקת התרעת החזרה למטופל'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/recalls/check-now
 * @desc Manually trigger FDA recall check (admin only)
 * @access Private (Admin)
 */
router.post('/recalls/check-now',
  createRateLimit(60000, 5, 'Too many manual checks. Please try again later.'),
  async (req, res) => {
    try {
      const result = await drugInformationService.checkForNewAlerts();

      res.json({
        success: true,
        message: {
          en: `Processed ${result.processed} FDA recalls`,
          he: `עובדו ${result.processed} החזרות FDA`
        },
        data: result
      });

    } catch (error) {
      console.error('Manual recall check error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to check for new recalls',
          he: 'שגיאה בבדיקת החזרות חדשות'
        },
        message: error.message
      });
    }
  }
);

// ========== DEVICE RECALL ENDPOINTS ==========

/**
 * @route GET /api/external/device-recalls/provider-alerts
 * @desc Get device recall alerts for the current provider's patients
 * @access Private - Requires authentication
 */
router.get('/device-recalls/provider-alerts',
  createRateLimit(60000, 100, 'Too many device alert requests. Please try again later.'),
  async (req, res) => {
    try {
      const userId = req.user?.id || req.user?._id || req.session?.userId;
      const userEmail = req.user?.email || req.session?.userEmail;
      const userName = req.user?.name || req.session?.userName || userEmail;
      const practiceSubdomain = req.practiceSubdomain || req.practice?.subdomain;

      console.log(`[Device Recall Route] Provider alerts request:`, {
        userId, userEmail, userName, practiceSubdomain
      });

      if (!userId && !userEmail && !userName) {
        return res.status(401).json({
          error: { en: 'Authentication required', he: 'נדרש אימות' }
        });
      }

      if (!practiceSubdomain) {
        return res.status(400).json({
          error: { en: 'Practice context required', he: 'נדרש הקשר מרפאה' }
        });
      }

      const allAlerts = await drugInformationService.getProviderDeviceRecallAlerts({
        providerName: userName,
        providerEmail: userEmail,
        userId: userId,
        practiceSubdomain: practiceSubdomain
      });

      res.json({
        success: true,
        data: allAlerts,
        provider: userName || userEmail,
        practiceSubdomain: practiceSubdomain,
        count: allAlerts.length
      });

    } catch (error) {
      console.error('Provider device recall alerts error:', error.message);
      res.status(500).json({
        error: { en: 'Failed to get device recall alerts', he: 'שגיאה בקבלת התרעות מכשור' },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/device-recalls/check-now
 * @desc Manually trigger device recall check
 * @access Private (Admin)
 */
router.post('/device-recalls/check-now',
  createRateLimit(60000, 5, 'Too many device recall checks. Please try again later.'),
  async (req, res) => {
    try {
      const result = await drugInformationService.checkForDeviceRecallAlerts();

      res.json({
        success: true,
        message: {
          en: `Checked ${result.checked} device recalls, created ${result.newAlerts} alerts`,
          he: `נבדקו ${result.checked} החזרות מכשור, נוצרו ${result.newAlerts} התרעות`
        },
        data: result
      });

    } catch (error) {
      console.error('Device recall check error:', error);
      res.status(500).json({
        error: { en: 'Failed to check device recalls', he: 'שגיאה בבדיקת החזרות מכשור' },
        message: error.message
      });
    }
  }
);

// ========== DRUG SHORTAGE ENDPOINTS ==========

/**
 * @route GET /api/external/drug-shortages/provider-alerts
 * @desc Get drug shortage alerts for the current provider's patients
 * @access Private - Requires authentication
 */
router.get('/drug-shortages/provider-alerts',
  createRateLimit(60000, 100, 'Too many drug shortage requests. Please try again later.'),
  async (req, res) => {
    try {
      const userId = req.user?.id || req.user?._id || req.session?.userId;
      const userEmail = req.user?.email || req.session?.userEmail;
      const practiceSubdomain = req.user?.practiceSubdomain || req.headers['x-practice-subdomain'] || 'yale';

      if (!userId && !userEmail) {
        return res.status(401).json({
          error: { en: 'Authentication required', he: 'נדרשת הזדהות' }
        });
      }

      const providerId = userId || userEmail;

      const alerts = await drugInformationService.getProviderDrugShortageAlerts({
        providerId,
        practiceSubdomain,
        limit: 50
      });

      res.json({
        success: true,
        data: alerts,
        count: alerts.length
      });

    } catch (error) {
      console.error('Drug shortage provider alerts error:', error);
      res.status(500).json({
        error: { en: 'Failed to get drug shortage alerts', he: 'שגיאה בקבלת התראות מחסור בתרופות' },
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/external/drug-shortages/list
 * @desc Get current drug shortages from FDA
 * @access Private - Requires authentication
 */
router.get('/drug-shortages/list',
  createRateLimit(60000, 60, 'Too many drug shortage requests. Please try again later.'),
  async (req, res) => {
    try {
      const { limit = 50, status = 'current' } = req.query;

      const result = await drugInformationService.getDrugShortages({
        limit: parseInt(limit),
        status
      });

      res.json({
        success: true,
        data: result.shortages,
        total: result.total
      });

    } catch (error) {
      console.error('Drug shortages list error:', error);
      res.status(500).json({
        error: { en: 'Failed to get drug shortages', he: 'שגיאה בקבלת רשימת מחסור בתרופות' },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/drug-shortages/check-now
 * @desc Trigger manual check for drug shortages and match against patients
 * @access Private - Requires authentication
 */
router.post('/drug-shortages/check-now',
  createRateLimit(60000, 5, 'Too many drug shortage checks. Please try again later.'),
  async (req, res) => {
    try {
      const result = await drugInformationService.checkForDrugShortages();

      res.json({
        success: true,
        message: {
          en: `Checked ${result.checked} drug shortages, created ${result.newAlerts} alerts`,
          he: `נבדקו ${result.checked} מחסורים בתרופות, נוצרו ${result.newAlerts} התראות`
        },
        data: result
      });

    } catch (error) {
      console.error('Drug shortage check error:', error);
      res.status(500).json({
        error: { en: 'Failed to check drug shortages', he: 'שגיאה בבדיקת מחסור בתרופות' },
        message: error.message
      });
    }
  }
);

// ========== DEVICE ADVERSE EVENTS ENDPOINTS ==========

/**
 * @route GET /api/external/device-events/safety-profile
 * @desc Get device safety profile with adverse event summary
 * @access Private - Requires authentication
 * @query {string} manufacturer - Device manufacturer (e.g., "Medtronic")
 * @query {string} model - Device model/brand name (e.g., "Evera MRI")
 */
router.get('/device-events/safety-profile',
  createRateLimit(60000, 100, 'Too many device event requests. Please try again later.'),
  async (req, res) => {
    try {
      const { manufacturer, model } = req.query;

      if (!manufacturer && !model) {
        return res.status(400).json({
          error: { en: 'Manufacturer or model required', he: 'נדרש יצרן או דגם' }
        });
      }

      const safetyProfile = await drugInformationService.getDeviceSafetyProfile(
        manufacturer,
        model,
        { limit: 100 }
      );

      res.json({
        success: true,
        data: safetyProfile
      });

    } catch (error) {
      console.error('Device safety profile error:', error);
      res.status(500).json({
        error: { en: 'Failed to get device safety profile', he: 'שגיאה בקבלת פרופיל בטיחות מכשיר' },
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/external/device-events/list
 * @desc Get list of adverse events for a device
 * @access Private - Requires authentication
 * @query {string} deviceName - Device name to search for
 * @query {number} limit - Max number of events (default 20, max 100)
 */
router.get('/device-events/list',
  createRateLimit(60000, 100, 'Too many device event requests. Please try again later.'),
  async (req, res) => {
    try {
      const { deviceName, limit = 20 } = req.query;

      if (!deviceName) {
        return res.status(400).json({
          error: { en: 'Device name required', he: 'נדרש שם מכשיר' }
        });
      }

      const events = await drugInformationService.getDeviceAdverseEvents(
        deviceName,
        { limit: parseInt(limit) }
      );

      res.json({
        success: true,
        data: events
      });

    } catch (error) {
      console.error('Device adverse events error:', error);
      res.status(500).json({
        error: { en: 'Failed to get device adverse events', he: 'שגיאה בקבלת אירועי מכשיר' },
        message: error.message
      });
    }
  }
);

// ========== API HEALTH AND MONITORING ENDPOINTS ==========

/**
 * @route GET /api/external/health
 * @desc Get external API health status
 * @access Private
 */
router.get('/health',
  createRateLimit(60000, 100, 'Too many health checks. Please try again later.'),
  async (req, res) => {
    try {
      const { providerId } = req.query;
      
      let health;
      if (providerId) {
        health = await externalApiGateway.getProviderHealth(providerId);
      } else {
        health = await externalApiGateway.getAllProvidersHealth();
      }

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to get health status',
          he: 'שגיאה בקבלת מצב בריאות'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/external/test-connection/:providerId
 * @desc Test connection to external API provider
 * @access Private
 */
router.post('/test-connection/:providerId',
  createRateLimit(60000, 20, 'Too many connection tests. Please try again later.'),
  async (req, res) => {
    try {
      const { providerId } = req.params;
      
      const connectionTest = await externalApiGateway.testConnection(providerId);

      res.json({
        success: true,
        data: connectionTest
      });

    } catch (error) {
      console.error('Connection test error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to test connection',
          he: 'שגיאה בבדיקת החיבור'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/external/cache
 * @desc Clear external API cache
 * @access Private
 */
router.delete('/cache',
  createRateLimit(60000, 10, 'Too many cache clear requests. Please try again later.'),
  async (req, res) => {
    try {
      const { providerId } = req.query;
      
      externalApiGateway.clearCache(providerId);

      res.json({
        success: true,
        message: providerId 
          ? `Cache cleared for ${providerId}` 
          : 'All external API caches cleared'
      });

    } catch (error) {
      console.error('Cache clear error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to clear cache',
          he: 'שגיאה בניקוי המטמון'
        },
        message: error.message
      });
    }
  }
);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('External API route error:', error);
  
  res.status(500).json({
    error: {
      en: 'An unexpected error occurred',
      he: 'אירעה שגיאה בלתי צפויה'
    },
    message: secureConfigService.get('NODE_ENV') === 'development' ? error.message : 'Internal server error'
  });
});

module.exports = router;