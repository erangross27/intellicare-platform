const { ObjectId } = require('mongodb');
const express = require('express');
const router = express.Router();
const calendarSyncService = require('../services/calendarSyncService');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('../services/secureDataAccess');
const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext } = require('../middleware/practiceContext');
const roleModel = require('../config/roles');

/**
 * @route   GET /calendar/feed/:providerId/:token.ics
 * @desc    Get ICS calendar feed for provider
 * @access  Public with token
 */
router.get('/feed/:providerId/:token.ics', async (req, res) => {
  try {
    const { providerId, token } = req.params;
    
    // Extract actual token (remove .ics extension)
    const syncToken = token.replace('.ics', '');
    
    // Find user by provider ID and validate token
    const User = require('../models/User').model;
    const userResults = await SecureDataAccess.query('users', {
      $or: [
        { 'providerInfo.providerId': providerId }, 
        { _id: providerObjectId }
      ],
      'providerInfo.calendarSync.token': syncToken
    }, {}, context);

    const user = userResults[0];
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid calendar sync token'
      });
    }
    
    // Get provider's appointments
    const Appointment = require('../models/Appointment');
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1); // 1 month ago
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3); // 3 months ahead
    
    const appointments = await SecureDataAccess.query('appointments', {
      providerId: user.getProviderId(),
      scheduledDate: {
        $gte: startDate,
        $lte: endDate
      },
      status: { $ne: 'cancelled' }
    }, {}, context).sort({ scheduledDate: 1, scheduledTime: 1 });
    
    // Generate ICS feed
    const providerInfo = {
      name: user.getProviderName(),
      timezone: user.providerInfo?.timezone || 'Asia/Jerusalem'
    };
    
    const icsFeed = await calendarSyncService.generateICSFeed(
      user.getProviderId(),
      appointments,
      providerInfo
    );
    
    // Set headers for ICS file
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${user.getProviderName()}-schedule.ics"`);
    
    res.send(icsFeed);
    
  } catch (error) {
    console.error('Error generating calendar feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate calendar feed',
      details: error.message
    });
  }
});

/**
 * @route   POST /calendar/sync/enable
 * @desc    Enable calendar sync for provider
 * @access  Private
 */
router.post('/sync/enable', practiceAuth, practiceContext, async (req, res) => {
  try {
    const { format = 'ics' } = req.body;
    
    // Get user
    const userResults = await req.models.SecureDataAccess.query('users', { _id: req.user.id }, { limit: 1 }, context);

    const user = userResults[0];
    
    if (!user || !user.isProvider()) {
      return res.status(400).json({
        success: false,
        error: 'Calendar sync is only available for providers'
      });
    }
    
    // Generate sync URL
    const syncUrl = await calendarSyncService.generateSyncUrl(user, format);
    
    // Generate instructions based on format
    let instructions = '';
    switch(format) {
      case 'google':
        instructions = `
          To add to Google Calendar:
          1. Open Google Calendar
          2. Click the + next to "Other calendars"
          3. Select "From URL"
          4. Paste this URL: ${syncUrl}
          5. Click "Add calendar"
        `;
        break;
      case 'outlook':
        instructions = `
          To add to Outlook:
          1. Open Outlook Calendar
          2. Right-click "My Calendars"
          3. Select "Add Calendar" > "From Internet"
          4. Paste this URL: ${syncUrl}
          5. Click "OK"
        `;
        break;
      case 'apple':
        instructions = `
          To add to Apple Calendar:
          1. Open Calendar app
          2. Go to File > New Calendar Subscription
          3. Paste this URL: ${syncUrl}
          4. Click "Subscribe"
          5. Set refresh frequency as desired
        `;
        break;
      default:
        instructions = `
          To add to your calendar app:
          1. Open your calendar application
          2. Look for "Subscribe to calendar" or "Add calendar from URL"
          3. Paste this URL: ${syncUrl}
          4. Follow your app's instructions
        `;
    }
    
    res.json({
      success: true,
      data: {
        syncUrl: syncUrl,
        format: format,
        instructions: instructions.trim(),
        providerId: user.getProviderId(),
        providerName: user.getProviderName()
      },
      message: 'Calendar sync enabled successfully'
    });
    
  } catch (error) {
    console.error('Error enabling calendar sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable calendar sync',
      details: error.message
    });
  }
});

/**
 * @route   POST /calendar/sync/disable
 * @desc    Disable calendar sync for provider
 * @access  Private
 */
router.post('/sync/disable', practiceAuth, practiceContext, async (req, res) => {
  try {
    // Get user
    const userResults = await req.models.SecureDataAccess.query('users', { _id: req.user.id }, { limit: 1 }, context);

    const user = userResults[0];
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Clear calendar sync token
    if (user.providerInfo?.calendarSync) {
      user.providerInfo.calendarSync = {
        token: null,
        disabled: true,
        disabledAt: new Date()
      };
      await SecureDataAccess.update('collection', { _id: user._id }, user, context);
    }
    
    res.json({
      success: true,
      message: 'Calendar sync disabled successfully'
    });
    
  } catch (error) {
    console.error('Error disabling calendar sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable calendar sync',
      details: error.message
    });
  }
});

/**
 * @route   GET /calendar/sync/status
 * @desc    Get calendar sync status
 * @access  Private
 */
router.get('/sync/status', practiceAuth, practiceContext, async (req, res) => {
  try {
    // Get user
    const userResults = await req.models.SecureDataAccess.query('users', { _id: req.user.id }, { limit: 1 }, context);

    const user = userResults[0];
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const syncInfo = user.providerInfo?.calendarSync;
    
    res.json({
      success: true,
      data: {
        enabled: syncInfo?.token ? true : false,
        format: syncInfo?.format || null,
        createdAt: syncInfo?.createdAt || null,
        lastSync: syncInfo?.lastSync || null,
        googleConnected: syncInfo?.googleRefreshToken ? true : false,
        outlookConnected: syncInfo?.outlookRefreshToken ? true : false
      }
    });
    
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      details: error.message
    });
  }
});

/**
 * @route   POST /calendar/sync/google
 * @desc    Sync with Google Calendar
 * @access  Private
 */
router.post('/sync/google', practiceAuth, practiceContext, async (req, res) => {
  try {
    const userResults = await req.models.SecureDataAccess.query('users', { _id: req.user.id }, { limit: 1 }, context);

    const user = userResults[0];
    
    if (!user || !user.isProvider()) {
      return res.status(400).json({
        success: false,
        error: 'Google Calendar sync is only available for providers'
      });
    }
    
    // Check if Google tokens exist
    if (!user.providerInfo?.calendarSync?.googleRefreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Google Calendar not connected. Please authorize first.',
        authUrl: `/api/calendar/google/auth`
      });
    }
    
    // Get upcoming appointments
    const Appointment = require('../models/Appointment');
    const appointments = await SecureDataAccess.query('appointments', {
      providerId: user.getProviderId(),
      scheduledDate: { $gte: new Date() },
      status: { $nin: ['cancelled', 'completed'] }
    }, {}, context).limit(100);
    
    // Sync with Google Calendar
    const syncResults = await calendarSyncService.syncWithGoogleCalendar(user, appointments);
    
    // Update last sync time
    user.providerInfo.calendarSync.lastSync = new Date();
    user.providerInfo.calendarSync.lastSyncResults = syncResults;
    await SecureDataAccess.update('collection', { _id: user._id }, user, context);
    
    res.json({
      success: true,
      data: {
        synced: syncResults.filter(r => r.status !== 'error').length,
        errors: syncResults.filter(r => r.status === 'error').length,
        details: syncResults
      },
      message: 'Google Calendar sync completed'
    });
    
  } catch (error) {
    console.error('Error syncing with Google Calendar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync with Google Calendar',
      details: error.message
    });
  }
});

/**
 * @route   GET /calendar/google/auth
 * @desc    Start Google Calendar OAuth flow
 * @access  Private
 */
router.get('/google/auth', practiceAuth, practiceContext, async (req, res) => {
  try {
    const userResults = await req.models.SecureDataAccess.query('users', { _id: req.user.id }, { limit: 1 }, context);

    const user = userResults[0];
    
    if (!user || !user.isProvider()) {
      return res.status(400).json({
        success: false,
        error: 'Google Calendar is only available for providers'
      });
    }
    
    // Generate Google OAuth URL
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    const oauth2Client = new (require('googleapis').google.auth.OAuth2)(
      secureConfigService.get('GOOGLE_CALENDAR_CLIENT_ID'),
      secureConfigService.get('GOOGLE_CALENDAR_CLIENT_SECRET'),
      secureConfigService.get('GOOGLE_CALENDAR_REDIRECT_URI') || 'http://localhost:5000/api/calendar/google/callback'
    );
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: req.user.id // Pass user ID in state
    });
    
    res.redirect(authUrl);
    
  } catch (error) {
    console.error('Error starting Google auth:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start Google authorization',
      details: error.message
    });
  }
});

/**
 * @route   GET /calendar/google/callback
 * @desc    Handle Google Calendar OAuth callback
 * @access  Public (OAuth callback)
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'No authorization code received'
      });
    }
    
    // Exchange code for tokens
    const oauth2Client = new (require('googleapis').google.auth.OAuth2)(
      secureConfigService.get('GOOGLE_CALENDAR_CLIENT_ID'),
      secureConfigService.get('GOOGLE_CALENDAR_CLIENT_SECRET'),
      secureConfigService.get('GOOGLE_CALENDAR_REDIRECT_URI') || 'http://localhost:5000/api/calendar/google/callback'
    );
    
    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens to user
    const User = require('../models/User').model;
    const userResults = await SecureDataAccess.query('users', { _id: userObjectId }, { limit: 1 }, context);

    const user = userResults[0];
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Store Google tokens
    user.providerInfo = user.providerInfo || {};
    user.providerInfo.calendarSync = user.providerInfo.calendarSync || {};
    user.providerInfo.calendarSync.googleRefreshToken = tokens.refresh_token;
    user.providerInfo.calendarSync.googleAccessToken = tokens.access_token;
    user.providerInfo.calendarSync.googleTokenExpiry = new Date(tokens.expiry_date);
    user.providerInfo.calendarSync.googleConnectedAt = new Date();
    await SecureDataAccess.update('collection', { _id: user._id }, user, context);
    
    // Redirect to success page
    res.redirect('/calendar-sync-success');
    
  } catch (error) {
    console.error('Error handling Google callback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete Google authorization',
      details: error.message
    });
  }
});

/**
 * @route   POST /calendar/sync/send-email
 * @desc    Send calendar sync URL via email to provider
 * @access  Private (Admin or Provider)
 */
router.post('/sync/send-email', practiceAuth, practiceContext, async (req, res) => {
  try {
    const { providerId, email, format = 'ics' } = req.body;
    
    // Get the provider user
    const User = req.models.User;
    const providerResults = await SecureDataAccess.query('users', {
      $or: [
        { 'providerInfo.providerId': providerId }, 
        { _id: providerObjectId }
      ]
    , limit: 1 }, {}, context);

    const provider = providerResults[0];
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }
    
    // Check permissions (admin or own account)
    const isOwnAccount = provider._id.toString() === req.user.id;
    const isAdmin = roleModel.rolesAreAdmin(req.user.roles);
    
    if (!isOwnAccount && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to send calendar sync for this provider'
      });
    }
    
    // Generate sync URL
    const syncUrl = await calendarSyncService.generateSyncUrl(provider, format);
    
    // Get recipient email (use provided email or provider's email)
    const recipientEmail = email || provider.email;
    
    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        error: 'No email address available for this provider'
      });
    }
    
    // Generate instructions based on format
    let instructions = '';
    let subject = `${provider.getProviderName()} - IntelliCare Calendar Sync`;
    
    switch(format) {
      case 'google':
        instructions = `
          <h3>To add to Google Calendar:</h3>
          <ol>
            <li>Open Google Calendar on your computer</li>
            <li>Click the + next to "Other calendars"</li>
            <li>Select "From URL"</li>
            <li>Copy and paste the URL below</li>
            <li>Click "Add calendar"</li>
          </ol>
        `;
        subject += ' - Google Calendar';
        break;
      case 'apple':
        instructions = `
          <h3>To add to iPhone/iPad Calendar:</h3>
          <ol>
            <li>Copy the URL below</li>
            <li>Open Settings → Calendar → Accounts</li>
            <li>Tap "Add Account" → "Other"</li>
            <li>Tap "Add Subscribed Calendar"</li>
            <li>Paste the URL and tap "Next"</li>
            <li>Configure options and tap "Save"</li>
          </ol>
        `;
        subject += ' - iPhone/iPad';
        break;
      case 'outlook':
        instructions = `
          <h3>To add to Outlook:</h3>
          <ol>
            <li>Open Outlook Calendar</li>
            <li>Right-click "My Calendars"</li>
            <li>Select "Add Calendar" → "From Internet"</li>
            <li>Copy and paste the URL below</li>
            <li>Click "OK"</li>
          </ol>
        `;
        subject += ' - Outlook';
        break;
      default:
        instructions = `
          <h3>To add to your calendar app:</h3>
          <ol>
            <li>Open your calendar application</li>
            <li>Look for "Subscribe to calendar" or "Add calendar from URL"</li>
            <li>Copy and paste the URL below</li>
            <li>Follow your app's instructions</li>
          </ol>
        `;
    }
    
    // Send email using emailService
    const emailService = require('../services/emailService');
    await emailService.sendCalendarSyncUrl(
      recipientEmail,
      provider.getProviderName(),
      syncUrl,
      instructions,
      subject,
      req.practiceContext.practiceName
    );
    
    res.json({
      success: true,
      message: `Calendar sync instructions sent to ${recipientEmail}`,
      data: {
        email: recipientEmail,
        format: format,
        providerId: provider.getProviderId(),
        providerName: provider.getProviderName()
      }
    });
    
  } catch (error) {
    console.error('Error sending calendar sync email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send calendar sync email',
      details: error.message
    });
  }
});

/**
 * @route   POST /calendar/check-conflicts
 * @desc    Check for calendar conflicts
 * @access  Private
 */
router.post('/check-conflicts', practiceAuth, practiceContext, async (req, res) => {
  try {
    const { providerId, date, time, duration = 30 } = req.body;
    
    if (!providerId || !date || !time) {
      return res.status(400).json({
        success: false,
        error: 'Provider ID, date, and time are required'
      });
    }
    
    // Parse date and time
    const appointmentDateTime = new Date(`${date}T${time}:00`);
    
    // Check for conflicts
    const conflicts = await calendarSyncService.checkForConflicts(
      providerId,
      appointmentDateTime,
      duration
    );
    
    res.json({
      success: true,
      data: conflicts
    });
    
  } catch (error) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check calendar conflicts',
      details: error.message
    });
  }
});

module.exports = router;