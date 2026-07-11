const express = require('express');
const router = express.Router();
const smsService = require('../services/smsService');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { body, query, param } = require('express-validator');
const AuditLog = require('../models/AuditLog');

// SMS service is now initialized at server startup

// Send SMS - requires authentication
router.post('/send',
  authenticate,
  requireRole(['admin', 'doctor', 'nurse']),
  [
    body('to').notEmpty().withMessage('Phone number is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('patientId').optional().isMongoId(),
    body('type').optional().isIn(['general', 'appointment_reminder', 'test_result', 'prescription'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        country: req.practice.country || 'US'
      };

      const result = await smsService.sendSMS(req.body, context);

      if (result.success) {
        res.json({
          success: true,
          messageId: result.messageId,
          status: result.status
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            he: 'שגיאה בשליחת SMS',
            en: result.error || 'Failed to send SMS'
          }
        });
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאת שרת בשליחת SMS',
          en: 'Server error sending SMS'
        }
      });
    }
  }
);

// Twilio webhook for status callbacks - no auth required
router.post('/status', async (req, res) => {
  try {
    // Twilio sends status updates as form data
    await smsService.handleStatusCallback(req.body);
    
    // Respond with 200 OK to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling SMS status callback:', error);
    res.status(200).send('OK'); // Still respond with 200 to prevent retries
  }
});

// Twilio webhook for incoming SMS - no auth required
router.post('/incoming', async (req, res) => {
  try {
    const { From, Body, To } = req.body;
    
    // Handle opt-out keywords
    if (Body && Body.toUpperCase().trim() === 'STOP') {
      await smsService.handleOptOut(From, { country: 'US' });
      
      // Respond with TwiML to send confirmation
      res.type('text/xml');
      res.send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>You have been unsubscribed from SMS notifications.</Message>
        </Response>
      `);
    } else {
      // Log incoming message for support
      console.log(`Incoming SMS from ${From}: ${Body}`);
      
      // Respond with empty TwiML (no automatic response)
      res.type('text/xml');
      res.send(`
        <?xml version="1.0" encoding="UTF-8"?>
        <Response></Response>
      `);
    }
  } catch (error) {
    console.error('Error handling incoming SMS:', error);
    res.type('text/xml');
    res.send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response></Response>
    `);
  }
});

// Get SMS history for a patient
router.get('/history/:patientId',
  authenticate,
  requireRole(['admin', 'doctor', 'nurse']),
  [
    param('patientId').isMongoId().withMessage('Invalid patient ID')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const filters = {
        patientId: req.params.patientId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 50
      };

      const messages = await smsService.getMessageHistory(filters, context);

      res.json({
        success: true,
        messages
      });
    } catch (error) {
      console.error('Error fetching SMS history:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בטעינת היסטוריית SMS',
          en: 'Error loading SMS history'
        }
      });
    }
  }
);

// Update patient SMS preferences
router.put('/preferences/:patientId',
  authenticate,
  [
    param('patientId').isMongoId().withMessage('Invalid patient ID'),
    body('enabled').isBoolean(),
    body('reminders').optional().isBoolean(),
    body('marketing').optional().isBoolean()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      await smsService.updatePatientSMSPreference(
        req.params.patientId,
        req.body,
        context
      );

      res.json({
        success: true,
        message: {
          he: 'העדפות SMS עודכנו בהצלחה',
          en: 'SMS preferences updated successfully'
        }
      });
    } catch (error) {
      console.error('Error updating SMS preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בעדכון העדפות SMS',
          en: 'Error updating SMS preferences'
        }
      });
    }
  }
);

// Send bulk SMS (admin only)
router.post('/bulk',
  authenticate,
  requireRole(['admin']),
  [
    body('recipients').isArray().withMessage('Recipients array is required'),
    body('message').notEmpty().withMessage('Message is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        country: req.practice.country || 'US'
      };

      const results = await smsService.sendBulkSMS(
        req.body.recipients,
        req.body.message,
        context
      );

      // Create audit log entry using SecureDataAccess
      const auditContext = {
        serviceId: 'sms-service',
        apiKey: req.headers['x-api-key'],
        practiceId: req.practice.id
      };
      
      await SecureDataAccess.insert('audit_logs', {
        action: 'BULK_SMS_SENT',
        category: 'communication',
        userId: req.user.id,
        practiceId: req.practice.id,
        metadata: results,
        timestamp: new Date()
      }, auditContext);

      res.json({
        success: true,
        results
      });
    } catch (error) {
      console.error('Error sending bulk SMS:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בשליחת SMS קבוצתי',
          en: 'Error sending bulk SMS'
        }
      });
    }
  }
);

// Check if phone number is opted out
router.get('/opt-out-status/:phone',
  authenticate,
  async (req, res) => {
    try {
      const context = {
        practiceId: req.practice.id,
        country: req.practice.country || 'US'
      };

      const isOptedOut = await smsService.isOptedOut(req.params.phone, context);

      res.json({
        success: true,
        optedOut: isOptedOut
      });
    } catch (error) {
      console.error('Error checking opt-out status:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בבדיקת סטטוס הסרה',
          en: 'Error checking opt-out status'
        }
      });
    }
  }
);

// Test SMS configuration (admin only)
router.post('/test',
  authenticate,
  requireRole(['admin']),
  [
    body('phone').notEmpty().withMessage('Phone number is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        country: req.practice.country || 'US'
      };

      const testMessage = context.country === 'IL' 
        ? 'זוהי הודעת בדיקה ממערכת IntelliCare'
        : 'This is a test message from IntelliCare system';

      const result = await smsService.sendSMS({
        to: req.body.phone,
        message: testMessage,
        type: 'test'
      }, context);

      res.json({
        success: result.success,
        messageId: result.messageId,
        status: result.status,
        error: result.error
      });
    } catch (error) {
      console.error('Error sending test SMS:', error);
      res.status(500).json({
        success: false,
        error: {
          he: 'שגיאה בשליחת SMS בדיקה',
          en: 'Error sending test SMS'
        }
      });
    }
  }
);

module.exports = router;