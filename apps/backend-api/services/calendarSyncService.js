const { ObjectId } = require('mongodb');
const { google } = require('googleapis');
const ical = require('ical-generator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');

class CalendarSyncService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.providers = {
      google: null,
      outlook: null,
      apple: null
    };
    
    // Initialize Google Calendar if credentials exist
    if (secureConfigService.get('GOOGLE_CALENDAR_CLIENT_ID')) {
      this.initializeGoogleCalendar();
    }
  }

  async initialize() {
    if (this.initialized) return;
    this.serviceToken = await serviceAccountManager.authenticate('calendar-sync-service');
    this.initialized = true;
  }
  
  // Initialize Google Calendar API
  initializeGoogleCalendar() {
    const oauth2Client = new google.auth.OAuth2(
      secureConfigService.get('GOOGLE_CALENDAR_CLIENT_ID'),
      secureConfigService.get('GOOGLE_CALENDAR_CLIENT_SECRET'),
      secureConfigService.get('GOOGLE_CALENDAR_REDIRECT_URI') || 'http://localhost:5000/api/calendar/google/callback'
    );
    
    this.providers.google = {
      client: oauth2Client,
      calendar: google.calendar({ version: 'v3', auth: oauth2Client })
    };
  }
  
  /**
   * Generate calendar sync URL for provider
   * @param {Object} user - User object with provider info
   * @param {String} format - Calendar format (ics, google, outlook, apple)
   */
  async generateSyncUrl(user, format = 'ics') {
    try {
      const context = {
        serviceId: 'calendar-sync-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: user.practiceId || 'global'
      };
      // Generate unique sync token for this provider
      const syncToken = crypto.randomBytes(32).toString('hex');
      
      // Store sync token in user's provider info
      user.providerInfo = user.providerInfo || {};
      user.providerInfo.calendarSync = user.providerInfo.calendarSync || {};
      user.providerInfo.calendarSync.token = syncToken;
      user.providerInfo.calendarSync.createdAt = new Date();
      user.providerInfo.calendarSync.format = format;
      await SecureDataAccess.update('collection', { _id: user._id }, user, context);
      
      // Generate URL based on format
      const baseUrl = secureConfigService.get('BASE_URL') || 'http://localhost:5000';
      
      switch(format) {
        case 'ics':
          // Standard ICS feed URL
          return `${baseUrl}/api/calendar/feed/${user.getProviderId()}/${syncToken}.ics`;
          
        case 'google':
          // Google Calendar subscription URL
          return `${baseUrl}/api/calendar/google/subscribe/${user.getProviderId()}/${syncToken}`;
          
        case 'outlook':
          // Outlook/Office 365 subscription URL
          return `webcal://${baseUrl.replace('http://', '').replace('https://', '')}/api/calendar/feed/${user.getProviderId()}/${syncToken}.ics`;
          
        case 'apple':
          // Apple Calendar subscription URL
          return `webcal://${baseUrl.replace('http://', '').replace('https://', '')}/api/calendar/feed/${user.getProviderId()}/${syncToken}.ics`;
          
        default:
          return `${baseUrl}/api/calendar/feed/${user.getProviderId()}/${syncToken}.ics`;
      }
    } catch (error) {
      console.error('Error generating sync URL:', error);
      throw error;
    }
  }
  
  /**
   * Generate ICS feed for provider's appointments
   * @param {String} providerId - Provider ID
   * @param {Array} appointments - Array of appointments
   * @param {Object} providerInfo - Provider information
   */
  async generateICSFeed(providerId, appointments, providerInfo) {
    try {
      const cal = ical({
        domain: secureConfigService.get('DOMAIN') || 'intellicare.health',
        name: `${providerInfo.name} - IntelliCare Schedule`,
        prodId: '//IntelliCare//Medical Appointments//EN',
        timezone: providerInfo.timezone || 'Asia/Jerusalem',
        ttl: 60 * 60 // 1 hour cache
      });
      
      // Add each appointment as calendar event
      for (const appointment of appointments) {
        // Decrypt sensitive data if needed
        const patientName = appointment.patientName || 'Patient';
        const reason = appointment.appointmentReason || 'Medical Appointment';
        
        // Create calendar event
        const event = cal.createEvent({
          id: appointment._id.toString(),
          start: appointment.appointmentDateTime,
          end: new Date(appointment.appointmentDateTime.getTime() + (appointment.duration || 30) * 60000),
          summary: `${appointment.appointmentType}: ${patientName}`,
          description: `
            Patient: ${patientName}
            Type: ${appointment.appointmentType}
            Reason: ${reason}
            Status: ${appointment.status}
            ${appointment.notes ? `Notes: ${appointment.notes}` : ''}
          `.trim(),
          location: `${appointment.room || 'TBD'} - ${appointment.practiceName || 'IntelliCare Practice'}`,
          categories: [appointment.appointmentType, appointment.priority],
          status: this.mapAppointmentStatus(appointment.status),
          busystatus: appointment.status === 'cancelled' ? 'FREE' : 'BUSY',
          class: 'PRIVATE', // Keep patient info private
          alarms: [
            {
              type: 'display',
              trigger: 900 // 15 minutes before
            },
            {
              type: 'display',
              trigger: 86400 // 1 day before
            }
          ]
        });
        
        // Add custom properties
        event.createProperty('X-INTELLICARE-ID', appointment.appointmentNumber);
        event.createProperty('X-PATIENT-ID', appointment.patientId);
        event.createProperty('X-PRACTICE-ID', appointment.practiceId);
      }
      
      return cal.toString();
    } catch (error) {
      console.error('Error generating ICS feed:', error);
      throw error;
    }
  }
  
  /**
   * Sync appointments with Google Calendar
   * @param {Object} user - User with Google auth tokens
   * @param {Array} appointments - Appointments to sync
   */
  async syncWithGoogleCalendar(user, appointments) {
    try {
      const context = {
        serviceId: 'calendar-sync-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: user.practiceId || 'global'
      };
      if (!this.providers.google) {
        throw new Error('Google Calendar not configured');
      }
      
      // Set user's refresh token
      this.providers.google.client.setCredentials({
        refresh_token: user.providerInfo.calendarSync.googleRefreshToken
      });
      
      const calendar = this.providers.google.calendar;
      
      // Get or create IntelliCare calendar
      let calendarId = user.providerInfo.calendarSync.googleCalendarId;
      
      if (!calendarId) {
        // Create new calendar for IntelliCare appointments
        const newCalendar = await calendar.calendars.insert({
          requestBody: {
            summary: 'IntelliCare Appointments',
            description: 'Medical appointments from IntelliCare',
            timeZone: user.providerInfo.timezone || 'Asia/Jerusalem'
          }
        });
        
        calendarId = newCalendar.data.id;
        user.providerInfo.calendarSync.googleCalendarId = calendarId;
        await SecureDataAccess.update('collection', { _id: user._id }, user, context);
      }
      
      // Sync each appointment
      const syncResults = [];
      
      for (const appointment of appointments) {
        try {
          // Check if event already exists
          const eventId = appointment.googleEventId || `intellicare-${appointment._id}`;
          
          let event;
          try {
            // Try to get existing event
            event = await calendar.events.get({
              calendarId: calendarId,
              eventId: eventId
            });
          } catch (err) {
            // Event doesn't exist, will create new one
          }
          
          const eventData = {
            id: eventId,
            summary: `${appointment.appointmentType}: ${appointment.patientName}`,
            description: `
              Type: ${appointment.appointmentType}
              Status: ${appointment.status}
              Patient: ${appointment.patientName}
              ${appointment.notes || ''}
            `.trim(),
            location: `${appointment.room || 'TBD'} - ${appointment.practiceName}`,
            start: {
              dateTime: appointment.appointmentDateTime.toISOString(),
              timeZone: user.providerInfo.timezone || 'Asia/Jerusalem'
            },
            end: {
              dateTime: new Date(appointment.appointmentDateTime.getTime() + (appointment.duration || 30) * 60000).toISOString(),
              timeZone: user.providerInfo.timezone || 'Asia/Jerusalem'
            },
            colorId: this.getGoogleColorId(appointment.status, appointment.priority),
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'popup', minutes: 15 },
                { method: 'email', minutes: 1440 } // 24 hours
              ]
            },
            extendedProperties: {
              private: {
                intellicareId: appointment._id.toString(),
                appointmentNumber: appointment.appointmentNumber,
                patientId: appointment.patientId.toString()
              }
            }
          };
          
          if (event) {
            // Update existing event
            const updatedEvent = await calendar.events.update({
              calendarId: calendarId,
              eventId: eventId,
              requestBody: eventData
            });
            syncResults.push({ appointmentId: appointment._id, status: 'updated', googleEventId: updatedEvent.data.id });
          } else {
            // Create new event
            const newEvent = await calendar.events.insert({
              calendarId: calendarId,
              requestBody: eventData
            });
            
            // Store Google event ID in appointment
            appointment.googleEventId = newEvent.data.id;
            await SecureDataAccess.update('collection', { _id: appointment._id }, appointment, context);
            
            syncResults.push({ appointmentId: appointment._id, status: 'created', googleEventId: newEvent.data.id });
          }
        } catch (error) {
          console.error(`Error syncing appointment ${appointment._id}:`, error);
          syncResults.push({ appointmentId: appointment._id, status: 'error', error: error.message });
        }
      }
      
      return syncResults;
    } catch (error) {
      console.error('Error syncing with Google Calendar:', error);
      throw error;
    }
  }
  
  /**
   * Handle incoming calendar webhook (for real-time sync)
   * @param {String} provider - Calendar provider (google, outlook, apple)
   * @param {Object} data - Webhook data
   */
  async handleWebhook(provider, data) {
    try {
      switch(provider) {
        case 'google':
          return await this.handleGoogleWebhook(data);
        case 'outlook':
          return await this.handleOutlookWebhook(data);
        case 'apple':
          return await this.handleAppleWebhook(data);
        default:
          throw new Error(`Unknown calendar provider: ${provider}`);
      }
    } catch (error) {
      console.error('Error handling calendar webhook:', error);
      throw error;
    }
  }
  
  /**
   * Handle Google Calendar webhook
   */
  async handleGoogleWebhook(data) {
    // Handle Google Calendar push notifications
    // This would sync changes from Google Calendar back to IntelliCare
    console.log('Google Calendar webhook received:', data);
    
    // TODO: Implement reverse sync
    // 1. Parse changed event
    // 2. Find corresponding appointment
    // 3. Update appointment status/time if changed in Google Calendar
    
    return { processed: true };
  }
  
  /**
   * Check for calendar conflicts
   * @param {String} providerId - Provider ID
   * @param {Date} startTime - Proposed appointment start
   * @param {Number} duration - Duration in minutes
   */
  async checkForConflicts(providerId, startTime, duration) {
    try {
      const context = {
        serviceId: 'calendar-sync-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global'
      };
      const endTime = new Date(startTime.getTime() + duration * 60000);
      
      // Check internal appointments
      const Appointment = require('../models/Appointment');
      const conflicts = await SecureDataAccess.query('appointments', {
        providerId: providerId,
        status: { $nin: ['cancelled', 'no-show'] },
        appointmentDateTime: {
          $lt: endTime,
          $gte: startTime
        }
      }, {}, context);
      
      // TODO: Also check external calendar if connected
      // This would query Google/Outlook/Apple calendars for conflicts
      
      return {
        hasConflicts: conflicts.length > 0,
        conflicts: conflicts,
        suggestion: conflicts.length > 0 ? this.suggestAlternativeTime(providerId, startTime, duration) : null
      };
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      throw error;
    }
  }
  
  /**
   * Suggest alternative appointment time
   */
  async suggestAlternativeTime(providerId, preferredTime, duration) {
    // Find next available slot after preferred time
    // This would check both internal appointments and external calendars
    
    // Simplified version - just suggest 30 minutes later
    return new Date(preferredTime.getTime() + 30 * 60000);
  }
  
  // Utility functions
  mapAppointmentStatus(status) {
    const statusMap = {
      'scheduled': 'CONFIRMED',
      'confirmed': 'CONFIRMED',
      'cancelled': 'CANCELLED',
      'completed': 'CONFIRMED',
      'no-show': 'CANCELLED',
      'rescheduled': 'TENTATIVE'
    };
    return statusMap[status] || 'TENTATIVE';
  }
  
  getGoogleColorId(status, priority) {
    // Google Calendar color IDs (1-11)
    if (status === 'cancelled') return '8'; // Gray
    if (priority === 'urgent' || priority === 'stat') return '11'; // Red
    if (status === 'completed') return '10'; // Green
    if (status === 'confirmed') return '5'; // Yellow
    return '7'; // Blue (default)
  }
}

module.exports = new CalendarSyncService();