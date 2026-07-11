const { ObjectId } = require('mongodb');
const SecureDataAccess = require('../services/secureDataAccess');
const express = require('express');
const router = express.Router();
const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../middleware/practiceContext');
const cron = require('node-cron');
const EmailService = require('../services/emailService');
const bulkCommunicationService = require('../services/bulkCommunicationService');
const patientPortalMessagingService = require('../services/patientPortalMessagingService');

// Apply middleware to all routes
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

// Store scheduled reminders in memory (in production, use database)
const scheduledReminders = new Map();

/**
 * @route   POST /communication/reminder
 * @desc    Schedule a reminder (called by agent when user asks via chat)
 * @access  Private
 */
router.post('/reminder', async (req, res) => {
  try {
    const { patientId, reminderType, dateTime, message, appointmentId } = req.body;
    
    console.log('📅 Scheduling reminder via chat request:', {
      patientId,
      reminderType,
      dateTime,
      message
    });
    
    // Create context for SecureDataAccess
    const context = {
      serviceId: 'communication-service',
      operation: 'schedule-reminder',
      practiceId: req.practiceSubdomain || 'global'
    };
    
    // Get patient details
    const patientResult = await SecureDataAccess.query('patients', { _id: patientObjectId }, { limit: 1 }, context);
    const patient = patientResult[0];
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    // Parse the reminder date/time - handle various formats
    let reminderDate;
    
    // Check if dateTime is already a valid ISO string
    if (dateTime && dateTime.includes('T')) {
      reminderDate = new Date(dateTime);
    } 
    // Handle DD/MM/YYYY HH:MM format (Israeli format)
    else if (dateTime && dateTime.match(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/)) {
      const [datePart, timePart] = dateTime.split(' ');
      const [day, month, year] = datePart.split('/');
      const [hour, minute] = timePart.split(':');
      reminderDate = new Date(year, month - 1, day, hour, minute);
    }
    // Handle other formats
    else {
      reminderDate = new Date(dateTime);
    }
    
    // Validate the parsed date
    if (isNaN(reminderDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: req.country === 'Israel' 
          ? 'פורמט תאריך לא תקין. השתמש בפורמט DD/MM/YYYY HH:MM'
          : 'Invalid date format. Use format DD/MM/YYYY HH:MM or ISO format'
      });
    }
    
    const now = new Date();
    
    if (reminderDate <= now) {
      return res.status(400).json({
        success: false,
        error: req.country === 'Israel' 
          ? 'לא ניתן לקבוע תזכורת לזמן שעבר'
          : 'Cannot schedule reminder for past time'
      });
    }
    
    // If it's an appointment reminder, get appointment details
    let appointmentDetails = null;
    if (appointmentId) {
      const appointmentResult = await SecureDataAccess.query('appointments', { _id: appointmentObjectId }, { limit: 1 }, context);
      const appointment = appointmentResult[0];
      
      // Get provider and patient details if appointment exists
      if (appointment) {
        const providerResult = await SecureDataAccess.query('providers', { _id: appointment.providerId }, { limit: 1 }, context);
        const patientResult = await SecureDataAccess.query('patients', { _id: appointment.patientId }, { limit: 1 }, context);
        appointment.providerId = providerResult[0];
        appointment.patientId = patientResult[0];
      }
      
      if (appointment) {
        appointmentDetails = {
          date: appointment.appointmentDate,
          time: appointment.appointmentTime,
          providerName: appointment.providerId?.name || 'Provider',
          patientName: appointment.patientId?.name || patient.name
        };
      }
    }
    
    // Create reminder object
    const reminder = {
      id: `REM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientId: patientId,
      patientName: patient.name,
      patientEmail: patient.email,
      patientPhone: patient.phone,
      reminderType: reminderType,
      scheduledFor: reminderDate,
      message: message || generateReminderMessage(reminderType, appointmentDetails, req.country),
      appointmentId: appointmentId,
      createdBy: req.user ? req.user.id : 'system',
      createdAt: new Date(),
      practiceId: req.practiceContext?.practiceId || req.practiceDb?.name?.replace('intellicare_practice_', '') || 'default',
      status: 'scheduled'
    };
    
    // Calculate when to send (for appointments, send 24 hours before)
    let sendTime = new Date(reminderDate);
    if (reminderType === 'appointment' && !message) {
      sendTime.setHours(sendTime.getHours() - 24); // Send 24 hours before
    }
    
    // Adjust send time to avoid sleeping hours (22:00 - 07:00)
    const sendHour = sendTime.getHours();
    if (sendHour >= 22 || sendHour < 7) {
      // If it's late night (22:00-23:59), move to next day 9:00 AM
      if (sendHour >= 22) {
        sendTime.setDate(sendTime.getDate() + 1);
        sendTime.setHours(9, 0, 0, 0);
      }
      // If it's early morning (00:00-06:59), move to 9:00 AM same day
      else {
        sendTime.setHours(9, 0, 0, 0);
      }
      
      console.log(`⏰ Adjusted reminder time from sleeping hours to: ${sendTime.toLocaleString(req.country === 'Israel' ? 'he-IL' : 'en-US')}`);
    }
    
    // Store in database using SecureDataAccess
    const savedReminder = await SecureDataAccess.insert('reminderlogs', reminder, context);
    
    // Schedule the reminder
    scheduleReminder(savedReminder, sendTime, req.practiceContext || { practiceId: reminder.practiceId });
    
    // Update appointment if linked
    if (appointmentId) {
      const updateData = {
        $push: {
          remindersSent: {
            type: 'email',
            sentDate: sendTime,
            sentBy: 'system',
            delivered: false
          }
        }
      };
      await SecureDataAccess.update('appointments', { _id: appointmentObjectId }, updateData, context);
    }
    
    // Check if time was adjusted
    const wasAdjusted = sendTime.getTime() !== reminderDate.getTime() && reminderType === 'appointment';
    
    res.json({
      success: true,
      data: {
        reminderId: savedReminder.id,
        scheduledFor: reminderDate,
        willBeSentAt: sendTime,
        message: savedReminder.message,
        wasAdjustedForSleepingHours: wasAdjusted
      },
      message: req.country === 'Israel'
        ? wasAdjusted 
          ? `תזכורת נקבעה בהצלחה ותישלח ב-${sendTime.toLocaleString('he-IL')} (הותאמה לשעות פעילות)`
          : `תזכורת נקבעה בהצלחה ל-${sendTime.toLocaleString('he-IL')}`
        : wasAdjusted
          ? `Reminder scheduled successfully and will be sent at ${sendTime.toLocaleString('en-US')} (adjusted to business hours)`
          : `Reminder scheduled successfully for ${sendTime.toLocaleString('en-US')}`
    });
    
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule reminder',
      details: error.message
    });
  }
});

/**
 * @route   POST /communication/sms
 * @desc    Send SMS (placeholder - implement with Twilio/etc)
 * @access  Private
 */
router.post('/sms', async (req, res) => {
  try {
    const { to, message, patientId } = req.body;
    
    console.log('📱 SMS request via chat:', { to, message });
    
    // TODO: Implement actual SMS sending with Twilio or similar
    // For now, just log and return success
    
    res.json({
      success: true,
      message: req.country === 'Israel'
        ? 'הודעת SMS נשלחה בהצלחה'
        : 'SMS sent successfully',
      data: {
        to,
        message,
        status: 'sent',
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send SMS'
    });
  }
});

/**
 * @route   GET /communication/reminder-history
 * @desc    Get reminder history for a patient or all reminders
 * @access  Private
 */
router.get('/reminder-history', async (req, res) => {
  try {
    const { patientId, appointmentId, startDate, endDate } = req.query;
    
    // Build query
    const query = {};
    
    if (patientId) {
      query.patientId = patientId;
    }
    
    if (appointmentId) {
      query.appointmentId = appointmentId;
    }
    
    if (startDate || endDate) {
      query.scheduledFor = {};
      if (startDate) query.scheduledFor.$gte = new Date(startDate);
      if (endDate) query.scheduledFor.$lte = new Date(endDate);
    }
    
    // Create context for SecureDataAccess
    const context = {
      serviceId: 'communication-service',
      operation: 'get-reminder-history',
      practiceId: req.practiceSubdomain || 'global'
    };
    
    // Get reminders from database
    const reminders = await SecureDataAccess.query('reminderlogs', query, {
      sort: { scheduledFor: -1 },
      limit: 100
    }, context);
    
    // Format the response
    const formattedReminders = reminders.map(reminder => ({
      id: reminder.id,
      patientId: reminder.patientId,
      patientName: reminder.patientName,
      type: reminder.reminderType,
      status: reminder.status,
      message: reminder.message,
      scheduledFor: reminder.scheduledFor,
      actualSendTime: reminder.actualSendTime || reminder.scheduledFor,
      appointmentId: reminder.appointmentId,
      createdAt: reminder.createdAt,
      sentAt: reminder.sentAt,
      deliveryStatus: reminder.deliveryStatus
    }));
    
    res.json({
      success: true,
      data: formattedReminders,
      count: formattedReminders.length,
      message: req.country === 'Israel'
        ? `נמצאו ${formattedReminders.length} תזכורות`
        : `Found ${formattedReminders.length} reminders`
    });
    
  } catch (error) {
    console.error('Error fetching reminder history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reminder history',
      details: error.message
    });
  }
});

/**
 * @route   POST /communication/email
 * @desc    Send email via chat request
 * @access  Private
 */
router.post('/email', async (req, res) => {
  try {
    const { to, subject, message, patientId, html } = req.body;
    
    console.log('📧 Email request via chat:', { to, subject });
    
    // EmailService is already instantiated as singleton
    
    // Send email using the existing email service
    await EmailService.sendCustomEmail({
      to,
      subject,
      text: message,
      html: html || `<p>${message}</p>`
    });
    
    res.json({
      success: true,
      message: req.country === 'Israel'
        ? 'אימייל נשלח בהצלחה'
        : 'Email sent successfully',
      data: {
        to,
        subject,
        status: 'sent',
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: error.message
    });
  }
});

// Helper function to generate reminder messages
function generateReminderMessage(type, appointmentDetails, country) {
  const isHebrew = country === 'Israel';
  
  switch(type) {
    case 'appointment':
      if (appointmentDetails) {
        return isHebrew
          ? `תזכורת: יש לך תור אצל ${appointmentDetails.providerName} ב-${appointmentDetails.date} בשעה ${appointmentDetails.time}`
          : `Reminder: You have an appointment with ${appointmentDetails.providerName} on ${appointmentDetails.date} at ${appointmentDetails.time}`;
      }
      return isHebrew ? 'תזכורת לתור הקרוב שלך' : 'Reminder for your upcoming appointment';
      
    case 'medication':
      return isHebrew ? 'תזכורת לקחת תרופות' : 'Medication reminder';
      
    case 'follow-up':
      return isHebrew ? 'תזכורת למעקב רפואי' : 'Medical follow-up reminder';
      
    default:
      return isHebrew ? 'תזכורת' : 'Reminder';
  }
}

// Helper function to schedule reminder
function scheduleReminder(reminder, sendTime, practiceContext) {
  const now = new Date();
  const delay = sendTime.getTime() - now.getTime();
  
  if (delay <= 0) {
    // Send immediately if time has passed
    sendReminderNow(reminder, practiceContext);
  } else if (delay < 24 * 60 * 60 * 1000) { // Less than 24 hours
    // Use setTimeout for short delays
    setTimeout(() => {
      sendReminderNow(reminder, practiceContext);
    }, delay);
    
    // Store timeout reference
    scheduledReminders.set(reminder.id, 'timeout');
  } else {
    // For longer delays, use node-cron to check daily
    const cronTime = `${sendTime.getMinutes()} ${sendTime.getHours()} ${sendTime.getDate()} ${sendTime.getMonth() + 1} *`;
    const task = cron.schedule(cronTime, () => {
      sendReminderNow(reminder, practiceContext);
      task.stop();
      scheduledReminders.delete(reminder.id);
    });
    
    // Store cron task reference
    scheduledReminders.set(reminder.id, task);
  }
  
  console.log(`⏰ Reminder ${reminder.id} scheduled for ${sendTime}`);
}

// Function to send reminder immediately
async function sendReminderNow(reminder, practiceContext) {
  try {
    console.log(`📤 Sending reminder ${reminder.id} to ${reminder.patientEmail}`);
    
    // EmailService is already instantiated as singleton
    
    // Send email reminder
    if (reminder.patientEmail) {
      await EmailService.sendCustomEmail({
        to: reminder.patientEmail,
        subject: 'IntelliCare Reminder',
        text: reminder.message,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>IntelliCare Reminder</h2>
            <p>${reminder.message}</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              This is an automated reminder from IntelliCare.
            </p>
          </div>
        `
      });
      
      console.log(`✅ Reminder sent successfully to ${reminder.patientEmail}`);
    }
    
    // TODO: Send SMS if phone number available and SMS service configured
    
    // Update reminder status in database
    // Note: Would need to reconnect to correct practice DB here
    
  } catch (error) {
    console.error(`❌ Failed to send reminder ${reminder.id}:`, error);
  }
}

// Create ReminderLog model if it doesn't exist
function createReminderModel(practiceDb) {
  const mongoose = require('mongoose');
  
  // Check if model already exists
  if (practiceDb.models.ReminderLog) {
    return practiceDb.models.ReminderLog;
  }
  
  const reminderSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    patientName: String,
    patientEmail: String,
    patientPhone: String,
    reminderType: {
      type: String,
      enum: ['appointment', 'medication', 'follow-up', 'custom']
    },
    scheduledFor: Date,
    message: String,
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    status: {
      type: String,
      enum: ['scheduled', 'sent', 'failed', 'cancelled'],
      default: 'scheduled'
    },
    sentAt: Date,
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    practiceId: String
  });
  
  return practiceDb.model('ReminderLog', reminderSchema);
}

// Cache statistics endpoint (removed - Gemini service deleted)
/*
router.get('/cache-stats', practiceAuth, async (req, res) => {
  try {
    // Service removed
    const stats = cacheService.getStats();
    const cacheInfo = cacheService.getCacheInfo();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
        efficiency: stats.hits > 0 ? `${stats.hits} API calls saved` : 'No cache hits yet'
      },
      cache: {
        totalItems: cacheInfo.length,
        items: cacheInfo
      }
    });
  } catch (error) {
    console.error('[ERROR] Failed to get cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache statistics'
    });
  }
});

*/

// Cache management endpoint (removed - Gemini service deleted)
/*
router.post('/cache-clear', practiceAuth, async (req, res) => {
  try {
    // Service removed
    const { type } = req.body;
    
    let result;
    if (type === 'expired') {
      result = cacheService.clearExpired();
      res.json({
        success: true,
        message: `Cleared ${result} expired cache entries`
      });
    } else if (type === 'all') {
      result = cacheService.clear();
      res.json({
        success: true,
        message: `Cleared all ${result} cache entries`
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid clear type. Use "expired" or "all"'
      });
    }
  } catch (error) {
    console.error('[ERROR] Failed to clear cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * @route   POST /communication/bulk-sms
 * @desc    Send bulk SMS to patient groups
 * @access  Private
 */
router.post('/bulk-sms', async (req, res) => {
  try {
    const { 
      patientFilter, 
      message, 
      campaignName, 
      sendDateTime, 
      dryRun = false 
    } = req.body;
    
    console.log('📱 Bulk SMS request via chat:', { 
      filter: patientFilter, 
      campaignName, 
      dryRun 
    });
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: req.country === 'Israel' 
          ? 'נדרש תוכן הודעה'
          : 'Message content is required'
      });
    }
    
    // Initialize bulk communication service
    // bulkCommunicationService already initialized at startup
    const practiceContext = {
      practiceId: req.practiceContext?.practiceId || req.practiceDb?.name?.replace('intellicare_practice_', '') || 'default',
      userId: req.user?.id,
      country: req.country || 'US'
    };
    
    const result = await bulkCommunicationService.sendBulkPatientSMS({
      patientFilter,
      message,
      campaignName,
      sendDateTime,
      dryRun
    }, practiceContext);
    
    res.json({
      success: true,
      data: result,
      message: req.country === 'Israel'
        ? dryRun 
          ? `יישלח SMS ל-${result.totalPatients} מטופלים`
          : `נשלח SMS ל-${result.sent} מטופלים, ${result.failed} נכשלו`
        : dryRun
          ? `Would send SMS to ${result.totalPatients} patients`
          : `SMS sent to ${result.sent} patients, ${result.failed} failed`
    });
    
  } catch (error) {
    console.error('Error sending bulk SMS:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send bulk SMS',
      details: error.message
    });
  }
});

/**
 * @route   POST /communication/bulk-email
 * @desc    Send bulk email to patient groups
 * @access  Private
 */
router.post('/bulk-email', async (req, res) => {
  try {
    const { 
      patientFilter, 
      subject,
      body,
      htmlBody,
      campaignName, 
      sendDateTime, 
      dryRun = false 
    } = req.body;
    
    console.log('📧 Bulk email request via chat:', { 
      filter: patientFilter, 
      subject,
      campaignName, 
      dryRun 
    });
    
    if (!subject || !body) {
      return res.status(400).json({
        success: false,
        error: req.country === 'Israel' 
          ? 'נדרשים נושא ותוכן הודעה'
          : 'Subject and body are required'
      });
    }
    
    // Initialize bulk communication service
    // bulkCommunicationService already initialized at startup
    const practiceContext = {
      practiceId: req.practiceContext?.practiceId || req.practiceDb?.name?.replace('intellicare_practice_', '') || 'default',
      userId: req.user?.id,
      country: req.country || 'US'
    };
    
    const result = await bulkCommunicationService.sendBulkPatientEmail({
      patientFilter,
      subject,
      body,
      htmlBody,
      campaignName,
      sendDateTime,
      dryRun
    }, practiceContext);
    
    res.json({
      success: true,
      data: result,
      message: req.country === 'Israel'
        ? dryRun 
          ? `יישלח אימייל ל-${result.totalPatients} מטופלים`
          : `נשלח אימייל ל-${result.sent} מטופלים, ${result.failed} נכשלו`
        : dryRun
          ? `Would send email to ${result.totalPatients} patients`
          : `Email sent to ${result.sent} patients, ${result.failed} failed`
    });
    
  } catch (error) {
    console.error('Error sending bulk email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send bulk email',
      details: error.message
    });
  }
});

/**
 * @route   GET /communication/campaign-analytics
 * @desc    Get communication campaign analytics
 * @access  Private
 */
router.get('/campaign-analytics', async (req, res) => {
  try {
    const { campaignId, startDate, endDate, type } = req.query;
    
    console.log('📊 Campaign analytics request:', { campaignId, type });
    
    // Initialize bulk communication service
    // bulkCommunicationService already initialized at startup
    const practiceContext = {
      practiceId: req.practiceContext?.practiceId || req.practiceDb?.name?.replace('intellicare_practice_', '') || 'default',
      userId: req.user?.id
    };
    
    const analytics = await bulkCommunicationService.getCampaignAnalytics({
      campaignId,
      startDate,
      endDate,
      type
    }, practiceContext);
    
    res.json({
      success: true,
      data: analytics,
      message: req.country === 'Israel'
        ? `נמצאו ${analytics.totalCampaigns} קמפיינים`
        : `Found ${analytics.totalCampaigns} campaigns`
    });
    
  } catch (error) {
    console.error('Error getting campaign analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get campaign analytics',
      details: error.message
    });
  }
});

/**
 * @route   POST /communication/patient-message
 * @desc    Send secure message from patient to provider
 * @access  Private
 */
router.post('/patient-message', async (req, res) => {
  try {
    const { patientId, providerId, message, messageType, urgent } = req.body;
    
    console.log('💬 Patient portal message request:', { patientId, messageType, urgent });
    
    if (!patientId || !message) {
      return res.status(400).json({
        success: false,
        error: req.country === 'Israel' 
          ? 'נדרש מזהה מטופל ותוכן הודעה'
          : 'Patient ID and message are required'
      });
    }
    
    // Initialize patient portal messaging service
    // patientPortalMessagingService already initialized at startup
    const practiceContext = {
      practiceId: req.practiceContext?.practiceId || req.practiceDb?.name?.replace('intellicare_practice_', '') || 'default',
      userId: req.user?.id,
      country: req.country || 'US'
    };
    
    const result = await patientPortalMessagingService.sendPatientPortalMessage({
      patientId,
      providerId,
      message,
      messageType,
      urgent
    }, practiceContext);
    
    res.json({
      success: true,
      data: result,
      message: req.country === 'Israel'
        ? 'הודעה נשלחה בהצלחה לרופא'
        : 'Message sent successfully to provider'
    });
    
  } catch (error) {
    console.error('Error sending patient portal message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send patient message',
      details: error.message
    });
  }
});

/**
 * @route   POST /communication/prescription-refill
 * @desc    Handle prescription refill request from patient
 * @access  Private
 */
router.post('/prescription-refill', async (req, res) => {
  try {
    const { patientId, medicationName, prescriptionId, reason, urgentNeed } = req.body;
    
    console.log('💊 Prescription refill request:', { patientId, medicationName, urgentNeed });
    
    if (!patientId || !medicationName) {
      return res.status(400).json({
        success: false,
        error: req.country === 'Israel' 
          ? 'נדרש מזהה מטופל ושם תרופה'
          : 'Patient ID and medication name are required'
      });
    }
    
    // Initialize patient portal messaging service
    // patientPortalMessagingService already initialized at startup
    const practiceContext = {
      practiceId: req.practiceContext?.practiceId || req.practiceDb?.name?.replace('intellicare_practice_', '') || 'default',
      userId: req.user?.id,
      country: req.country || 'US'
    };
    
    const result = await patientPortalMessagingService.requestPrescriptionRefill({
      patientId,
      medicationName,
      prescriptionId,
      reason,
      urgentNeed
    }, practiceContext);
    
    res.json({
      success: true,
      data: result,
      message: req.country === 'Israel'
        ? urgentNeed 
          ? 'בקשה דחופה לחידוש מרשם נשלחה'
          : 'בקשת חידוש מרשם נשלחה בהצלחה'
        : urgentNeed
          ? 'Urgent refill request submitted'
          : 'Prescription refill request submitted successfully'
    });
    
  } catch (error) {
    console.error('Error processing prescription refill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process prescription refill request',
      details: error.message
    });
  }
});

/**
 * @route   POST /communication/symptom-report
 * @desc    Handle patient symptom report with automatic triage
 * @access  Private
 */
router.post('/symptom-report', async (req, res) => {
  try {
    const { patientId, symptoms, severity, duration, additionalInfo, emergencyFlag } = req.body;
    
    console.log('🚨 Patient symptom report:', { patientId, severity, emergencyFlag });
    
    if (!patientId || !symptoms) {
      return res.status(400).json({
        success: false,
        error: req.country === 'Israel' 
          ? 'נדרש מזהה מטופל ותיאור תסמינים'
          : 'Patient ID and symptoms are required'
      });
    }
    
    // Initialize patient portal messaging service
    // patientPortalMessagingService already initialized at startup
    const practiceContext = {
      practiceId: req.practiceContext?.practiceId || req.practiceDb?.name?.replace('intellicare_practice_', '') || 'default',
      userId: req.user?.id,
      country: req.country || 'US'
    };
    
    const result = await patientPortalMessagingService.reportPatientSymptoms({
      patientId,
      symptoms,
      severity,
      duration,
      additionalInfo,
      emergencyFlag
    }, practiceContext);
    
    res.json({
      success: true,
      data: result,
      message: req.country === 'Israel'
        ? result.emergencyFlag 
          ? '⚠️ דיווח תסמינים דחוף נשלח - הרופא יצור קשר בהקדם'
          : 'דיווח תסמינים נשלח בהצלחה'
        : result.emergencyFlag
          ? '⚠️ Emergency symptom report submitted - provider will contact you immediately'
          : 'Symptom report submitted successfully'
    });
    
  } catch (error) {
    console.error('Error processing symptom report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process symptom report',
      details: error.message
    });
  }
});

/**
 * @route   POST /communication/appointment-request
 * @desc    Handle patient appointment scheduling request
 * @access  Private
 */
router.post('/appointment-request', async (req, res) => {
  try {
    const { patientId, providerId, appointmentType, preferredDate, preferredTime, reason, urgentRequest } = req.body;
    
    console.log('📅 Patient appointment request:', { patientId, appointmentType, urgentRequest });
    
    if (!patientId || !appointmentType) {
      return res.status(400).json({
        success: false,
        error: req.country === 'Israel' 
          ? 'נדרש מזהה מטופל וסוג תור'
          : 'Patient ID and appointment type are required'
      });
    }
    
    // Initialize patient portal messaging service
    // patientPortalMessagingService already initialized at startup
    const practiceContext = {
      practiceId: req.practiceContext?.practiceId || req.practiceDb?.name?.replace('intellicare_practice_', '') || 'default',
      userId: req.user?.id,
      country: req.country || 'US'
    };
    
    const result = await patientPortalMessagingService.schedulePatientAppointment({
      patientId,
      providerId,
      appointmentType,
      preferredDate,
      preferredTime,
      reason,
      urgentRequest
    }, practiceContext);
    
    res.json({
      success: true,
      data: result,
      message: req.country === 'Israel'
        ? result.status === 'confirmed' 
          ? 'התור אושר בהצלחה'
          : 'בקשת התור נשלחה - נחזור אליך עם זמנים פנויים'
        : result.status === 'confirmed'
          ? 'Appointment confirmed successfully'
          : 'Appointment request submitted - we will contact you with available times'
    });
    
  } catch (error) {
    console.error('Error processing appointment request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process appointment request',
      details: error.message
    });
  }
});

/**
 * @route   GET /communication/patient-messages
 * @desc    Get patient message history and conversation threads
 * @access  Private
 */
router.get('/patient-messages', async (req, res) => {
  try {
    const { patientId, providerId, threadId, limit } = req.query;
    
    console.log('📋 Get patient message history:', { patientId, limit });
    
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: req.country === 'Israel' 
          ? 'נדרש מזהה מטופל'
          : 'Patient ID is required'
      });
    }
    
    // Initialize patient portal messaging service
    // patientPortalMessagingService already initialized at startup
    const practiceContext = {
      practiceId: req.practiceContext?.practiceId || req.practiceDb?.name?.replace('intellicare_practice_', '') || 'default',
      userId: req.user?.id,
      country: req.country || 'US'
    };
    
    const result = await patientPortalMessagingService.getPatientMessageHistory({
      patientId,
      providerId,
      threadId,
      limit: limit ? parseInt(limit) : 50
    }, practiceContext);
    
    res.json({
      success: true,
      data: result,
      message: req.country === 'Israel'
        ? `נמצאו ${result.totalMessages} הודעות`
        : `Found ${result.totalMessages} messages`
    });
    
  } catch (error) {
    console.error('Error getting patient message history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get patient message history',
      details: error.message
    });
  }
});

module.exports = router;