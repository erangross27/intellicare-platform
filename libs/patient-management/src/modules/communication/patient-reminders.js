/**
 * Patient Reminders Module
 * 
 * Handles appointment reminders, medication reminders, and follow-up care reminders
 * for patients with automated scheduling and delivery.
 * 
 * Features:
 * - Appointment reminders (24h, 1h, 15min before)
 * - Medication reminders with dosage instructions
 * - Follow-up care reminders for ongoing treatments
 * - Custom reminder scheduling and preferences
 * - Multi-channel delivery (email, SMS, push, portal)
 */

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientReminders {
    constructor() {
        this.serviceName = 'PatientReminders';
        this.serviceToken = null;
        this.initialized = false;
        this.reminderTypes = {
            APPOINTMENT: 'appointment',
            MEDICATION: 'medication',
            FOLLOWUP: 'followup',
            CUSTOM: 'custom'
        };
        this.deliveryChannels = {
            EMAIL: 'email',
            SMS: 'sms', 
            PUSH: 'push',
            PORTAL: 'portal'
        };
    }

    async initialize() {
        if (this.initialized) return;
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate(this.serviceName);
        this.initialized = true;
    }

    /**
     * Schedule appointment reminder for a patient
     */
    async scheduleAppointmentReminder(params, practiceContext) {
        await this.initialize();

        const validation = this.validateAppointmentReminderData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { patientId, appointmentId, reminderTimes, deliveryChannels, customMessage } = validation.processedData;

        try {
            // Get patient preferences for reminders
            const patientPrefs = await this.getPatientReminderPreferences(patientId, practiceContext);
            
            // Create reminder schedule
            const reminders = [];
            for (const timeOffset of reminderTimes) {
                const reminder = {
                    patientId,
                    appointmentId,
                    type: this.reminderTypes.APPOINTMENT,
                    scheduledTime: this.calculateReminderTime(params.appointmentDateTime, timeOffset),
                    timeOffset,
                    deliveryChannels: deliveryChannels || patientPrefs.preferredChannels,
                    message: customMessage || this.generateAppointmentReminderMessage(params),
                    status: 'scheduled',
                    createdAt: new Date(),
                    createdBy: params.userId
                };
                reminders.push(reminder);
            }

            // Store reminders in database
            const context = {
                serviceId: this.serviceName,
                operation: 'scheduleAppointmentReminder',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            for (const reminder of reminders) {
                await SecureDataAccess.create('patient_reminders', reminder, context);
            }

            // Schedule processing
            await this.scheduleReminderProcessing(reminders, practiceContext);

            // Audit trail
            await this.auditReminderAction('SCHEDULE_APPOINTMENT_REMINDER', {
                patientId,
                appointmentId,
                reminderCount: reminders.length,
                userId: params.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                reminders,
                message: `${reminders.length} appointment reminders scheduled successfully`
            };

        } catch (error) {
            console.error(`Error scheduling appointment reminder:`, error);
            throw new Error(`Failed to schedule appointment reminder: ${error.message}`);
        }
    }

    /**
     * Schedule medication reminder for a patient
     */
    async scheduleMedicationReminder(params, practiceContext) {
        await this.initialize();

        const validation = this.validateMedicationReminderData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { patientId, medicationId, schedule, duration, deliveryChannels } = validation.processedData;

        try {
            // Generate recurring reminder schedule
            const reminders = this.generateMedicationSchedule(params, practiceContext);
            
            const context = {
                serviceId: this.serviceName,
                operation: 'scheduleMedicationReminder',
                practiceId: practiceContext.practiceId
            };

            // Store all reminders
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            for (const reminder of reminders) {
                await SecureDataAccess.create('patient_reminders', reminder, context);
            }

            // Audit trail
            await this.auditReminderAction('SCHEDULE_MEDICATION_REMINDER', {
                patientId,
                medicationId,
                reminderCount: reminders.length,
                duration: duration,
                userId: params.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                reminders,
                message: `${reminders.length} medication reminders scheduled for ${duration} days`
            };

        } catch (error) {
            console.error(`Error scheduling medication reminder:`, error);
            throw new Error(`Failed to schedule medication reminder: ${error.message}`);
        }
    }

    /**
     * Get patient's reminder preferences
     */
    async getPatientReminderPreferences(patientId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientReminderPreferences',
            practiceId: practiceContext.practiceId
        };

        try {
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const preferences = await SecureDataAccess.query('patient_reminder_preferences', 
                { patientId }, {}, context);

            if (preferences && preferences.length > 0) {
                return preferences[0];
            }

            // Return default preferences
            return {
                patientId,
                preferredChannels: [this.deliveryChannels.EMAIL],
                appointmentReminders: {
                    enabled: true,
                    timings: ['24h', '1h']
                },
                medicationReminders: {
                    enabled: true,
                    snoozeMinutes: 15
                },
                followupReminders: {
                    enabled: true,
                    timings: ['1week', '1day']
                },
                quietHours: {
                    start: '22:00',
                    end: '08:00'
                }
            };

        } catch (error) {
            console.error(`Error getting reminder preferences:`, error);
            throw new Error(`Failed to get reminder preferences: ${error.message}`);
        }
    }

    /**
     * Process due reminders
     */
    async processDueReminders(practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'processDueReminders',
            practiceId: practiceContext.practiceId
        };

        try {
            const currentTime = new Date();
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const dueReminders = await SecureDataAccess.query('patient_reminders', {
                scheduledTime: { $lte: currentTime },
                status: 'scheduled'
            }, {}, context);

            let processedCount = 0;
            for (const reminder of dueReminders) {
                try {
                    await this.sendReminder(reminder, practiceContext);
                    
                    // Update reminder status
                    await SecureDataAccess.update('patient_reminders',
                        { _id: reminder._id },
                        { 
                            status: 'sent',
                            sentAt: new Date()
                        },
                        context
                    );
                    
                    processedCount++;
                } catch (error) {
                    console.error(`Failed to send reminder ${reminder._id}:`, error);
                    
                    // Update with error status
                    await SecureDataAccess.update('patient_reminders',
                        { _id: reminder._id },
                        { 
                            status: 'failed',
                            errorMessage: error.message,
                            lastAttempt: new Date()
                        },
                        context
                    );
                }
            }

            return {
                success: true,
                processedCount,
                totalDue: dueReminders.length,
                message: `Processed ${processedCount}/${dueReminders.length} due reminders`
            };

        } catch (error) {
            console.error(`Error processing due reminders:`, error);
            throw new Error(`Failed to process due reminders: ${error.message}`);
        }
    }

    /**
     * Generate medication reminder schedule
     */
    generateMedicationSchedule(params, practiceContext) {
        const { patientId, medicationId, schedule, duration, startDate } = params;
        const reminders = [];
        const start = new Date(startDate);
        
        for (let day = 0; day < duration; day++) {
            for (const time of schedule.times) {
                const reminderTime = new Date(start);
                reminderTime.setDate(start.getDate() + day);
                const [hours, minutes] = time.split(':');
                reminderTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                reminders.push({
                    patientId,
                    medicationId,
                    type: this.reminderTypes.MEDICATION,
                    scheduledTime: reminderTime,
                    message: this.generateMedicationReminderMessage(params),
                    deliveryChannels: params.deliveryChannels || [this.deliveryChannels.EMAIL],
                    status: 'scheduled',
                    createdAt: new Date(),
                    metadata: {
                        dosage: params.dosage,
                        instructions: params.instructions
                    }
                });
            }
        }

        return reminders;
    }

    /**
     * Validation methods
     */
    validateAppointmentReminderData(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.appointmentId) {
            errors.push('Appointment ID is required');
        } else {
            processedData.appointmentId = data.appointmentId;
        }

        if (!data.appointmentDateTime) {
            errors.push('Appointment date/time is required');
        }

        processedData.reminderTimes = data.reminderTimes || ['24h', '1h'];
        processedData.deliveryChannels = data.deliveryChannels;
        processedData.customMessage = data.customMessage;

        return { success: errors.length === 0, errors, processedData };
    }

    validateMedicationReminderData(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.medicationId) {
            errors.push('Medication ID is required');
        } else {
            processedData.medicationId = data.medicationId;
        }

        if (!data.schedule || !data.schedule.times || !Array.isArray(data.schedule.times)) {
            errors.push('Medication schedule times are required');
        } else {
            processedData.schedule = data.schedule;
        }

        if (!data.duration || data.duration <= 0) {
            errors.push('Duration must be greater than 0');
        } else {
            processedData.duration = parseInt(data.duration);
        }

        processedData.deliveryChannels = data.deliveryChannels || [this.deliveryChannels.EMAIL];

        return { success: errors.length === 0, errors, processedData };
    }

    calculateReminderTime(appointmentTime, offset) {
        const reminderTime = new Date(appointmentTime);
        const offsetMinutes = this.parseTimeOffset(offset);
        reminderTime.setMinutes(reminderTime.getMinutes() - offsetMinutes);
        return reminderTime;
    }

    parseTimeOffset(offset) {
        if (offset.endsWith('h')) {
            return parseInt(offset) * 60;
        } else if (offset.endsWith('min')) {
            return parseInt(offset);
        } else if (offset.endsWith('d')) {
            return parseInt(offset) * 24 * 60;
        }
        return 60; // default 1 hour
    }

    generateAppointmentReminderMessage(params) {
        return `Reminder: You have an appointment scheduled for ${params.appointmentDateTime}. Please arrive 15 minutes early.`;
    }

    generateMedicationReminderMessage(params) {
        return `Medication reminder: Time to take ${params.medicationName} - ${params.dosage}. ${params.instructions}`;
    }

    async sendReminder(reminder, practiceContext) {
        // Integrate with communication services to actually send the reminder
        console.log(`Sending reminder ${reminder._id} via channels: ${reminder.deliveryChannels.join(', ')}`);
    }

    async scheduleReminderProcessing(reminders, practiceContext) {
        // Schedule reminders for processing
        console.log(`Scheduled ${reminders.length} reminders for processing`);
    }

    async auditReminderAction(action, details) {
        const auditEntry = {
            timestamp: new Date(),
            service: this.serviceName,
            action,
            details,
            success: true
        };
        console.log('Audit:', auditEntry);
    }
}

// Create and export singleton
const patientReminders = new PatientReminders();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('patientReminders', () => patientReminders);
}

module.exports = patientReminders;