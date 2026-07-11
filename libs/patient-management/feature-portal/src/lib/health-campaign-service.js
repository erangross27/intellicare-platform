/**
 * Health Campaign Workflow Service - DDD/NX Modular Version
 * Handles multi-step communication sequences for preventive care campaigns
 * Migrated from legacy backend/services structure to DDD/NX architecture
 * Author: Claude
 * Created: 2024
 */

// Use updated path depth for imports from new structure
const SecureDataAccess = require('../../../../../backend/services/secureDataAccess');
const SecureConfigService = require('../../../../../backend/services/secureConfigService');
const serviceAccountManager = require('../../../../../backend/services/serviceAccountManager');
const encryptionService = require('../../../../../backend/services/encryptionService');
const BulkCommunicationService = require('../../../../../backend/services/bulkCommunicationService');
const MessageTemplateService = require('../../../../../backend/services/messageTemplateService');
const AuditLog = require('../../../../../backend/models/AuditLog');

class HealthCampaignService {
    constructor() {
        this.serviceToken = null;
        this.initialized = false;
        this.bulkComm = null;
        this.templateService = null;
        
        // Pre-defined campaign types
        this.campaignTypes = {
            flu_vaccination: {
                name: { he: 'קמפיין חיסון שפעת', en: 'Flu Vaccination Campaign' },
                duration: 60, // days
                steps: [
                    { day: 0, type: 'sms', template: 'flu_vaccination_initial' },
                    { day: 7, type: 'email', template: 'flu_vaccination_reminder' },
                    { day: 21, type: 'sms', template: 'flu_vaccination_final' }
                ]
            },
            mammogram_screening: {
                name: { he: 'קמפיין בדיקת מאמוגרפיה', en: 'Mammogram Screening Campaign' },
                duration: 90,
                steps: [
                    { day: 0, type: 'email', template: 'mammogram_initial' },
                    { day: 14, type: 'sms', template: 'mammogram_reminder' },
                    { day: 45, type: 'portal', template: 'mammogram_urgent' },
                    { day: 75, type: 'email', template: 'mammogram_final' }
                ]
            },
            diabetes_checkup: {
                name: { he: 'קמפיין בדיקת סוכרת', en: 'Diabetes Checkup Campaign' },
                duration: 120,
                steps: [
                    { day: 0, type: 'sms', template: 'diabetes_checkup_initial' },
                    { day: 30, type: 'email', template: 'diabetes_checkup_followup' },
                    { day: 60, type: 'portal', template: 'diabetes_checkup_reminder' },
                    { day: 90, type: 'sms', template: 'diabetes_checkup_urgent' }
                ]
            },
            medication_adherence: {
                name: { he: 'קמפיין דבקות תרופתית', en: 'Medication Adherence Campaign' },
                duration: 30,
                steps: [
                    { day: 0, type: 'sms', template: 'medication_adherence_start' },
                    { day: 7, type: 'portal', template: 'medication_adherence_check' },
                    { day: 14, type: 'sms', template: 'medication_adherence_mid' },
                    { day: 21, type: 'email', template: 'medication_adherence_final' }
                ]
            },
            blood_pressure_monitoring: {
                name: { he: 'קמפיין ניטור לחץ דם', en: 'Blood Pressure Monitoring Campaign' },
                duration: 45,
                steps: [
                    { day: 0, type: 'email', template: 'bp_monitoring_start' },
                    { day: 7, type: 'sms', template: 'bp_monitoring_week1' },
                    { day: 14, type: 'portal', template: 'bp_monitoring_week2' },
                    { day: 30, type: 'email', template: 'bp_monitoring_summary' }
                ]
            }
        };

        // Campaign status tracking
        this.campaignStatuses = {
            DRAFT: 'draft',
            ACTIVE: 'active',
            PAUSED: 'paused',
            COMPLETED: 'completed',
            CANCELLED: 'cancelled'
        };
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            await SecureConfigService.initialize();
            this.serviceToken = await serviceAccountManager.authenticate('health-campaign-service');
            
            this.bulkComm = new BulkCommunicationService();
            await this.bulkComm.initialize();
            
            this.templateService = new MessageTemplateService();
            await this.templateService.initialize();
            
            this.initialized = true;
            console.log('✅ HealthCampaignService initialized successfully');
        } catch (error) {
            console.error('❌ HealthCampaignService initialization failed:', error);
            throw error;
        }
    }

    /**
     * Create new health campaign
     */
    async createHealthCampaign(params, practiceContext) {
        const {
            campaignType,
            patientFilter = {},
            customSteps = null,
            startDate = new Date(),
            customName = null,
            customDuration = null
        } = params;

        // Validate campaign type or use custom
        let campaignConfig;
        if (this.campaignTypes[campaignType]) {
            campaignConfig = { ...this.campaignTypes[campaignType] };
        } else {
            if (!customSteps || !customName) {
                throw new Error('Custom campaign requires steps and name');
            }
            campaignConfig = {
                name: customName,
                duration: customDuration || 30,
                steps: customSteps
            };
        }

        // Get target patients
        const patients = await this.getTargetPatients(patientFilter, practiceContext);
        
        const campaign = {
            id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: campaignType || 'custom',
            name: campaignConfig.name,
            status: this.campaignStatuses.DRAFT,
            patientFilter,
            targetPatients: patients.map(p => p.id),
            totalPatients: patients.length,
            steps: campaignConfig.steps,
            duration: campaignConfig.duration,
            startDate: new Date(startDate),
            endDate: new Date(Date.now() + (campaignConfig.duration * 24 * 60 * 60 * 1000)),
            createdAt: new Date(),
            createdBy: practiceContext.userId,
            practiceId: practiceContext.practiceId,
            metrics: {
                sent: 0,
                delivered: 0,
                opened: 0,
                clicked: 0,
                responded: 0,
                scheduled: 0,
                opted_out: 0
            },
            encrypted: true
        };

        // Encrypt sensitive data
        if (campaign.patientFilter.conditions) {
            campaign.patientFilter.conditions = await encryptionService.encrypt(
                JSON.stringify(campaign.patientFilter.conditions), 'phi'
            );
        }

        // Save campaign using SecureDataAccess
        const savedCampaign = await SecureDataAccess.create('health_campaigns', campaign, {
            serviceId: 'health-campaign-service',
            operation: 'create-health-campaign',
            practiceId: practiceContext.practiceId
        });

        // Audit log
        await AuditLog.create({
            action: 'CREATE_HEALTH_CAMPAIGN',
            resource: 'health_campaigns',
            resourceId: campaign.id,
            userId: practiceContext.userId,
            practiceId: practiceContext.practiceId,
            details: {
                campaignType: campaign.type,
                targetPatients: campaign.totalPatients,
                duration: campaign.duration
            },
            timestamp: new Date()
        });

        return {
            success: true,
            campaignId: campaign.id,
            message: {
                he: `קמפיין ${campaign.name.he} נוצר בהצלחה עם ${campaign.totalPatients} מטופלים`,
                en: `Campaign ${campaign.name.en} created successfully with ${campaign.totalPatients} patients`
            },
            campaign: {
                id: campaign.id,
                name: campaign.name,
                type: campaign.type,
                status: campaign.status,
                targetPatients: campaign.totalPatients,
                startDate: campaign.startDate,
                duration: campaign.duration
            }
        };
    }

    /**
     * Start campaign execution
     */
    async startHealthCampaign(params, practiceContext) {
        const { campaignId } = params;

        const campaign = await SecureDataAccess.query('health_campaigns', 
            { id: campaignId }, 
            { limit: 1 }, 
            {
                serviceId: 'health-campaign-service',
                operation: 'get-campaign',
                practiceId: practiceContext.practiceId
            }
        );

        if (!campaign || campaign.length === 0) {
            throw new Error('Campaign not found');
        }

        const campaignData = campaign[0];
        if (campaignData.status !== this.campaignStatuses.DRAFT) {
            throw new Error('Campaign can only be started from draft status');
        }

        // Update campaign status
        await SecureDataAccess.update('health_campaigns', 
            { id: campaignId }, 
            { status: this.campaignStatuses.ACTIVE, actualStartDate: new Date() },
            {
                serviceId: 'health-campaign-service',
                operation: 'start-campaign',
                practiceId: practiceContext.practiceId
            }
        );

        // Schedule all campaign steps
        await this.scheduleAllCampaignSteps(campaignData, practiceContext);

        // Audit log
        await AuditLog.create({
            action: 'START_HEALTH_CAMPAIGN',
            resource: 'health_campaigns',
            resourceId: campaignId,
            userId: practiceContext.userId,
            practiceId: practiceContext.practiceId,
            timestamp: new Date()
        });

        return {
            success: true,
            message: {
                he: `קמפיין ${campaignData.name.he} הופעל בהצלחה`,
                en: `Campaign ${campaignData.name.en} started successfully`
            }
        };
    }

    /**
     * Schedule all steps for a campaign
     */
    async scheduleAllCampaignSteps(campaign, practiceContext) {
        const schedules = [];

        for (const step of campaign.steps) {
            const stepDate = new Date(campaign.actualStartDate || campaign.startDate);
            stepDate.setDate(stepDate.getDate() + step.day);

            const schedule = {
                campaignId: campaign.id,
                stepIndex: campaign.steps.indexOf(step),
                stepType: step.type,
                templateName: step.template,
                scheduledDate: stepDate,
                status: 'scheduled',
                targetPatients: campaign.targetPatients,
                createdAt: new Date(),
                practiceId: practiceContext.practiceId
            };

            schedules.push(schedule);
        }

        // Save all schedules using SecureDataAccess
        for (const schedule of schedules) {
            await SecureDataAccess.create('campaign_schedules', schedule, {
                serviceId: 'health-campaign-service',
                operation: 'create-campaign-schedule',
                practiceId: practiceContext.practiceId
            });
        }

        return schedules;
    }

    /**
     * Execute scheduled campaign step
     */
    async executeCampaignStep(scheduleId, practiceContext) {
        const schedules = await SecureDataAccess.query('campaign_schedules', 
            { id: scheduleId }, 
            { limit: 1 },
            {
                serviceId: 'health-campaign-service',
                operation: 'get-campaign-schedule',
                practiceId: practiceContext.practiceId
            }
        );

        if (!schedules || schedules.length === 0 || schedules[0].status !== 'scheduled') {
            return { success: false, message: 'Schedule not found or not ready' };
        }

        const schedule = schedules[0];

        // Mark as executing
        await SecureDataAccess.update('campaign_schedules', 
            { id: scheduleId },
            { status: 'executing', executionStarted: new Date() },
            {
                serviceId: 'health-campaign-service',
                operation: 'update-campaign-schedule',
                practiceId: practiceContext.practiceId
            }
        );

        try {
            let result;
            const templateData = { campaignId: schedule.campaignId };

            switch (schedule.stepType) {
                case 'sms':
                    result = await this.bulkComm.sendBulkPatientSMS({
                        patientIds: schedule.targetPatients,
                        templateName: schedule.templateName,
                        templateData
                    }, practiceContext);
                    break;

                case 'email':
                    result = await this.bulkComm.sendBulkPatientEmail({
                        patientIds: schedule.targetPatients,
                        templateName: schedule.templateName,
                        templateData
                    }, practiceContext);
                    break;

                case 'portal':
                    result = await this.sendCampaignPortalMessages(
                        schedule.targetPatients,
                        schedule.templateName,
                        templateData,
                        practiceContext
                    );
                    break;

                default:
                    throw new Error(`Unsupported step type: ${schedule.stepType}`);
            }

            // Update schedule with results
            await SecureDataAccess.update('campaign_schedules', 
                { id: scheduleId },
                {
                    status: 'completed',
                    executionCompleted: new Date(),
                    results: result,
                    sentCount: result.successCount || 0,
                    failedCount: result.failureCount || 0
                },
                {
                    serviceId: 'health-campaign-service',
                    operation: 'complete-campaign-schedule',
                    practiceId: practiceContext.practiceId
                }
            );

            // Update campaign metrics
            await this.updateCampaignMetrics(schedule.campaignId, result, practiceContext);

            return { success: true, result };

        } catch (error) {
            // Mark as failed
            await SecureDataAccess.update('campaign_schedules', 
                { id: scheduleId },
                {
                    status: 'failed',
                    executionCompleted: new Date(),
                    error: error.message
                },
                {
                    serviceId: 'health-campaign-service',
                    operation: 'fail-campaign-schedule',
                    practiceId: practiceContext.practiceId
                }
            );

            throw error;
        }
    }

    /**
     * Send portal messages for campaign
     */
    async sendCampaignPortalMessages(patientIds, templateName, templateData, practiceContext) {
        const template = await this.templateService.getTemplate(templateName, 'portal', practiceContext);
        let successCount = 0;
        let failureCount = 0;
        const errors = [];

        for (const patientId of patientIds) {
            try {
                const patients = await SecureDataAccess.query('patients', 
                    { id: patientId }, 
                    { limit: 1 },
                    {
                        serviceId: 'health-campaign-service',
                        operation: 'get-patient-for-campaign',
                        practiceId: practiceContext.practiceId
                    }
                );

                if (!patients || patients.length === 0) {
                    failureCount++;
                    continue;
                }

                const patient = patients[0];

                // Personalize message
                const personalizedContent = await this.templateService.renderTemplate(
                    template.content,
                    { ...templateData, patient }
                );

                // Create portal message (this would integrate with patient portal service)
                const portalMessage = {
                    patientId: patientId,
                    senderId: practiceContext.userId,
                    senderType: 'provider',
                    subject: template.subject || 'Health Campaign Message',
                    content: personalizedContent,
                    priority: template.priority || 'normal',
                    campaignId: templateData.campaignId,
                    type: 'campaign',
                    timestamp: new Date(),
                    practiceId: practiceContext.practiceId
                };

                await SecureDataAccess.create('portal_messages', portalMessage, {
                    serviceId: 'health-campaign-service',
                    operation: 'create-portal-message',
                    practiceId: practiceContext.practiceId
                });

                successCount++;

            } catch (error) {
                failureCount++;
                errors.push({ patientId, error: error.message });
            }
        }

        return {
            successCount,
            failureCount,
            totalAttempted: patientIds.length,
            errors
        };
    }

    /**
     * Get campaign analytics
     */
    async getCampaignAnalytics(params, practiceContext) {
        const { campaignId, timeRange = 30 } = params;

        let query = { practiceId: practiceContext.practiceId };
        if (campaignId) {
            query.id = campaignId;
        }

        const campaigns = await SecureDataAccess.query('health_campaigns', query, {}, {
            serviceId: 'health-campaign-service',
            operation: 'get-campaigns-analytics',
            practiceId: practiceContext.practiceId
        });

        const analytics = {
            totalCampaigns: campaigns.length,
            activeCampaigns: campaigns.filter(c => c.status === 'active').length,
            completedCampaigns: campaigns.filter(c => c.status === 'completed').length,
            totalPatientsReached: campaigns.reduce((sum, c) => sum + c.totalPatients, 0),
            aggregateMetrics: {
                sent: campaigns.reduce((sum, c) => sum + (c.metrics.sent || 0), 0),
                delivered: campaigns.reduce((sum, c) => sum + (c.metrics.delivered || 0), 0),
                opened: campaigns.reduce((sum, c) => sum + (c.metrics.opened || 0), 0),
                responded: campaigns.reduce((sum, c) => sum + (c.metrics.responded || 0), 0)
            },
            campaignsByType: {},
            recentCampaigns: campaigns.slice(-10)
        };

        // Group by campaign type
        campaigns.forEach(campaign => {
            if (!analytics.campaignsByType[campaign.type]) {
                analytics.campaignsByType[campaign.type] = 0;
            }
            analytics.campaignsByType[campaign.type]++;
        });

        // Calculate engagement rates
        if (analytics.aggregateMetrics.sent > 0) {
            analytics.engagementRates = {
                deliveryRate: (analytics.aggregateMetrics.delivered / analytics.aggregateMetrics.sent * 100).toFixed(2),
                openRate: (analytics.aggregateMetrics.opened / analytics.aggregateMetrics.delivered * 100).toFixed(2),
                responseRate: (analytics.aggregateMetrics.responded / analytics.aggregateMetrics.delivered * 100).toFixed(2)
            };
        }

        return {
            success: true,
            analytics,
            message: {
                he: `נתוני אנליטיקה של ${campaigns.length} קמפיינים`,
                en: `Analytics for ${campaigns.length} campaigns`
            }
        };
    }

    /**
     * Update campaign metrics
     */
    async updateCampaignMetrics(campaignId, stepResults, practiceContext) {
        const campaigns = await SecureDataAccess.query('health_campaigns', 
            { id: campaignId }, 
            { limit: 1 },
            {
                serviceId: 'health-campaign-service',
                operation: 'get-campaign-for-metrics',
                practiceId: practiceContext.practiceId
            }
        );

        if (!campaigns || campaigns.length === 0) return;

        const campaign = campaigns[0];
        const updatedMetrics = {
            ...campaign.metrics,
            sent: (campaign.metrics.sent || 0) + (stepResults.successCount || 0),
            delivered: (campaign.metrics.delivered || 0) + (stepResults.deliveredCount || 0),
            opened: (campaign.metrics.opened || 0) + (stepResults.openedCount || 0),
            clicked: (campaign.metrics.clicked || 0) + (stepResults.clickedCount || 0),
            responded: (campaign.metrics.responded || 0) + (stepResults.respondedCount || 0)
        };

        await SecureDataAccess.update('health_campaigns', 
            { id: campaignId },
            { metrics: updatedMetrics },
            {
                serviceId: 'health-campaign-service',
                operation: 'update-campaign-metrics',
                practiceId: practiceContext.practiceId
            }
        );
    }

    /**
     * Get target patients based on filter
     */
    async getTargetPatients(patientFilter, practiceContext) {
        const query = { practiceId: practiceContext.practiceId };

        // Apply filters
        if (patientFilter.ageMin || patientFilter.ageMax) {
            query.age = {};
            if (patientFilter.ageMin) query.age.$gte = patientFilter.ageMin;
            if (patientFilter.ageMax) query.age.$lte = patientFilter.ageMax;
        }

        if (patientFilter.gender) {
            query.gender = patientFilter.gender;
        }

        if (patientFilter.conditions && patientFilter.conditions.length > 0) {
            query.conditions = { $in: patientFilter.conditions };
        }

        if (patientFilter.lastVisitDays) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - patientFilter.lastVisitDays);
            query.lastVisit = { $lte: cutoffDate };
        }

        const patients = await SecureDataAccess.query('patients', query, {}, {
            serviceId: 'health-campaign-service',
            operation: 'get-target-patients',
            practiceId: practiceContext.practiceId
        });

        return patients;
    }

    /**
     * Pause campaign
     */
    async pauseHealthCampaign(params, practiceContext) {
        const { campaignId } = params;

        await SecureDataAccess.update('health_campaigns', 
            { id: campaignId },
            { status: this.campaignStatuses.PAUSED },
            {
                serviceId: 'health-campaign-service',
                operation: 'pause-campaign',
                practiceId: practiceContext.practiceId
            }
        );

        // Pause all scheduled steps
        await SecureDataAccess.update('campaign_schedules',
            { campaignId, status: 'scheduled' },
            { status: 'paused' },
            {
                serviceId: 'health-campaign-service',
                operation: 'pause-campaign-schedules',
                practiceId: practiceContext.practiceId
            }
        );

        return {
            success: true,
            message: {
                he: 'קמפיין הושהה בהצלחה',
                en: 'Campaign paused successfully'
            }
        };
    }

    /**
     * Resume campaign
     */
    async resumeHealthCampaign(params, practiceContext) {
        const { campaignId } = params;

        await SecureDataAccess.update('health_campaigns', 
            { id: campaignId },
            { status: this.campaignStatuses.ACTIVE },
            {
                serviceId: 'health-campaign-service',
                operation: 'resume-campaign',
                practiceId: practiceContext.practiceId
            }
        );

        // Resume paused steps
        await SecureDataAccess.update('campaign_schedules',
            { campaignId, status: 'paused' },
            { status: 'scheduled' },
            {
                serviceId: 'health-campaign-service',
                operation: 'resume-campaign-schedules',
                practiceId: practiceContext.practiceId
            }
        );

        return {
            success: true,
            message: {
                he: 'קמפיין חודש בהצלחה',
                en: 'Campaign resumed successfully'
            }
        };
    }
}

module.exports = HealthCampaignService;