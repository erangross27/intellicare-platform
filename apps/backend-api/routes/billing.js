const express = require('express');
const router = express.Router();
const billingService = require('../services/billingService');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { body, query, param } = require('express-validator');
const AuditLog = require('../models/AuditLog');

router.use(authenticate);

router.post('/charges/capture',
  requireRole(['admin', 'doctor', 'nurse']),
  [
    body('patientId').isMongoId().withMessage('Invalid patient ID'),
    body('providerId').isMongoId().withMessage('Invalid provider ID'),
    body('appointmentId').optional().isMongoId(),
    body('serviceDate').isISO8601().withMessage('Invalid service date'),
    body('cptCode').isLength({ min: 5, max: 5 }).withMessage('Invalid CPT code'),
    body('modifiers').optional().isArray(),
    body('diagnosisCodes').isArray().withMessage('Diagnosis codes required'),
    body('units').optional().isInt({ min: 1 }),
    body('duration').optional().isInt({ min: 1 }),
    body('placeOfService').optional().isLength({ min: 2, max: 2 })
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        role: req.user.role
      };

      const charge = await billingService.captureCharge(req.body, context);

      res.json({
        success: true,
        charge
      });
    } catch (error) {
      console.error('Error capturing charge:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בתיעוד החיוב',
          en: 'Error capturing charge'
        }
      });
    }
  }
);

router.post('/insurance/verify',
  requireRole(['admin', 'doctor', 'nurse']),
  [
    body('patientId').isMongoId().withMessage('Invalid patient ID'),
    body('payerId').notEmpty().withMessage('Payer ID required'),
    body('subscriberId').notEmpty().withMessage('Subscriber ID required'),
    body('serviceDate').optional().isISO8601()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        role: req.user.role
      };

      const eligibility = await billingService.verifyInsuranceEligibility(req.body, context);

      res.json({
        success: true,
        eligibility
      });
    } catch (error) {
      console.error('Error verifying insurance:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה באימות ביטוח',
          en: 'Error verifying insurance'
        }
      });
    }
  }
);

router.post('/payments/process',
  requireRole(['admin']),
  [
    body('invoiceId').isMongoId().withMessage('Invalid invoice ID'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Invalid amount'),
    body('paymentMethod').isIn(['credit_card', 'debit_card', 'ach', 'cash', 'check']),
    body('paymentDetails').isObject(),
    body('patientId').optional().isMongoId()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        role: req.user.role
      };

      const payment = await billingService.processPayment(req.body, context);

      res.json({
        success: true,
        payment
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בעיבוד התשלום',
          en: 'Error processing payment'
        }
      });
    }
  }
);

router.get('/reports/revenue',
  requireRole(['admin']),
  [
    query('startDate').isISO8601().withMessage('Invalid start date'),
    query('endDate').isISO8601().withMessage('Invalid end date')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        role: req.user.role
      };

      const report = await billingService.generateRevenueReport(
        {
          startDate: req.query.startDate,
          endDate: req.query.endDate
        },
        context
      );

      // Create audit log entry using SecureDataAccess
      const auditContext = {
        userId: req.user?.id || 'anonymous',
        apiKey: req.headers['x-api-key'],
        practiceId: req.practice.id
      };
      
      await SecureDataAccess.insert('audit_logs', {
        action: 'REVENUE_REPORT_GENERATED',
        category: 'billing',
        userId: req.user.id,
        practiceId: req.practice.id,
        metadata: {
          dateRange: {
            startDate: req.query.startDate,
            endDate: req.query.endDate
          }
        },
        timestamp: new Date()
      }, auditContext);

      res.json({
        success: true,
        report
      });
    } catch (error) {
      console.error('Error generating revenue report:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה ביצירת דוח הכנסות',
          en: 'Error generating revenue report'
        }
      });
    }
  }
);

router.post('/claims/submit',
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        role: req.user.role
      };

      await billingService.processBatchCharges(context);
      await billingService.submitBatchClaims(context);

      res.json({
        success: true,
        message: {
          he: 'תביעות נשלחו בהצלחה',
          en: 'Claims submitted successfully'
        }
      });
    } catch (error) {
      console.error('Error submitting claims:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בשליחת תביעות',
          en: 'Error submitting claims'
        }
      });
    }
  }
);

router.post('/remittance/process',
  requireRole(['admin']),
  [
    body('payerId').notEmpty().withMessage('Payer ID required'),
    body('checkNumber').notEmpty().withMessage('Check number required'),
    body('paymentAmount').isFloat({ min: 0 }),
    body('claimPayments').isArray()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        role: req.user.role
      };

      const remittance = await billingService.processRemittance(req.body, context);

      res.json({
        success: true,
        remittance
      });
    } catch (error) {
      console.error('Error processing remittance:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בעיבוד דוח תשלום',
          en: 'Error processing remittance'
        }
      });
    }
  }
);

router.post('/payment-plans/create',
  requireRole(['admin']),
  [
    body('patientId').isMongoId().withMessage('Invalid patient ID'),
    body('invoiceIds').isArray(),
    body('totalAmount').isFloat({ min: 0 }),
    body('downPayment').isFloat({ min: 0 }),
    body('numberOfInstallments').isInt({ min: 1, max: 36 }),
    body('startDate').isISO8601()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        role: req.user.role
      };

      const paymentPlan = await billingService.createPaymentPlan(req.body, context);

      res.json({
        success: true,
        paymentPlan
      });
    } catch (error) {
      console.error('Error creating payment plan:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה ביצירת תכנית תשלומים',
          en: 'Error creating payment plan'
        }
      });
    }
  }
);

router.get('/charges/:patientId',
  requireRole(['admin', 'doctor', 'nurse']),
  [
    param('patientId').isMongoId().withMessage('Invalid patient ID')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const SecureDataAccess = require('../services/secureDataAccess');
      
      const charges = await SecureDataAccess.query(
        'charges',
        { 
          patientId: req.params.patientId,
          practiceId: req.practice.id
        },
        { sort: { serviceDate: -1 }, limit: 100 },
        {
          userId: req.user?.id || 'anonymous',
          apiKey: req.headers['x-api-key'],
          practiceId: req.practice.id
        }
      );

      res.json({
        success: true,
        charges
      });
    } catch (error) {
      console.error('Error fetching charges:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בטעינת חיובים',
          en: 'Error loading charges'
        }
      });
    }
  }
);

router.get('/invoices/:patientId',
  requireRole(['admin', 'doctor', 'nurse']),
  [
    param('patientId').isMongoId().withMessage('Invalid patient ID')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const SecureDataAccess = require('../services/secureDataAccess');
      
      const invoices = await SecureDataAccess.query(
        'invoices',
        { 
          patientId: req.params.patientId,
          practiceId: req.practice.id
        },
        { sort: { createdAt: -1 }, limit: 100 },
        {
          userId: req.user?.id || 'anonymous',
          apiKey: req.headers['x-api-key'],
          practiceId: req.practice.id
        }
      );

      res.json({
        success: true,
        invoices
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בטעינת חשבוניות',
          en: 'Error loading invoices'
        }
      });
    }
  }
);

router.get('/claims',
  requireRole(['admin']),
  [
    query('status').optional().isIn(['pending', 'submitted', 'processing', 'paid', 'denied']),
    query('payerId').optional().notEmpty(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const SecureDataAccess = require('../services/secureDataAccess');
      
      const filter = { practiceId: req.practice.id };
      
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.payerId) {
        filter.payerId = req.query.payerId;
      }
      if (req.query.startDate || req.query.endDate) {
        filter.createdAt = {};
        if (req.query.startDate) {
          filter.createdAt.$gte = new Date(req.query.startDate);
        }
        if (req.query.endDate) {
          filter.createdAt.$lte = new Date(req.query.endDate);
        }
      }

      const claims = await SecureDataAccess.query(
        'claims',
        filter,
        { sort: { createdAt: -1 }, limit: 1000 },
        {
          userId: req.user?.id || 'anonymous',
          apiKey: req.headers['x-api-key'],
          practiceId: req.practice.id
        }
      );

      res.json({
        success: true,
        claims
      });
    } catch (error) {
      console.error('Error fetching claims:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בטעינת תביעות',
          en: 'Error loading claims'
        }
      });
    }
  }
);

router.get('/payment-history/:patientId',
  requireRole(['admin', 'doctor', 'nurse']),
  [
    param('patientId').isMongoId().withMessage('Invalid patient ID')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const SecureDataAccess = require('../services/secureDataAccess');
      
      const payments = await SecureDataAccess.query(
        'payments',
        { 
          patientId: req.params.patientId,
          practiceId: req.practice.id,
          status: 'completed'
        },
        { sort: { processedAt: -1 }, limit: 100 },
        {
          userId: req.user?.id || 'anonymous',
          apiKey: req.headers['x-api-key'],
          practiceId: req.practice.id
        }
      );

      const paymentPlans = await SecureDataAccess.query(
        'payment_plans',
        { 
          patientId: req.params.patientId,
          practiceId: req.practice.id
        },
        { sort: { createdAt: -1 }, limit: 10 },
        {
          userId: req.user?.id || 'anonymous',
          apiKey: req.headers['x-api-key'],
          practiceId: req.practice.id
        }
      );

      res.json({
        success: true,
        payments,
        paymentPlans
      });
    } catch (error) {
      console.error('Error fetching payment history:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בטעינת היסטוריית תשלומים',
          en: 'Error loading payment history'
        }
      });
    }
  }
);

router.get('/analytics/dashboard',
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const SecureDataAccess = require('../services/secureDataAccess');
      const context = {
        userId: req.user?.id || 'anonymous',
        apiKey: req.headers['x-api-key'],
        practiceId: req.practice.id
      };

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [charges, payments, claims, invoices] = await Promise.all([
        SecureDataAccess.query(
          'charges',
          {
            practiceId: req.practice.id,
            captureDate: { $gte: thirtyDaysAgo }
          },
          { limit: 1000 },
          context
        ),
        SecureDataAccess.query(
          'payments',
          {
            practiceId: req.practice.id,
            processedAt: { $gte: thirtyDaysAgo },
            status: 'completed'
          },
          { limit: 1000 },
          context
        ),
        SecureDataAccess.query(
          'claims',
          {
            practiceId: req.practice.id,
            createdAt: { $gte: thirtyDaysAgo }
          },
          { limit: 1000 },
          context
        ),
        SecureDataAccess.query(
          'invoices',
          {
            practiceId: req.practice.id,
            createdAt: { $gte: thirtyDaysAgo }
          },
          { limit: 1000 },
          context
        )
      ]);

      const totalCharges = charges.reduce((sum, c) => sum + (c.rvu * 100), 0);
      const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
      const totalInvoiced = invoices.reduce((sum, i) => sum + i.total, 0);
      const totalPaid = invoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0);

      const dashboard = {
        period: '30_days',
        summary: {
          totalCharges,
          totalPayments,
          totalInvoiced,
          totalPaid,
          outstandingBalance: totalInvoiced - totalPaid,
          collectionRate: totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0
        },
        charges: {
          count: charges.length,
          average: charges.length > 0 ? totalCharges / charges.length : 0
        },
        payments: {
          count: payments.length,
          average: payments.length > 0 ? totalPayments / payments.length : 0
        },
        claims: {
          total: claims.length,
          pending: claims.filter(c => c.status === 'pending').length,
          submitted: claims.filter(c => c.status === 'submitted').length,
          paid: claims.filter(c => c.status === 'paid').length,
          denied: claims.filter(c => c.status === 'denied').length
        },
        invoices: {
          total: invoices.length,
          pending: invoices.filter(i => i.status === 'pending').length,
          partial: invoices.filter(i => i.status === 'partial').length,
          paid: invoices.filter(i => i.status === 'paid').length
        }
      };

      res.json({
        success: true,
        dashboard
      });
    } catch (error) {
      console.error('Error generating billing dashboard:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בטעינת לוח המחוונים',
          en: 'Error loading dashboard'
        }
      });
    }
  }
);

module.exports = router;