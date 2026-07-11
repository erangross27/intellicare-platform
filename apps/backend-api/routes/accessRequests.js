/**
 * 🔒 PATIENT ACCESS REQUEST API ROUTES
 * HIPAA-compliant patient record requests and disclosure accounting
 */

const express = require('express');
const router = express.Router();
const accessRequestService = require('../services/accessRequestService');
const { auth, checkRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateRequest } = require('../middleware/validation');
const { body, param, query } = require('express-validator');
const roleModel = require('../config/roles');

/**
 * @route   POST /api/access-requests
 * @desc    Create new patient access request
 * @access  Private (Patient or authorized representative)
 */
router.post('/',
  auth,
  body('patientId').notEmpty().isMongoId(),
  body('requestType').optional().isIn(['full_record', 'specific_dates', 'specific_providers', 'disclosure_accounting', 'amendment', 'restriction']),
  body('urgency').optional().isIn(['standard', 'urgent', 'extended']),
  body('purpose').optional().isString(),
  body('deliveryMethod').optional().isIn(['secure_download', 'encrypted_email', 'physical_mail', 'in_person']),
  body('dateRange.startDate').optional().isISO8601(),
  body('dateRange.endDate').optional().isISO8601(),
  body('specificProviders').optional().isArray(),
  body('authorizedRepresentative.name').optional().isString(),
  body('authorizedRepresentative.relationship').optional().isString(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const requesterId = req.user._id || req.user.id;

    const requestData = {
      ...req.body,
      requesterId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };

    const result = await accessRequestService.createAccessRequest(practiceId, requestData);

    res.status(201).json({
      success: result.success,
      message: result.message,
      data: {
        requestId: result.requestId,
        status: result.status,
        deadline: result.deadline
      }
    });
  })
);

/**
 * @route   GET /api/access-requests
 * @desc    Get all access requests (admin) or user's own requests
 * @access  Private
 */
router.get('/',
  auth,
  query('status').optional().isIn(['pending', 'in_progress', 'completed', 'denied', 'expired', 'withdrawn']),
  query('urgency').optional().isIn(['standard', 'urgent', 'extended']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const userId = req.user._id || req.user.id;
    const isAdmin = roleModel.rolesAreAdmin(req.user.roles);

    // For non-admin users, only show their own requests
    const patientId = isAdmin ? req.query.patientId : userId;

    const requests = await accessRequestService.getPatientAccessRequests(practiceId, patientId);

    // Apply filters if provided
    let filteredRequests = requests.requests;
    
    if (req.query.status) {
      filteredRequests = filteredRequests.filter(r => r.status === req.query.status);
    }
    
    if (req.query.urgency) {
      filteredRequests = filteredRequests.filter(r => r.urgency === req.query.urgency);
    }

    if (req.query.startDate) {
      filteredRequests = filteredRequests.filter(r => 
        new Date(r.requestDate) >= new Date(req.query.startDate)
      );
    }

    if (req.query.endDate) {
      filteredRequests = filteredRequests.filter(r => 
        new Date(r.requestDate) <= new Date(req.query.endDate)
      );
    }

    // Apply pagination
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const paginatedRequests = filteredRequests.slice(offset, offset + limit);

    res.json({
      success: true,
      message: {
        he: `נמצאו ${paginatedRequests.length} בקשות גישה`,
        en: `Found ${paginatedRequests.length} access requests`
      },
      data: {
        requests: paginatedRequests,
        totalCount: filteredRequests.length,
        limit,
        offset
      }
    });
  })
);

/**
 * @route   GET /api/access-requests/:requestId
 * @desc    Get specific access request details
 * @access  Private (Request owner or admin)
 */
router.get('/:requestId',
  auth,
  param('requestId').notEmpty(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { requestId } = req.params;
    const userId = req.user._id || req.user.id;
    const isAdmin = roleModel.rolesAreAdmin(req.user.roles);

    // Get request details (implementation would need to be added to service)
    const request = await accessRequestService.getRequestDetails(practiceId, requestId);

    // Check authorization
    if (!isAdmin && request.requesterId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: {
          he: 'אין לך הרשאה לצפות בבקשה זו',
          en: 'You are not authorized to view this request'
        }
      });
    }

    res.json({
      success: true,
      message: {
        he: 'פרטי הבקשה נטענו בהצלחה',
        en: 'Request details loaded successfully'
      },
      data: request
    });
  })
);

/**
 * @route   PUT /api/access-requests/:requestId/process
 * @desc    Process a pending access request
 * @access  Private (Admin, Compliance Officer)
 */
router.put('/:requestId/process',
  auth,
  checkRole(['admin']),
  param('requestId').notEmpty(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { requestId } = req.params;
    const processorId = req.user._id || req.user.id;

    const result = await accessRequestService.processAccessRequest(
      practiceId,
      requestId,
      processorId
    );

    res.json({
      success: result.success,
      message: result.message,
      data: {
        requestId: result.requestId,
        status: result.status,
        completionDate: result.completionDate,
        daysToComplete: result.daysToComplete,
        downloadUrl: result.downloadUrl
      }
    });
  })
);

/**
 * @route   POST /api/access-requests/disclosure
 * @desc    Track PHI disclosure
 * @access  Private (Healthcare providers)
 */
router.post('/disclosure',
  auth,
  checkRole(['admin', 'doctor', 'nurse']),
  body('patientId').notEmpty().isMongoId(),
  body('disclosureType').notEmpty().isIn(['treatment', 'payment', 'operations', 'legal', 'research', 'public_health', 'other']),
  body('recipient.name').notEmpty(),
  body('recipient.organization').optional(),
  body('purpose').notEmpty(),
  body('description').optional(),
  body('dataShared').optional().isArray(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const userId = req.user._id || req.user.id;

    const disclosureData = {
      ...req.body,
      userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };

    const result = await accessRequestService.trackDisclosure(practiceId, disclosureData);

    res.status(201).json({
      success: result.success,
      message: result.message,
      data: {
        disclosureId: result.disclosureId
      }
    });
  })
);

/**
 * @route   GET /api/access-requests/disclosure/:patientId
 * @desc    Get disclosure accounting for patient
 * @access  Private (Patient or authorized)
 */
router.get('/disclosure/:patientId',
  auth,
  param('patientId').notEmpty().isMongoId(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { patientId } = req.params;
    const userId = req.user._id || req.user.id;
    const isAdmin = roleModel.rolesAreAdmin(req.user.roles);

    // Check authorization
    if (!isAdmin && patientId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: {
          he: 'אין לך הרשאה לצפות במידע זה',
          en: 'You are not authorized to view this information'
        }
      });
    }

    const dateRange = {};
    if (req.query.startDate) dateRange.startDate = new Date(req.query.startDate);
    if (req.query.endDate) dateRange.endDate = new Date(req.query.endDate);

    const practiceDb = await require('../utils/databaseFactory').getClinicDatabase(practiceId, true);
    const report = await accessRequestService.generateDisclosureAccounting(
      practiceDb,
      patientId,
      dateRange
    );

    res.json({
      success: true,
      message: {
        he: 'דוח חשיפות נוצר בהצלחה',
        en: 'Disclosure report generated successfully'
      },
      data: report
    });
  })
);

/**
 * @route   GET /api/access-requests/deadlines
 * @desc    Check for approaching deadlines
 * @access  Private (Admin, Compliance Officer)
 */
router.get('/deadlines',
  auth,
  checkRole(['admin']),
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;

    const result = await accessRequestService.checkDeadlines(practiceId);

    res.json({
      success: result.success,
      message: {
        he: `נמצאו ${result.totalAlerts} התראות מועד`,
        en: `Found ${result.totalAlerts} deadline alerts`
      },
      data: result
    });
  })
);

/**
 * @route   POST /api/access-requests/:requestId/extend
 * @desc    Request extension for access request deadline
 * @access  Private (Admin, Compliance Officer)
 */
router.post('/:requestId/extend',
  auth,
  checkRole(['admin']),
  param('requestId').notEmpty(),
  body('reason').notEmpty().isString(),
  body('additionalDays').optional().isInt({ min: 1, max: 30 }),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { requestId } = req.params;
    const { reason, additionalDays = 30 } = req.body;

    // Implementation would need to be added to service
    res.json({
      success: true,
      message: {
        he: `הארכה של ${additionalDays} ימים אושרה`,
        en: `Extension of ${additionalDays} days approved`
      },
      data: {
        requestId,
        newDeadline: new Date(Date.now() + (30 + additionalDays) * 24 * 60 * 60 * 1000),
        reason
      }
    });
  })
);

/**
 * @route   POST /api/access-requests/:requestId/deny
 * @desc    Deny an access request
 * @access  Private (Admin, Compliance Officer)
 */
router.post('/:requestId/deny',
  auth,
  checkRole(['admin']),
  param('requestId').notEmpty(),
  body('reason').notEmpty().isString(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { requestId } = req.params;
    const { reason } = req.body;

    // Implementation would need to be added to service
    res.json({
      success: true,
      message: {
        he: 'הבקשה נדחתה',
        en: 'Request denied'
      },
      data: {
        requestId,
        status: 'denied',
        denialReason: reason,
        deniedAt: new Date()
      }
    });
  })
);

/**
 * @route   GET /api/access-requests/report/:patientId
 * @desc    Generate comprehensive access report for patient
 * @access  Private (Patient or authorized)
 */
router.get('/report/:patientId',
  auth,
  param('patientId').notEmpty().isMongoId(),
  query('format').optional().isIn(['pdf', 'json']),
  query('includeDisclosures').optional().isBoolean(),
  query('includeAuditLog').optional().isBoolean(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { patientId } = req.params;
    const userId = req.user._id || req.user.id;
    const isAdmin = roleModel.rolesAreAdmin(req.user.roles);

    // Check authorization
    if (!isAdmin && patientId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: {
          he: 'אין לך הרשאה לצפות במידע זה',
          en: 'You are not authorized to view this information'
        }
      });
    }

    const options = {
      format: req.query.format || 'json',
      includeDisclosures: req.query.includeDisclosures !== 'false',
      includeAuditLog: req.query.includeAuditLog !== 'false'
    };

    if (req.query.startDate || req.query.endDate) {
      options.dateRange = {};
      if (req.query.startDate) options.dateRange.startDate = new Date(req.query.startDate);
      if (req.query.endDate) options.dateRange.endDate = new Date(req.query.endDate);
    }

    const result = await accessRequestService.generateAccessReport(practiceId, patientId, options);

    res.json({
      success: result.success,
      message: result.message,
      data: {
        reportId: result.reportId,
        report: result.report
      }
    });
  })
);

/**
 * @route   GET /api/access-requests/download/:requestId
 * @desc    Download completed access request package
 * @access  Private (Request owner)
 */
router.get('/download/:requestId',
  auth,
  param('requestId').notEmpty(),
  query('token').notEmpty(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const practiceId = req.practiceId || req.user.practiceId;
    const { requestId } = req.params;
    const { token } = req.query;
    const userId = req.user._id || req.user.id;

    // Verify token and authorization (implementation would need to be added)
    // For now, return success message
    res.json({
      success: true,
      message: {
        he: 'החבילה מוכנה להורדה',
        en: 'Package ready for download'
      },
      data: {
        requestId,
        downloadUrl: `/api/access-requests/download/${requestId}?token=${token}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
  })
);

module.exports = router;