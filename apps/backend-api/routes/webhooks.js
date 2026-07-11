/**
 * Webhook Receiver Routes
 * Secure webhook endpoints for external healthcare system integrations
 * with HMAC signature validation, event processing, and delivery tracking.
 * 
 * Features:
 * - HMAC SHA-256 signature validation for all providers
 * - Event type routing and processing
 * - Automatic retry with exponential backoff
 * - Comprehensive audit logging and monitoring
 * - Rate limiting and DDoS protection
 * - Multi-tenant webhook isolation
 */

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, header, validationResult } = require('express-validator');
const secureConfigService = require('../services/secureConfigService');

// Import webhook management service
const webhookManagementService = require('../services/webhookManagementService');
const webhookSubscriptionService = require('../services/webhookSubscriptionService');

// Import security services
const SecureConfigService = require('../services/secureConfigService');
const { auditLog } = require('../middleware/auditLog');
const { validatePracticeAccess } = require('../middleware/practiceAccess');

const router = express.Router();

// Rate limiting for webhook endpoints - more restrictive than regular API
const webhookRateLimit = rateLimit({
  windowMs: 60000, // 1 minute
  max: 500, // Allow high volume for legitimate webhook traffic
  message: {
    error: {
      en: 'Too many webhook requests. Please check your webhook configuration.',
      he: 'יותר מדי בקשות webhook. אנא בדוק את תצורת ה-webhook שלך'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for legitimate webhook providers
  skip: (req) => {
    const userAgent = req.get('User-Agent') || '';
    const legitimateProviders = [
      'FDA-webhook',
      'CMS-webhook', 
      'NIH-webhook',
      'BetterDoctor-webhook'
    ];
    return legitimateProviders.some(provider => userAgent.includes(provider));
  }
});

// Apply rate limiting to all webhook routes
router.use(webhookRateLimit);

// Raw body parser middleware for HMAC validation
router.use(express.raw({ type: 'application/json', limit: '10mb' }));

/**
 * HMAC Signature Validation Middleware
 * Validates webhook signatures using SHA-256 HMAC
 */
async function validateWebhookSignature(req, res, next) {
  try {
    const signature = req.get('X-Hub-Signature-256') || req.get('X-Signature-256');
    const providerId = req.params.providerId;
    
    if (!signature) {
      return res.status(401).json({
        error: {
          en: 'Missing webhook signature',
          he: 'חסר חתימת webhook'
        },
        code: 'MISSING_SIGNATURE'
      });
    }

    if (!providerId) {
      return res.status(400).json({
        error: {
          en: 'Missing provider ID',
          he: 'חסר מזהה ספק'
        },
        code: 'MISSING_PROVIDER'
      });
    }

    // Get webhook secret for this provider
    const webhookSecret = await SecureConfigService.get(`WEBHOOK_SECRET_${providerId.toUpperCase()}`);
    if (!webhookSecret) {
      console.error(`No webhook secret configured for provider: ${providerId}`);
      return res.status(401).json({
        error: {
          en: 'Webhook not configured for this provider',
          he: 'Webhook לא מוגדר עבור ספק זה'
        },
        code: 'PROVIDER_NOT_CONFIGURED'
      });
    }

    // Calculate expected signature
    const rawBody = req.body;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    
    // Compare signatures (timing-safe comparison)
    const providedSignature = signature.replace('sha256=', '');
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

    if (!isValid) {
      // Log potential security incident
      console.warn(`Invalid webhook signature from ${providerId}. IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
      
      return res.status(401).json({
        error: {
          en: 'Invalid webhook signature',
          he: 'חתימת webhook לא תקינה'
        },
        code: 'INVALID_SIGNATURE'
      });
    }

    // Parse JSON body after signature validation
    try {
      req.body = JSON.parse(rawBody);
    } catch (parseError) {
      return res.status(400).json({
        error: {
          en: 'Invalid JSON payload',
          he: 'תוכן JSON לא תקין'
        },
        code: 'INVALID_JSON'
      });
    }

    req.providerId = providerId;
    req.webhookSecret = webhookSecret;
    next();

  } catch (error) {
    console.error('Webhook signature validation error:', error);
    res.status(500).json({
      error: {
        en: 'Webhook validation failed',
        he: 'אימות webhook נכשל'
      },
      code: 'VALIDATION_ERROR'
    });
  }
}

// ========== HEALTHCARE API WEBHOOK ENDPOINTS ==========

/**
 * @route POST /api/webhooks/:providerId/events
 * @desc Generic webhook receiver for all healthcare providers
 * @access Public (but requires HMAC signature)
 */
router.post('/:providerId/events',
  validateWebhookSignature,
  auditLog('webhook_received'),
  [
    body('eventType').isString().isLength({ min: 1, max: 100 }).withMessage('Event type required'),
    body('eventId').optional().isString().isLength({ max: 100 }),
    body('timestamp').optional().isISO8601(),
    body('data').isObject().withMessage('Event data must be object')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid webhook payload',
            he: 'תוכן webhook לא תקין'
          },
          details: errors.array(),
          code: 'INVALID_PAYLOAD'
        });
      }

      const { providerId } = req;
      const webhookData = {
        providerId,
        eventType: req.body.eventType,
        eventId: req.body.eventId || crypto.randomUUID(),
        timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
        data: req.body.data,
        headers: {
          'user-agent': req.get('User-Agent'),
          'x-forwarded-for': req.get('X-Forwarded-For'),
          'content-type': req.get('Content-Type')
        },
        sourceIP: req.ip
      };

      // Process webhook through management service
      const result = await webhookManagementService.processWebhook(webhookData);

      // Return success response quickly to prevent timeouts
      res.status(200).json({
        success: true,
        eventId: result.eventId,
        processed: result.processed,
        message: {
          en: 'Webhook received and queued for processing',
          he: 'Webhook התקבל והוכנס לתור לעיבוד'
        }
      });

    } catch (error) {
      console.error(`Webhook processing error for ${req.providerId}:`, error);
      res.status(500).json({
        error: {
          en: 'Failed to process webhook',
          he: 'שגיאה בעיבוד webhook'
        },
        code: 'PROCESSING_ERROR',
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/webhooks/fda/drug-alerts
 * @desc FDA drug safety alert webhooks
 * @access Public (HMAC validated)
 */
router.post('/fda/drug-alerts',
  (req, res, next) => {
    req.params.providerId = 'fda';
    next();
  },
  validateWebhookSignature,
  auditLog('fda_drug_alert'),
  [
    body('alertType').isIn(['recall', 'safety_communication', 'drug_shortage']).withMessage('Invalid alert type'),
    body('drugName').isString().isLength({ min: 1, max: 200 }).withMessage('Drug name required'),
    body('ndc').optional().matches(/^\d{10,11}$/).withMessage('Invalid NDC format'),
    body('severity').isIn(['Class I', 'Class II', 'Class III']).withMessage('Invalid severity level'),
    body('affectedLots').optional().isArray(),
    body('distributors').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid FDA alert data',
            he: 'נתוני התרעת FDA לא תקינים'
          },
          details: errors.array()
        });
      }

      // Process FDA drug alert
      const alertData = {
        providerId: 'fda',
        eventType: 'drug_safety_alert',
        eventId: req.body.recallNumber || crypto.randomUUID(),
        timestamp: new Date(),
        data: {
          alertType: req.body.alertType,
          drugName: req.body.drugName,
          ndc: req.body.ndc,
          severity: req.body.severity,
          description: req.body.description,
          affectedLots: req.body.affectedLots || [],
          distributors: req.body.distributors || [],
          actionRequired: req.body.actionRequired,
          recallDate: req.body.recallDate,
          firmName: req.body.firmName
        },
        priority: req.body.severity === 'Class I' ? 'critical' : 'high'
      };

      const result = await webhookManagementService.processWebhook(alertData);

      res.json({
        success: true,
        alertId: result.eventId,
        processed: result.processed
      });

    } catch (error) {
      console.error('FDA drug alert webhook error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to process FDA alert',
          he: 'שגיאה בעיבוד התרעת FDA'
        }
      });
    }
  }
);

/**
 * @route POST /api/webhooks/cms/provider-updates
 * @desc CMS provider directory update webhooks
 * @access Public (HMAC validated)
 */
router.post('/cms/provider-updates',
  (req, res, next) => {
    req.params.providerId = 'cms';
    next();
  },
  validateWebhookSignature,
  auditLog('cms_provider_update'),
  [
    body('updateType').isIn(['provider_added', 'provider_updated', 'provider_removed', 'network_change']),
    body('npi').matches(/^\d{10}$/).withMessage('Valid NPI required'),
    body('providerData').isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid CMS provider data',
            he: 'נתוני ספק CMS לא תקינים'
          },
          details: errors.array()
        });
      }

      const providerUpdate = {
        providerId: 'cms',
        eventType: 'provider_directory_update',
        eventId: crypto.randomUUID(),
        timestamp: new Date(),
        data: {
          updateType: req.body.updateType,
          npi: req.body.npi,
          providerData: req.body.providerData,
          changeDate: req.body.changeDate,
          previousData: req.body.previousData
        }
      };

      const result = await webhookManagementService.processWebhook(providerUpdate);

      res.json({
        success: true,
        updateId: result.eventId,
        processed: result.processed
      });

    } catch (error) {
      console.error('CMS provider update webhook error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to process CMS update',
          he: 'שגיאה בעיבוד עדכון CMS'
        }
      });
    }
  }
);

/**
 * @route POST /api/webhooks/nih/trial-updates
 * @desc NIH clinical trial status updates
 * @access Public (HMAC validated)
 */
router.post('/nih/trial-updates',
  (req, res, next) => {
    req.params.providerId = 'nih';
    next();
  },
  validateWebhookSignature,
  auditLog('nih_trial_update'),
  [
    body('trialId').isString().matches(/^NCT\d{8}$/).withMessage('Valid NCT ID required'),
    body('updateType').isIn(['status_change', 'enrollment_update', 'results_posted']),
    body('newStatus').optional().isIn(['RECRUITING', 'COMPLETED', 'TERMINATED', 'SUSPENDED'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid NIH trial data',
            he: 'נתוני ניסוי NIH לא תקינים'
          },
          details: errors.array()
        });
      }

      const trialUpdate = {
        providerId: 'nih',
        eventType: 'clinical_trial_update',
        eventId: crypto.randomUUID(),
        timestamp: new Date(),
        data: {
          trialId: req.body.trialId,
          updateType: req.body.updateType,
          newStatus: req.body.newStatus,
          previousStatus: req.body.previousStatus,
          enrollmentCount: req.body.enrollmentCount,
          updateReason: req.body.updateReason,
          contactInfo: req.body.contactInfo
        }
      };

      const result = await webhookManagementService.processWebhook(trialUpdate);

      res.json({
        success: true,
        trialUpdateId: result.eventId,
        processed: result.processed
      });

    } catch (error) {
      console.error('NIH trial update webhook error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to process NIH update',
          he: 'שגיאה בעיבוד עדכון NIH'
        }
      });
    }
  }
);

// ========== WEBHOOK MANAGEMENT ENDPOINTS ==========

/**
 * @route GET /api/webhooks/status
 * @desc Get webhook processing status and statistics
 * @access Private
 */
router.get('/status',
  // Switch back to JSON parsing for management endpoints
  express.json(),
  async (req, res) => {
    try {
      const status = await webhookManagementService.getWebhookStatus();
      
      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Webhook status error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to get webhook status',
          he: 'שגיאה בקבלת סטטוס webhook'
        }
      });
    }
  }
);

/**
 * @route POST /api/webhooks/retry/:eventId
 * @desc Retry failed webhook processing
 * @access Private
 */
router.post('/retry/:eventId',
  express.json(),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const result = await webhookManagementService.retryWebhook(eventId);
      
      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Webhook retry error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to retry webhook',
          he: 'שגיאה בחזרה על webhook'
        }
      });
    }
  }
);

/**
 * @route GET /api/webhooks/events
 * @desc Get webhook event history with filtering
 * @access Private
 */
router.get('/events',
  express.json(),
  async (req, res) => {
    try {
      const filters = {
        providerId: req.query.providerId,
        eventType: req.query.eventType,
        status: req.query.status,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        limit: parseInt(req.query.limit) || 100
      };
      
      const events = await webhookManagementService.getWebhookHistory(filters);
      
      res.json({
        success: true,
        data: events
      });

    } catch (error) {
      console.error('Webhook events error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to get webhook events',
          he: 'שגיאה בקבלת אירועי webhook'
        }
      });
    }
  }
);

// ========== WEBHOOK SUBSCRIPTION MANAGEMENT ==========

/**
 * @route POST /api/webhooks/subscriptions
 * @desc Create new webhook subscription
 * @access Private
 */
router.post('/subscriptions',
  express.json(),
  [
    body('providerId').isIn(['fda', 'cms', 'nih', 'betterdoctor']).withMessage('Invalid provider'),
    body('eventTypes').isArray({ min: 1 }).withMessage('At least one event type required'),
    body('webhookUrl').isURL({ require_protocol: true, protocols: ['https'] }).withMessage('HTTPS webhook URL required'),
    body('maxRetries').optional().isInt({ min: 0, max: 10 }),
    body('retryDelay').optional().isInt({ min: 100, max: 60000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid subscription data',
            he: 'נתוני מנוי לא תקינים'
          },
          details: errors.array()
        });
      }

      const subscriptionData = {
        providerId: req.body.providerId,
        eventTypes: req.body.eventTypes,
        webhookUrl: req.body.webhookUrl,
        maxRetries: req.body.maxRetries,
        retryDelay: req.body.retryDelay,
        exponentialBackoff: req.body.exponentialBackoff,
        filters: req.body.filters,
        metadata: req.body.metadata
      };

      const result = await webhookSubscriptionService.createSubscription(subscriptionData, {
        userId: req.user?.id,
        practiceId: req.practice?.id
      });

      res.status(201).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Create subscription error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to create webhook subscription',
          he: 'שגיאה ביצירת מנוי webhook'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/webhooks/subscriptions
 * @desc List webhook subscriptions
 * @access Private
 */
router.get('/subscriptions',
  express.json(),
  async (req, res) => {
    try {
      const filters = {
        providerId: req.query.providerId,
        status: req.query.status,
        eventTypes: req.query.eventTypes ? req.query.eventTypes.split(',') : undefined,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const result = await webhookSubscriptionService.listSubscriptions(filters, {
        userId: req.user?.id,
        practiceId: req.practice?.id
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('List subscriptions error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to list subscriptions',
          he: 'שגיאה ברשימת המנויים'
        }
      });
    }
  }
);

/**
 * @route GET /api/webhooks/subscriptions/:id
 * @desc Get specific webhook subscription
 * @access Private
 */
router.get('/subscriptions/:id',
  express.json(),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const subscription = await webhookSubscriptionService.getSubscription(id, {
        userId: req.user?.id,
        practiceId: req.practice?.id
      });

      if (!subscription) {
        return res.status(404).json({
          error: {
            en: 'Subscription not found',
            he: 'מנוי לא נמצא'
          }
        });
      }

      res.json({
        success: true,
        data: subscription
      });

    } catch (error) {
      console.error('Get subscription error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to get subscription',
          he: 'שגיאה בקבלת המנוי'
        }
      });
    }
  }
);

/**
 * @route PUT /api/webhooks/subscriptions/:id
 * @desc Update webhook subscription
 * @access Private
 */
router.put('/subscriptions/:id',
  express.json(),
  [
    body('eventTypes').optional().isArray({ min: 1 }),
    body('webhookUrl').optional().isURL({ require_protocol: true, protocols: ['https'] }),
    body('status').optional().isIn(['active', 'paused', 'inactive'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            en: 'Invalid update data',
            he: 'נתוני עדכון לא תקינים'
          },
          details: errors.array()
        });
      }

      const { id } = req.params;
      const updates = req.body;

      const result = await webhookSubscriptionService.updateSubscription(id, updates, {
        userId: req.user?.id,
        practiceId: req.practice?.id
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Update subscription error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to update subscription',
          he: 'שגיאה בעדכון המנוי'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/webhooks/subscriptions/:id
 * @desc Delete webhook subscription
 * @access Private
 */
router.delete('/subscriptions/:id',
  express.json(),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await webhookSubscriptionService.deleteSubscription(id, {
        userId: req.user?.id,
        practiceId: req.practice?.id
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Delete subscription error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to delete subscription',
          he: 'שגיאה במחיקת המנוי'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/webhooks/subscriptions/:id/analytics
 * @desc Get delivery analytics for subscription
 * @access Private
 */
router.get('/subscriptions/:id/analytics',
  express.json(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const timeRange = req.query.timeRange || '24h';

      const analytics = await webhookSubscriptionService.getDeliveryAnalytics(id, timeRange, {
        userId: req.user?.id,
        practiceId: req.practice?.id
      });

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to get delivery analytics',
          he: 'שגיאה בקבלת אנליטיקה'
        },
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/webhooks/subscriptions/:id/test
 * @desc Test webhook subscription
 * @access Private
 */
router.post('/subscriptions/:id/test',
  express.json(),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await webhookSubscriptionService.testWebhook(id, {
        userId: req.user?.id,
        practiceId: req.practice?.id
      });

      res.json({
        success: result.success,
        data: result
      });

    } catch (error) {
      console.error('Test webhook error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to test webhook',
          he: 'שגיאה בבדיקת webhook'
        }
      });
    }
  }
);

// ========== WEBHOOK HEALTH AND TESTING ==========

/**
 * @route GET /api/webhooks/health
 * @desc Webhook system health check
 * @access Public
 */
router.get('/health',
  express.json(),
  async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          webhookProcessor: 'operational',
          eventQueue: 'operational',
          retryService: 'operational'
        },
        metrics: await webhookManagementService.getProcessingMetrics()
      };

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('Webhook health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Webhook system experiencing issues'
      });
    }
  }
);

/**
 * @route POST /api/webhooks/test/:providerId
 * @desc Test webhook endpoint with sample data
 * @access Private (development only)
 */
router.post('/test/:providerId',
  express.json(),
  async (req, res) => {
    try {
      // Only allow in development
      if (secureConfigService.get('NODE_ENV') === 'production') {
        return res.status(403).json({
          error: {
            en: 'Testing not available in production',
            he: 'בדיקה לא זמינה בסביבת ייצור'
          }
        });
      }

      const { providerId } = req.params;
      const testData = req.body || {
        eventType: 'test_event',
        data: { test: true, timestamp: new Date() }
      };

      // Create test webhook event
      const result = await webhookManagementService.processWebhook({
        providerId,
        eventType: testData.eventType,
        eventId: `test-${crypto.randomUUID()}`,
        timestamp: new Date(),
        data: testData.data,
        test: true
      });

      res.json({
        success: true,
        message: 'Test webhook processed',
        data: result
      });

    } catch (error) {
      console.error('Test webhook error:', error);
      res.status(500).json({
        error: {
          en: 'Failed to process test webhook',
          he: 'שגיאה בעיבוד webhook בדיקה'
        }
      });
    }
  }
);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Webhook route error:', error);
  
  res.status(500).json({
    error: {
      en: 'Webhook processing failed',
      he: 'עיבוד Webhook נכשל'
    },
    message: secureConfigService.get('NODE_ENV') === 'development' ? error.message : 'Internal server error'
  });
});

module.exports = router;