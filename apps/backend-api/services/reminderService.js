const { ObjectId } = require('mongodb');
const cron = require('node-cron');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const emailService = require('./emailService');
const communicationAuditService = require('./communicationAuditService');
const immutableAuditService = require('./immutableAuditService');

class ReminderService {
  constructor() {
    this.scheduledTasks = new Map();
    this.isRunning = false;
    this.serviceToken = null;
    this.serviceContext = {
      serviceId: 'reminder-service',
      apiKey: 'system',
      practiceId: 'global'
    };
    this.clinicDatabases = new Map();
  }

  /**
   * Initialize the reminder service with automatic processing
   * SECURITY: Service must authenticate before accessing any data
   */
  async initialize() {
    if (this.isRunning) {
      console.log('⚠️ Reminder service is already running');
      return;
    }

    // Initializing Reminder Service
    
    // SECURITY: Authenticate service account
    try {
      const auth = await serviceAccountManager.authenticate('reminder-service');
      if (!auth) {
        throw new Error('Service authentication failed - cannot access data');
      }
      
      this.serviceToken = auth.sessionToken;
      this.serviceContext = {
        serviceId: auth.serviceId,
        apiKey: auth.apiKey,
        permissions: auth.permissions,
        practiceId: auth.practiceId || 'global',
        sessionToken: auth.sessionToken
      };
      
      // Service authenticated
      
      // Log service startup
      await immutableAuditService.logSecurityEvent({
        type: 'SERVICE_STARTED',
        service: 'reminder-service',
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Service authentication failed:', error.message);
      throw new Error('Cannot start service without authentication');
    }
    
    // Schedule check every 15 minutes for appointment reminders
    this.appointmentReminderTask = cron.schedule('*/15 * * * *', async () => {
      await this.processAppointmentReminders();
    });

    // Schedule check every hour for scheduled reminders
    this.scheduledReminderTask = cron.schedule('0 * * * *', async () => {
      await this.processScheduledReminders();
    });

    this.isRunning = true;
    // Reminder Service initialized
    
    // Check if we should delay startup processing  
    const delayMinutes = 5; // Default 5 minute startup delay to prevent SMS spam on restart
    
    console.log(`⏱️ Reminder service will start processing in ${delayMinutes} minutes`);
    console.log('   (This prevents SMS from being sent immediately on server restart)');
    
    // Schedule first check after delay instead of running immediately
    setTimeout(async () => {
      console.log('🔄 Reminder service starting first check...');
      await this.processAppointmentReminders();
      await this.processScheduledReminders();
    }, delayMinutes * 60 * 1000);
  }

  /**
   * Retry logic helper function with exponential backoff
   */
  async retryQuery(operation, maxRetries = 3, operationName = 'database operation') {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`❌ Failed ${operationName} after ${maxRetries} attempts:`, error.message);
          throw error;
        }
        const delay = 1000 * attempt; // Exponential backoff: 1s, 2s, 3s
        console.log(`⏳ Retry ${attempt}/${maxRetries} for ${operationName} after error: ${error.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Process appointment reminders for all practices
   */
  async processAppointmentReminders() {
    // Processing appointment reminders
    
    try {
      // Get all practice databases
      const practices = await this.getAllClinics();
      
      if (practices.length === 0) {
        // No practices found to process
        return;
      }
      
      console.log(`📊 Processing reminders for ${practices.length} practices`);
      
      for (const practiceId of practices) {
        try {
          await this.processClinicAppointments(practiceId);
          console.log(`✅ Completed appointment processing for practice ${practiceId}`);
        } catch (practiceError) {
          console.error(`❌ Error processing appointment reminders for practice ${practiceId}:`, practiceError.message);
          
          // Log the error to audit service for monitoring
          try {
            await immutableAuditService.logSecurityEvent({
              type: 'CLINIC_PROCESSING_ERROR',
              service: 'reminder-service',
              practiceId: practiceId,
              operation: 'appointment_reminders',
              error: practiceError.message,
              timestamp: new Date()
            });
          } catch (auditError) {
            console.error('Failed to log practice processing error:', auditError.message);
          }
          
          // Continue with other practices even if one fails
        }
      }
    } catch (error) {
      console.error('❌ Error processing appointment reminders:', error.message);
    }
  }

  /**
   * Process appointments for a specific practice
   */
  async processClinicAppointments(practiceId) {
    try {
      const db = await this.getClinicDatabase(practiceId);
      if (!db) return;

      // Find appointments in the next 48 hours that haven't sent reminders
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + (48 * 60 * 60 * 1000));
      const oneDayFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

      // Build query without operators - use simple equality and handle logic in code
      // SECURITY: Remove populate - SecureDataAccess doesn't support Mongoose features
      const allAppointments = await this.retryQuery(
        () => SecureDataAccess.internalQuery(
          'appointments',
          {
            practiceId: practiceId,
            status: 'scheduled' // Single status, no $in operator
          },
          {}, // No options - removed populate
          {
            serviceId: this.serviceContext?.serviceId || 'reminder-service',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: practiceId
          }
        ),
        3,
        `appointments query for practice ${practiceId}`
      );
      
      // Get confirmed appointments separately
      const confirmedAppointments = await this.retryQuery(
        () => SecureDataAccess.internalQuery(
          'appointments',
          {
            practiceId: practiceId,
            status: 'confirmed' // Single status, no $in operator
          },
          {}, // No options - removed populate
          {
            serviceId: this.serviceContext?.serviceId || 'reminder-service',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: practiceId
          }
        ),
        3,
        `confirmed appointments query for practice ${practiceId}`
      );
      
      // Combine both arrays
      const combinedAppointments = [...allAppointments, ...confirmedAppointments];
      
      // Filter in JavaScript instead of MongoDB
      const filteredAppointments = combinedAppointments.filter(apt => {
        const aptDate = new Date(apt.scheduledDate);
        return aptDate >= now &&
               aptDate <= twoDaysFromNow &&
               (!apt.remindersSent || apt.remindersSent.length === 0 ||
                !apt.remindersSent.some(r => r.type === 'email'));
      });

      // SECURITY FIX: Manual patient lookup to replace populate functionality
      // Get unique patient IDs from appointments
      const patientIds = [...new Set(filteredAppointments
        .map(apt => apt.patientId)
        .filter(id => id)
      )];

      // Fetch patient data separately using SecureDataAccess
      let patients = [];
      if (patientIds.length > 0) {
        patients = await this.retryQuery(
          () => SecureDataAccess.internalQuery(
            'patients',
            {
              _id: { $in: patientIds }
            },
            {}, // Plain object options
            {
              serviceId: this.serviceContext?.serviceId || 'reminder-service',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              practiceId: practiceId
            }
          ),
          3,
          `patients query for practice ${practiceId}`
        );
      }

      // Create patient lookup map for efficiency
      const patientMap = new Map(patients.map(patient => [patient._id.toString(), patient]));

      // Attach patient data to appointments (replaces populate functionality)
      const appointments = filteredAppointments.map(apt => ({
        ...apt,
        patientId: patientMap.get(apt.patientId?.toString()) || null
      }));

      for (const appointment of appointments) {
        const appointmentDateTime = new Date(appointment.scheduledDate);
        const timeDiff = appointmentDateTime - now;
        const hoursUntilAppointment = Math.floor(timeDiff / (1000 * 60 * 60));

        // Send 24-hour reminder
        if (hoursUntilAppointment <= 24 && hoursUntilAppointment > 20) {
          await this.sendAppointmentReminder(appointment, 24);
        }
        // Send 2-hour reminder
        else if (hoursUntilAppointment <= 2 && hoursUntilAppointment > 0) {
          // Check if 24-hour reminder was already sent
          const has24HourReminder = appointment.remindersSent?.some(r => 
            r.type === 'email' && r.sentDate && 
            (now - new Date(r.sentDate)) > (20 * 60 * 60 * 1000)
          );
          
          if (has24HourReminder) {
            await this.sendAppointmentReminder(appointment, 2);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error processing practice ${practiceId} appointments:`, error);
    }
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(appointment, hoursBeforeAppointment) {
    try {
      const patient = appointment.patientId;
      
      // Check patient communication preferences
      const preferences = patient.communicationPreferences || {};
      const sendEmail = patient.email && preferences.emailReminders !== false;
      const sendSMS = patient.phone && preferences.smsReminders === true;
      
      if (!sendEmail && !sendSMS) {
        console.log(`⚠️ No communication channels enabled for patient ${appointment.patientName}`);
        return;
      }

      const appointmentDate = new Date(appointment.scheduledDate);
      const appointmentTime = appointment.scheduledTime;
      const practiceName = appointment.practiceName || 'IntelliCare';
      
      // Format date based on country
      const country = appointment.timezone === 'America/New_York' ? 'US' : 'Israel';
      const dateOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      const locale = country === 'US' ? 'en-US' : 'he-IL';
      const formattedDate = appointmentDate.toLocaleDateString(locale, dateOptions);

      // Create email content based on language
      const isHebrew = country === 'Israel';
      const subject = isHebrew 
        ? `תזכורת לתור - ${appointment.providerName}`
        : `Appointment Reminder - ${appointment.providerName}`;

      const message = isHebrew ? `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 20px;">
          <h2 style="color: #2c5aa0;">תזכורת לתור רפואי</h2>
          
          <p>שלום ${patient.name},</p>
          
          <p>זוהי תזכורת שיש לך תור מתוכנן:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>רופא/ה:</strong> ${appointment.providerName}</p>
            <p style="margin: 5px 0;"><strong>תאריך:</strong> ${formattedDate}</p>
            <p style="margin: 5px 0;"><strong>שעה:</strong> ${appointmentTime}</p>
            ${appointment.department ? `<p style="margin: 5px 0;"><strong>מחלקה:</strong> ${appointment.department}</p>` : ''}
            ${appointment.room ? `<p style="margin: 5px 0;"><strong>חדר:</strong> ${appointment.room}</p>` : ''}
            <p style="margin: 5px 0;"><strong>סוג תור:</strong> ${this.translateAppointmentType(appointment.appointmentType, true)}</p>
          </div>
          
          <p style="color: #666;">
            <span style="color: #28a745;">✓</span> אנא הגיעו 10 דקות לפני הזמן המתוכנן
          </p>
          
          ${appointment.specialInstructions ? `
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>הוראות מיוחדות:</strong><br>
            ${appointment.specialInstructions}
          </div>
          ` : ''}
          
          <p>אם אתם צריכים לבטל או לשנות את התור, אנא צרו קשר בהקדם האפשרי.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="font-size: 12px; color: #666;">
            תודה,<br>
            צוות ${practiceName}
          </p>
        </div>
      ` : `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #2c5aa0;">Medical Appointment Reminder</h2>
          
          <p>Dear ${patient.name},</p>
          
          <p>This is a reminder that you have an appointment scheduled:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Provider:</strong> ${appointment.providerName}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${appointmentTime}</p>
            ${appointment.department ? `<p style="margin: 5px 0;"><strong>Department:</strong> ${appointment.department}</p>` : ''}
            ${appointment.room ? `<p style="margin: 5px 0;"><strong>Room:</strong> ${appointment.room}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Appointment Type:</strong> ${this.translateAppointmentType(appointment.appointmentType, false)}</p>
          </div>
          
          <p style="color: #666;">
            <span style="color: #28a745;">✓</span> Please arrive 10 minutes early to complete any necessary paperwork
          </p>
          
          ${appointment.specialInstructions ? `
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Special Instructions:</strong><br>
            ${appointment.specialInstructions}
          </div>
          ` : ''}
          
          <p>If you need to cancel or reschedule, please contact us as soon as possible.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="font-size: 12px; color: #666;">
            Thank you,<br>
            ${practiceName} Team
          </p>
        </div>
      `;

      // Send email if enabled
      if (sendEmail) {
        await emailService.sendCustomEmail({
          to: patient.email,
          subject: subject,
          html: message
        });
      }

      // Send SMS if enabled and service is configured
      let smsResult = null;
      if (sendSMS) {
        try {
          const smsService = require('./smsService');
          await smsService.initialize();
          
          // Check if SMS service is actually available (not disabled)
          if (smsService.disabled) {
            console.log('⏭️ Skipping SMS reminder - service is disabled');
            sendSMS = false;
          } else if (smsService.initialized) {
            const context = {
              practiceId: appointment.practiceId,
              country: country === 'US' ? 'US' : 'IL'
            };
            
            smsResult = await smsService.sendAppointmentReminder(
              appointment, 
              hoursBeforeAppointment, 
                );
            
            if (process.env.QUIET_LOGS !== 'true') console.log(`📱 SMS reminder sent for appointment ${appointment.appointmentNumber}`);
          }
        } catch (smsError) {
          console.log(`⚠️ SMS reminder failed: ${smsError.message}`);
          // Don't fail the whole reminder if SMS fails
        }
      }

      // Update appointment with reminder sent using SecureDataAccess
      const remindersSent = appointment.remindersSent || [];
      
      if (sendEmail) {
        remindersSent.push({
          type: 'email',
          sentDate: new Date(),
          sentBy: 'system',
          delivered: true
        });
      }
      
      if (smsResult && smsResult.success) {
        remindersSent.push({
          type: 'sms',
          sentDate: new Date(),
          sentBy: 'system',
          delivered: false,
          messageId: smsResult.messageId
        });
      }
      
      await this.retryQuery(
        () => SecureDataAccess.update(
          'appointments',
          { _id: appointment._id },
          { remindersSent: remindersSent },
          {
            serviceId: this.serviceContext?.serviceId || 'reminder-service',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: appointment.practiceId
          }
        ),
        3,
        `appointment update for ${appointment.appointmentNumber}`
      );

      // Record in audit trail for HIPAA compliance
      await communicationAuditService.recordCommunication(appointment.practiceId, {
        type: 'appointment_reminder',
        category: 'patient_communication',
        patientId: patient._id.toString(),
        patientName: patient.name,
        patientEmail: patient.email,
        patientPhone: patient.phone,
        method: 'email',
        subject: subject,
        message: message,
        deliveryStatus: 'delivered',
        sentAt: new Date(),
        deliveredAt: new Date(),
        reminderType: 'appointment',
        appointmentId: appointment._id.toString(),
        scheduledFor: appointment.scheduledDate,
        hoursBeforeAppointment: hoursBeforeAppointment,
        consentVerified: true,
        optOutChecked: true,
        initiatedBy: 'system',
        automated: true,
        apiVersion: 'v2'
      });

      console.log(`✅ Sent ${hoursBeforeAppointment}h reminder to ${patient.email} for appointment ${appointment.appointmentNumber}`);
    } catch (error) {
      console.error(`❌ Failed to send appointment reminder:`, error);
    }
  }

  /**
   * Process scheduled reminders from ReminderLog
   */
  async processScheduledReminders() {
    // Processing scheduled reminders
    
    try {
      const practices = await this.getAllClinics();
      
      if (practices.length === 0) {
        // No practices to process
        return;
      }
      
      for (const practiceId of practices) {
        try {
          await this.processClinicScheduledReminders(practiceId);
          console.log(`✅ Completed scheduled reminders processing for practice ${practiceId}`);
        } catch (practiceError) {
          console.error(`❌ Error processing scheduled reminders for practice ${practiceId}:`, practiceError.message);
          
          // Log the error to audit service for monitoring
          try {
            await immutableAuditService.logSecurityEvent({
              type: 'CLINIC_PROCESSING_ERROR',
              service: 'reminder-service',
              practiceId: practiceId,
              operation: 'scheduled_reminders',
              error: practiceError.message,
              timestamp: new Date()
            });
          } catch (auditError) {
            console.error('Failed to log practice processing error:', auditError.message);
          }
          
          // Continue with other practices even if one fails
        }
      }
    } catch (error) {
      console.error('❌ Error processing scheduled reminders:', error.message);
    }
  }

  /**
   * Process scheduled reminders for a specific practice
   */
  async processClinicScheduledReminders(practiceId) {
    try {
      const db = await this.getClinicDatabase(practiceId);
      if (!db) return;

      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000));

      // Build query without operators - use simple equality and handle logic in code
      const allReminders = await this.retryQuery(
        () => SecureDataAccess.query(
          'reminderlogs',
          {
            status: 'scheduled',
            practiceId: practiceId
          },
          {},
          {
            serviceId: this.serviceContext?.serviceId || 'reminder-service',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: practiceId
          }
        ),
        3,
        `scheduled reminders query for practice ${practiceId}`
      );
      
      // Filter in JavaScript instead of MongoDB
      const reminders = allReminders.filter(reminder => {
        const scheduledDate = new Date(reminder.scheduledFor);
        return scheduledDate >= now && scheduledDate <= oneHourFromNow;
      });

      for (const reminder of reminders) {
        await this.sendScheduledReminder(reminder);
      }
    } catch (error) {
      console.error(`❌ Error processing practice ${practiceId} scheduled reminders:`, error);
    }
  }

  /**
   * Send a scheduled reminder
   */
  async sendScheduledReminder(reminder) {
    try {
      if (!reminder.patientEmail) {
        console.log(`⚠️ No email for reminder ${reminder.id}`);
        await this.retryQuery(
          () => SecureDataAccess.update(
            'reminderlogs',
            { _id: reminder._id },
            { status: 'failed' },
            {
              serviceId: this.serviceContext?.serviceId || 'reminder-service',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              practiceId: reminder.practiceId
            }
          ),
          3,
          `reminder status update (failed) for ${reminder.id}`
        );
        return;
      }

      const emailContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #2c5aa0;">IntelliCare Reminder</h2>
          <p>${reminder.message}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated reminder from IntelliCare.
          </p>
        </div>
      `;

      // Send email
      await emailService.sendCustomEmail({
        to: reminder.patientEmail,
        subject: 'IntelliCare Reminder',
        html: emailContent
      });

      // Update reminder status using SecureDataAccess with retry logic
      await this.retryQuery(
        () => SecureDataAccess.update(
          'reminderlogs',
          { _id: reminder._id },
          { 
            status: 'sent',
            sentAt: new Date(),
            deliveryStatus: 'delivered'
          },
          {
            serviceId: this.serviceContext?.serviceId || 'reminder-service',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: reminder.practiceId
          }
        ),
        3,
        `reminder status update (sent) for ${reminder.id}`
      );

      // Record in audit trail for HIPAA compliance
      await communicationAuditService.recordCommunication(reminder.practiceId, {
        type: 'reminder',
        category: 'patient_communication',
        patientId: reminder.patientId?.toString(),
        patientName: reminder.patientName,
        patientEmail: reminder.patientEmail,
        patientPhone: reminder.patientPhone,
        method: 'email',
        subject: 'IntelliCare Reminder',
        message: emailContent,
        deliveryStatus: 'delivered',
        sentAt: new Date(),
        deliveredAt: new Date(),
        reminderType: reminder.reminderType,
        appointmentId: reminder.appointmentId?.toString(),
        scheduledFor: reminder.scheduledFor,
        consentVerified: true,
        optOutChecked: true,
        initiatedBy: reminder.createdBy || 'system',
        automated: true,
        apiVersion: 'v2'
      });

      console.log(`✅ Sent scheduled reminder ${reminder.id} to ${reminder.patientEmail}`);
    } catch (error) {
      console.error(`❌ Failed to send scheduled reminder ${reminder.id}:`, error);
      await this.retryQuery(
        () => SecureDataAccess.update(
          'reminderlogs',
          { _id: reminder._id },
          { status: 'failed' },
          {
            serviceId: this.serviceContext?.serviceId || 'reminder-service',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: reminder.practiceId
          }
        ),
        3,
        `reminder status update (failed in catch) for ${reminder.id}`
      );
    }
  }

  /**
   * Get all practice IDs - uses secure database access
   */
  async getAllClinics() {
    try {
      // SECURITY: Use SecureDataAccess to get practice list with retry logic
      const practices = await this.retryQuery(
        () => SecureDataAccess.query(
          'practices',
          { active: true },
          { fields: ['subdomain'] },
          {
            serviceId: this.serviceContext?.serviceId || 'reminder-service',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            practiceId: 'global'
          }
        ),
        3,
        'practices list query'
      );
      
      if (practices && practices.length > 0) {
        return practices.map(c => c.subdomain);
      }
      
      // No fallback - return empty if query fails
      // No practices in database
      return [];
    } catch (error) {
      console.error('❌ Error getting practice list:', error);
      // Return empty array - don't process non-existent practices
      return [];
    }
  }

  /**
   * Get or create connection to practice database - uses secure access
   */
  async getClinicDatabase(practiceId) {
    try {
      // For reminder service, we return a secure context object
      // that can be used with SecureDataAccess
      return {
        practiceId: practiceId,
        models: {
          Appointment: 'appointments',
          Patient: 'patients',
          ReminderLog: 'reminderlogs'
        }
      };
    } catch (error) {
      console.error(`❌ Error preparing practice ${practiceId} context:`, error);
      return null;
    }
  }

  /**
   * Note: ReminderLog schema is now defined in the database
   * We access it through SecureDataAccess, no model creation needed
   */

  /**
   * Translate appointment types
   */
  translateAppointmentType(type, toHebrew) {
    const translations = {
      'consultation': toHebrew ? 'ייעוץ' : 'Consultation',
      'follow-up': toHebrew ? 'ביקורת' : 'Follow-up',
      'routine-checkup': toHebrew ? 'בדיקה שגרתית' : 'Routine Checkup',
      'urgent-care': toHebrew ? 'טיפול דחוף' : 'Urgent Care',
      'procedure': toHebrew ? 'פרוצדורה' : 'Procedure',
      'lab-work': toHebrew ? 'בדיקות מעבדה' : 'Lab Work',
      'imaging': toHebrew ? 'הדמיה' : 'Imaging',
      'vaccination': toHebrew ? 'חיסון' : 'Vaccination',
      'physical-exam': toHebrew ? 'בדיקה גופנית' : 'Physical Exam',
      'telehealth': toHebrew ? 'רפואה מרחוק' : 'Telehealth',
      'surgery': toHebrew ? 'ניתוח' : 'Surgery',
      'therapy': toHebrew ? 'טיפול' : 'Therapy',
      'other': toHebrew ? 'אחר' : 'Other'
    };

    return translations[type] || type;
  }

  /**
   * Schedule a one-time reminder
   */
  scheduleReminder(reminderId, sendTime, callback) {
    const now = new Date();
    const delay = sendTime.getTime() - now.getTime();

    if (delay <= 0) {
      // Send immediately
      callback();
    } else if (delay < 24 * 60 * 60 * 1000) {
      // Use setTimeout for delays less than 24 hours
      const timeout = setTimeout(callback, delay);
      this.scheduledTasks.set(reminderId, { type: 'timeout', task: timeout });
    } else {
      // Use cron for longer delays
      const cronTime = `${sendTime.getMinutes()} ${sendTime.getHours()} ${sendTime.getDate()} ${sendTime.getMonth() + 1} *`;
      const task = cron.schedule(cronTime, () => {
        callback();
        task.stop();
        this.scheduledTasks.delete(reminderId);
      });
      this.scheduledTasks.set(reminderId, { type: 'cron', task });
    }
  }

  /**
   * Cancel a scheduled reminder
   */
  cancelReminder(reminderId) {
    const scheduled = this.scheduledTasks.get(reminderId);
    if (scheduled) {
      if (scheduled.type === 'timeout') {
        clearTimeout(scheduled.task);
      } else if (scheduled.type === 'cron') {
        scheduled.task.stop();
      }
      this.scheduledTasks.delete(reminderId);
      return true;
    }
    return false;
  }

  // ============================================================================
  // CRUD FUNCTIONS - For Claude/Agent Access to Patient Reminders
  // ============================================================================

  /**
   * Get Reminders - Query patient reminders
   * @param {Object} params - Query parameters
   * @param {string} params.patientId - Patient ID (required)
   * @param {string} params.dateFrom - Start date filter (optional)
   * @param {string} params.dateTo - End date filter (optional)
   * @param {string} params.reminderType - Filter by type (optional)
   * @param {string} params.status - Filter by status (optional)
   * @param {number} params.limit - Max results (default: 50)
   * @param {string} params.sortBy - Sort field (default: 'dateTime')
   * @param {string} params.sortOrder - Sort order asc/desc (default: 'desc')
   * @param {Object} context - Security context
   * @returns {Promise<Array>} Reminder records
   */
  async getReminders(params, context) {
    try {
      // Convert patientId to ObjectId if needed
      let patientId = params.patientId;
      if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
        patientId = new ObjectId(patientId);
      }

      // Build filter
      const filter = { patientId };

      // Add date filters
      if (params.dateFrom || params.dateTo) {
        filter.dateTime = {};
        if (params.dateFrom) filter.dateTime.$gte = new Date(params.dateFrom);
        if (params.dateTo) filter.dateTime.$lte = new Date(params.dateTo);
      }

      // Add type filter
      if (params.reminderType) {
        filter.reminderType = params.reminderType;
      }

      // Add status filter
      if (params.status) {
        filter.status = params.status;
      }

      // Query options - Sort by dateTime DESC (newest on top)
      const options = {
        limit: params.limit || 50,
        sort: params.sortBy ? { [params.sortBy]: params.sortOrder === 'asc' ? 1 : -1 } : { dateTime: -1 }
      };

      console.log(`🔎 [getReminders] Querying reminders with filter:`, JSON.stringify(filter));
      const result = await SecureDataAccess.query('reminders', filter, options, context);
      console.log(`📊 [getReminders] Query returned ${result?.length || 0} records`);

      // Fetch patient name to include in wrapped document
      let patientName = 'Unknown Patient';
      try {
        const patient = await SecureDataAccess.query('patients',
          { _id: patientId },
          { limit: 1, projection: { firstName: 1, lastName: 1 } },
          { serviceId: 'reminder-service', operation: 'get-patient-name', practiceId: context.practiceId }
        );
        if (patient && patient[0]) {
          patientName = `${patient[0].lastName}, ${patient[0].firstName}`;
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch patient name for ${patientId}:`, error.message);
      }

      // Wrap all reminders into single document for document view (all reminders in one view, newest on top)
      const wrappedDocument = {
        _id: `reminders_${patientId}_all`,
        reminders: result,  // All reminders in array (sorted newest first)
        patientId: patientId,
        patientName: patientName,  // Add patient name for artifact panel display
        category: 'reminders',
        title: 'Patient Reminders',
        date: new Date().toISOString(),
        preview: `${result.length} reminder${result.length === 1 ? '' : 's'}`
      };

      // Return with artifact panel metadata for frontend
      return {
        success: true,
        data: [wrappedDocument],
        count: result.length,
        displayType: 'openArtifactPanel',
        artifactPanel: {
          patientId: patientId,
          category: 'reminders',
          type: 'documents',
          data: [wrappedDocument]
        }
      };
    } catch (error) {
      console.error('❌ Error getting reminders:', error);
      throw error;
    }
  }

  /**
   * Create Reminder - Create new reminder record
   * @param {Object} params - Creation parameters
   * @param {string} params.patientId - Patient ID (required)
   * @param {Object} params.data - Reminder data (required)
   * @param {string} params.documentId - Associated document ID (optional)
   * @param {Object} context - Security context
   * @returns {Promise<Object>} Created reminder record
   */
  async createReminder(params, context) {
    try {
      // Convert patientId to ObjectId if needed
      let patientId = params.patientId;
      if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
        patientId = new ObjectId(patientId);
      }

      // Build record
      const record = {
        ...params.data,
        patientId,
        documentId: params.documentId,
        createdAt: new Date(),
        source: 'agent'
      };

      console.log(`✏️ [createReminder] Creating reminder for patient ${patientId}`);
      const result = await SecureDataAccess.insert('reminders', record, context);
      console.log(`✅ [createReminder] Created reminder with ID ${result._id || result.insertedId}`);

      return result;
    } catch (error) {
      console.error('❌ Error creating reminder:', error);
      throw error;
    }
  }

  /**
   * Update Reminder - Update existing reminder record
   * @param {Object} params - Update parameters
   * @param {string} params.recordId - Reminder ID to update (required)
   * @param {Object} params.updates - Fields to update (required)
   * @param {Object} context - Security context
   * @returns {Promise<Object>} Update result
   */
  async updateReminder(params, context) {
    try {
      // Convert recordId to ObjectId if needed
      let recordId = params.recordId;
      if (typeof recordId === 'string' && recordId.match(/^[0-9a-fA-F]{24}$/)) {
        recordId = new ObjectId(recordId);
      }

      const filter = { _id: recordId };
      const updates = {
        ...params.updates,
        updatedAt: new Date()
      };

      console.log(`🔄 [updateReminder] Updating reminder ${recordId}`);
      const result = await SecureDataAccess.update('reminders', filter, updates, context);
      console.log(`✅ [updateReminder] Updated reminder`);

      return result;
    } catch (error) {
      console.error('❌ Error updating reminder:', error);
      throw error;
    }
  }

  /**
   * Delete Reminder - Delete reminder record
   * @param {Object} params - Delete parameters
   * @param {string} params.recordId - Reminder ID to delete (required)
   * @param {Object} context - Security context
   * @returns {Promise<Object>} Delete result
   */
  async deleteReminder(params, context) {
    try {
      // Convert recordId to ObjectId if needed
      let recordId = params.recordId;
      if (typeof recordId === 'string' && recordId.match(/^[0-9a-fA-F]{24}$/)) {
        recordId = new ObjectId(recordId);
      }

      console.log(`🗑️ [deleteReminder] Deleting reminder ${recordId}`);
      const result = await SecureDataAccess.delete('reminders', { _id: recordId }, context);
      console.log(`✅ [deleteReminder] Deleted reminder`);

      return result;
    } catch (error) {
      console.error('❌ Error deleting reminder:', error);
      throw error;
    }
  }

  /**
   * Search Reminders - Text search across reminder fields
   * @param {Object} params - Search parameters
   * @param {string} params.patientId - Patient ID (required)
   * @param {string} params.searchText - Text to search for (required)
   * @param {number} params.limit - Max results (default: 50)
   * @param {Object} context - Security context
   * @returns {Promise<Array>} Matching reminder records
   */
  async searchReminders(params, context) {
    try {
      // Convert patientId to ObjectId if needed
      let patientId = params.patientId;
      if (typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)) {
        patientId = new ObjectId(patientId);
      }

      // Build regex search
      const searchRegex = new RegExp(params.searchText, 'i');
      const filter = {
        patientId,
        $or: [
          { message: searchRegex },
          { reminderType: searchRegex },
          { status: searchRegex },
          { notes: searchRegex },
          { description: searchRegex }
        ]
      };

      const options = {
        limit: params.limit || 50,
        sort: { dateTime: -1 }
      };

      console.log(`🔍 [searchReminders] Searching reminders for patient ${patientId} with text: "${params.searchText}"`);
      const result = await SecureDataAccess.query('reminders', filter, options, context);
      console.log(`📊 [searchReminders] Found ${result?.length || 0} matching records`);

      return result;
    } catch (error) {
      console.error('❌ Error searching reminders:', error);
      throw error;
    }
  }

  // ============================================================================
  // SERVICE MANAGEMENT
  // ============================================================================

  /**
   * Stop the reminder service
   */
  stop() {
    if (this.appointmentReminderTask) {
      this.appointmentReminderTask.stop();
    }
    if (this.scheduledReminderTask) {
      this.scheduledReminderTask.stop();
    }

    // Clear all scheduled tasks
    for (const [id, scheduled] of this.scheduledTasks) {
      if (scheduled.type === 'timeout') {
        clearTimeout(scheduled.task);
      } else if (scheduled.type === 'cron') {
        scheduled.task.stop();
      }
    }
    this.scheduledTasks.clear();

    // Clear cached practice contexts
    this.clinicDatabases.clear();

    this.isRunning = false;
    console.log('🛑 Reminder Service stopped');
  }
}

// Export singleton instance
module.exports = new ReminderService();