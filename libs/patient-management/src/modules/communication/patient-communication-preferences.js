/**
 * Patient Communication Preferences Module
 * 
 * Manages patient communication preferences, channels, timing, and consent settings
 * for all forms of patient communications.
 * 
 * Features:
 * - Communication channel preferences (email, SMS, phone, portal)
 * - Timing and frequency preferences 
 * - Content type preferences (reminders, alerts, newsletters)
 * - Consent management and opt-in/opt-out tracking
 * - Language and format preferences
 * - Emergency communication overrides
 */

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class PatientCommunicationPreferences {
    constructor() {
        this.serviceName = 'PatientCommunicationPreferences';
        this.serviceToken = null;
        this.initialized = false;
        this.channels = {
            EMAIL: 'email',
            SMS: 'sms',
            PHONE: 'phone',
            PORTAL: 'portal',
            POSTAL_MAIL: 'postal_mail',
            PUSH_NOTIFICATION: 'push_notification'
        };
        this.contentTypes = {
            APPOINTMENT_REMINDERS: 'appointment_reminders',
            MEDICATION_REMINDERS: 'medication_reminders',
            TEST_RESULTS: 'test_results',
            BILLING_STATEMENTS: 'billing_statements',
            HEALTH_EDUCATION: 'health_education',
            MARKETING: 'marketing',
            EMERGENCY_ALERTS: 'emergency_alerts',
            FOLLOW_UP_CARE: 'follow_up_care'
        };
        this.frequencies = {
            IMMEDIATE: 'immediate',
            DAILY: 'daily',
            WEEKLY: 'weekly',
            MONTHLY: 'monthly',
            AS_NEEDED: 'as_needed'
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
     * Set patient communication preferences
     */
    async setPatientPreferences(params, practiceContext) {
        await this.initialize();

        const validation = this.validatePreferencesData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { patientId, preferences } = validation.processedData;

        try {
            // Check if preferences already exist
            const existingPrefs = await this.getPatientPreferences(patientId, practiceContext);
            
            const preferencesData = {
                patientId,
                channels: preferences.channels || this.getDefaultChannelPreferences(),
                contentTypes: preferences.contentTypes || this.getDefaultContentPreferences(),
                timing: preferences.timing || this.getDefaultTimingPreferences(),
                language: preferences.language || 'he',
                format: preferences.format || 'html',
                consent: preferences.consent || this.getDefaultConsent(),
                emergencyOverrides: preferences.emergencyOverrides || true,
                updatedAt: new Date(),
                updatedBy: params.userId
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'setPatientPreferences',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            let result;
            if (existingPrefs) {
                // Update existing preferences
                result = await SecureDataAccess.update('patient_communication_preferences',
                    { patientId },
                    preferencesData,
                    context
                );
            } else {
                // Create new preferences
                preferencesData.createdAt = new Date();
                preferencesData.createdBy = params.userId;
                result = await SecureDataAccess.create('patient_communication_preferences', 
                    preferencesData, context);
            }

            // Audit trail
            await this.auditPreferencesAction('SET_PREFERENCES', {
                patientId,
                action: existingPrefs ? 'update' : 'create',
                preferences: preferencesData,
                userId: params.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                preferences: preferencesData,
                message: 'Communication preferences updated successfully'
            };

        } catch (error) {
            console.error(`Error setting patient preferences:`, error);
            throw new Error(`Failed to set patient preferences: ${error.message}`);
        }
    }

    /**
     * Get patient communication preferences
     */
    async getPatientPreferences(patientId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientPreferences',
            practiceId: practiceContext.practiceId
        };

        try {
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const preferences = await SecureDataAccess.query('patient_communication_preferences',
                { patientId }, {}, context);

            if (preferences && preferences.length > 0) {
                return preferences[0];
            }

            // Return default preferences if none exist
            return {
                patientId,
                channels: this.getDefaultChannelPreferences(),
                contentTypes: this.getDefaultContentPreferences(),
                timing: this.getDefaultTimingPreferences(),
                language: 'he',
                format: 'html',
                consent: this.getDefaultConsent(),
                emergencyOverrides: true,
                isDefault: true
            };

        } catch (error) {
            console.error(`Error getting patient preferences:`, error);
            throw new Error(`Failed to get patient preferences: ${error.message}`);
        }
    }

    /**
     * Update consent for specific communication type
     */
    async updateConsent(params, practiceContext) {
        await this.initialize();

        const validation = this.validateConsentData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { patientId, contentType, channel, consent, consentDate } = validation.processedData;

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'updateConsent',
                practiceId: practiceContext.practiceId
            };

            // Get current preferences
            const currentPrefs = await this.getPatientPreferences(patientId, practiceContext);
            
            // Update consent
            if (!currentPrefs.consent) {
                currentPrefs.consent = {};
            }
            
            if (!currentPrefs.consent[contentType]) {
                currentPrefs.consent[contentType] = {};
            }

            currentPrefs.consent[contentType][channel] = {
                granted: consent,
                date: consentDate || new Date(),
                source: 'patient_update',
                ipAddress: params.ipAddress,
                method: params.method || 'portal'
            };

            // Update in database
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.update('patient_communication_preferences',
                { patientId },
                { 
                    consent: currentPrefs.consent,
                    updatedAt: new Date(),
                    updatedBy: params.userId
                },
                context
            );

            // Create consent audit record
            await this.createConsentAudit({
                patientId,
                contentType,
                channel,
                consent,
                consentDate: consentDate || new Date(),
                userId: params.userId,
                ipAddress: params.ipAddress,
                method: params.method || 'portal',
                practiceId: practiceContext.practiceId
            });

            // Audit trail
            await this.auditPreferencesAction('UPDATE_CONSENT', {
                patientId,
                contentType,
                channel,
                consent,
                userId: params.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                message: `Consent ${consent ? 'granted' : 'revoked'} for ${contentType} via ${channel}`
            };

        } catch (error) {
            console.error(`Error updating consent:`, error);
            throw new Error(`Failed to update consent: ${error.message}`);
        }
    }

    /**
     * Check if patient has consented to specific communication
     */
    async checkConsent(patientId, contentType, channel, practiceContext) {
        await this.initialize();

        try {
            const preferences = await this.getPatientPreferences(patientId, practiceContext);
            
            // Check emergency override
            if (contentType === this.contentTypes.EMERGENCY_ALERTS && preferences.emergencyOverrides) {
                return {
                    hasConsent: true,
                    reason: 'Emergency override enabled'
                };
            }

            // Check specific consent
            if (preferences.consent && 
                preferences.consent[contentType] && 
                preferences.consent[contentType][channel]) {
                
                const consentRecord = preferences.consent[contentType][channel];
                return {
                    hasConsent: consentRecord.granted,
                    consentDate: consentRecord.date,
                    reason: consentRecord.granted ? 'Explicit consent granted' : 'Consent revoked'
                };
            }

            // Check default consent
            const defaultConsent = this.getDefaultConsent();
            const hasDefaultConsent = defaultConsent[contentType] && defaultConsent[contentType][channel];

            return {
                hasConsent: hasDefaultConsent || false,
                reason: hasDefaultConsent ? 'Default consent' : 'No consent on record'
            };

        } catch (error) {
            console.error(`Error checking consent:`, error);
            return {
                hasConsent: false,
                reason: 'Error checking consent'
            };
        }
    }

    /**
     * Get preferred communication method for patient and content type
     */
    async getPreferredCommunicationMethod(patientId, contentType, practiceContext) {
        await this.initialize();

        try {
            const preferences = await this.getPatientPreferences(patientId, practiceContext);
            
            // Get content type preferences
            const contentPrefs = preferences.contentTypes[contentType];
            if (!contentPrefs || !contentPrefs.enabled) {
                return {
                    method: null,
                    reason: 'Content type disabled'
                };
            }

            // Find preferred channel based on priority and consent
            const channels = contentPrefs.channels || Object.values(this.channels);
            
            for (const channel of channels) {
                const consent = await this.checkConsent(patientId, contentType, channel, practiceContext);
                if (consent.hasConsent && preferences.channels[channel] && preferences.channels[channel].enabled) {
                    return {
                        method: channel,
                        frequency: contentPrefs.frequency || this.frequencies.AS_NEEDED,
                        timing: preferences.timing,
                        format: preferences.format,
                        language: preferences.language
                    };
                }
            }

            return {
                method: null,
                reason: 'No consented and enabled communication channel found'
            };

        } catch (error) {
            console.error(`Error getting preferred communication method:`, error);
            return {
                method: null,
                reason: 'Error determining communication method'
            };
        }
    }

    /**
     * Create consent audit record
     */
    async createConsentAudit(auditData) {
        const context = {
            serviceId: this.serviceName,
            operation: 'createConsentAudit',
            practiceId: auditData.practiceId
        };

        const auditRecord = {
            ...auditData,
            timestamp: new Date(),
            auditType: 'consent_change'
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.create('patient_consent_audit', auditRecord, context);
    }

    /**
     * Get default channel preferences
     */
    getDefaultChannelPreferences() {
        return {
            [this.channels.EMAIL]: {
                enabled: true,
                address: null,
                verified: false,
                priority: 1
            },
            [this.channels.SMS]: {
                enabled: false,
                number: null,
                verified: false,
                priority: 2
            },
            [this.channels.PHONE]: {
                enabled: false,
                number: null,
                priority: 3
            },
            [this.channels.PORTAL]: {
                enabled: true,
                priority: 2
            },
            [this.channels.POSTAL_MAIL]: {
                enabled: false,
                address: null,
                priority: 4
            },
            [this.channels.PUSH_NOTIFICATION]: {
                enabled: false,
                priority: 3
            }
        };
    }

    /**
     * Get default content preferences
     */
    getDefaultContentPreferences() {
        return {
            [this.contentTypes.APPOINTMENT_REMINDERS]: {
                enabled: true,
                channels: [this.channels.EMAIL, this.channels.PORTAL],
                frequency: this.frequencies.AS_NEEDED
            },
            [this.contentTypes.MEDICATION_REMINDERS]: {
                enabled: true,
                channels: [this.channels.EMAIL],
                frequency: this.frequencies.AS_NEEDED
            },
            [this.contentTypes.TEST_RESULTS]: {
                enabled: true,
                channels: [this.channels.PORTAL, this.channels.EMAIL],
                frequency: this.frequencies.AS_NEEDED
            },
            [this.contentTypes.BILLING_STATEMENTS]: {
                enabled: true,
                channels: [this.channels.EMAIL, this.channels.POSTAL_MAIL],
                frequency: this.frequencies.MONTHLY
            },
            [this.contentTypes.HEALTH_EDUCATION]: {
                enabled: false,
                channels: [this.channels.EMAIL],
                frequency: this.frequencies.WEEKLY
            },
            [this.contentTypes.MARKETING]: {
                enabled: false,
                channels: [this.channels.EMAIL],
                frequency: this.frequencies.MONTHLY
            },
            [this.contentTypes.EMERGENCY_ALERTS]: {
                enabled: true,
                channels: [this.channels.EMAIL, this.channels.SMS, this.channels.PHONE],
                frequency: this.frequencies.IMMEDIATE
            },
            [this.contentTypes.FOLLOW_UP_CARE]: {
                enabled: true,
                channels: [this.channels.EMAIL, this.channels.PORTAL],
                frequency: this.frequencies.AS_NEEDED
            }
        };
    }

    /**
     * Get default timing preferences
     */
    getDefaultTimingPreferences() {
        return {
            quietHours: {
                start: '22:00',
                end: '08:00'
            },
            timezone: 'Asia/Jerusalem',
            preferredDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'sunday'],
            emergencyBypass: true
        };
    }

    /**
     * Get default consent settings
     */
    getDefaultConsent() {
        return {
            [this.contentTypes.APPOINTMENT_REMINDERS]: {
                [this.channels.EMAIL]: true,
                [this.channels.PORTAL]: true
            },
            [this.contentTypes.TEST_RESULTS]: {
                [this.channels.PORTAL]: true,
                [this.channels.EMAIL]: true
            },
            [this.contentTypes.EMERGENCY_ALERTS]: {
                [this.channels.EMAIL]: true,
                [this.channels.SMS]: true,
                [this.channels.PHONE]: true
            }
        };
    }

    /**
     * Validation methods
     */
    validatePreferencesData(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.preferences || typeof data.preferences !== 'object') {
            errors.push('Preferences object is required');
        } else {
            processedData.preferences = data.preferences;
        }

        return { success: errors.length === 0, errors, processedData };
    }

    validateConsentData(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.contentType || !Object.values(this.contentTypes).includes(data.contentType)) {
            errors.push('Valid content type is required');
        } else {
            processedData.contentType = data.contentType;
        }

        if (!data.channel || !Object.values(this.channels).includes(data.channel)) {
            errors.push('Valid communication channel is required');
        } else {
            processedData.channel = data.channel;
        }

        if (typeof data.consent !== 'boolean') {
            errors.push('Consent must be true or false');
        } else {
            processedData.consent = data.consent;
        }

        processedData.consentDate = data.consentDate;

        return { success: errors.length === 0, errors, processedData };
    }

    async auditPreferencesAction(action, details) {
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
const patientCommunicationPreferences = new PatientCommunicationPreferences();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('patientCommunicationPreferences', () => patientCommunicationPreferences);
}

module.exports = patientCommunicationPreferences;