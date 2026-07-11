/**
 * Prior Authorization Module
 * 
 * Handles prior authorization requests, tracking, and management for healthcare services
 * that require insurance pre-approval.
 * 
 * Features:
 * - Prior authorization request creation and submission
 * - Authorization status tracking and updates
 * - Document management for auth requests
 * - Automated follow-up and reminders
 * - Authorization expiration monitoring
 * - Integration with coverage checking
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class PriorAuthorization {
    constructor() {
        this.serviceName = 'PriorAuthorization';
        this.serviceToken = null;
        this.initialized = false;
        this.authStatuses = {
            PENDING_SUBMISSION: 'pending_submission',
            SUBMITTED: 'submitted',
            UNDER_REVIEW: 'under_review',
            ADDITIONAL_INFO_REQUESTED: 'additional_info_requested',
            APPROVED: 'approved',
            DENIED: 'denied',
            EXPIRED: 'expired',
            CANCELLED: 'cancelled'
        };
        this.urgencyLevels = {
            ROUTINE: 'routine',
            URGENT: 'urgent',
            EMERGENT: 'emergent'
        };
        this.authTypes = {
            PROCEDURE: 'procedure',
            MEDICATION: 'medication',
            DURABLE_MEDICAL_EQUIPMENT: 'dme',
            REFERRAL: 'referral',
            IMAGING: 'imaging',
            HOSPITALIZATION: 'hospitalization'
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
     * Create prior authorization request
     */
    async createAuthorizationRequest(params, practiceContext) {
        await this.initialize();

        const validation = this.validateAuthRequest(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { 
            patientId, 
            serviceType, 
            procedureCodes,
            diagnosisCodes,
            requestedService,
            urgencyLevel,
            clinicalJustification,
            supportingDocuments,
            requestedStartDate 
        } = validation.processedData;

        try {
            // Generate authorization request ID
            const authRequestId = this.generateAuthRequestId();

            // Get patient insurance details
            const insuranceDetails = await this.getPatientInsurance(patientId, practiceContext);
            if (!insuranceDetails) {
                throw new Error('No active insurance found for patient');
            }

            // Create authorization request
            const authRequest = {
                authRequestId,
                patientId,
                insuranceProvider: insuranceDetails.insuranceProvider,
                policyNumber: insuranceDetails.policyNumber,
                serviceType,
                procedureCodes: Array.isArray(procedureCodes) ? procedureCodes : [procedureCodes],
                diagnosisCodes: Array.isArray(diagnosisCodes) ? diagnosisCodes : [diagnosisCodes],
                requestedService,
                urgencyLevel: urgencyLevel || this.urgencyLevels.ROUTINE,
                clinicalJustification,
                supportingDocuments: supportingDocuments || [],
                requestedStartDate: new Date(requestedStartDate),
                status: this.authStatuses.PENDING_SUBMISSION,
                submissionDate: null,
                approvalDate: null,
                expirationDate: null,
                authNumber: null,
                requestedBy: practiceContext.userId,
                createdDate: new Date(),
                practiceId: practiceContext.practiceId,
                statusHistory: [{
                    status: this.authStatuses.PENDING_SUBMISSION,
                    timestamp: new Date(),
                    updatedBy: practiceContext.userId,
                    notes: 'Authorization request created'
                }]
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'createAuthorizationRequest',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const createdAuth = await SecureDataAccess.create('prior_authorizations', authRequest, context);

            // Check if auto-submission is enabled
            if (params.autoSubmit) {
                await this.submitAuthorizationRequest(authRequestId, practiceContext);
            }

            // Audit trail
            await this.auditAuthAction('CREATE_AUTH_REQUEST', {
                authRequestId,
                patientId,
                serviceType,
                urgencyLevel,
                userId: practiceContext.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                authRequestId,
                status: authRequest.status,
                estimatedProcessingTime: this.getEstimatedProcessingTime(urgencyLevel, serviceType),
                message: practiceContext.language === 'he' 
                    ? `בקשת אישור מוקדם ${authRequestId} נוצרה בהצלחה`
                    : `Prior authorization request ${authRequestId} created successfully`
            };

        } catch (error) {
            console.error(`Error creating authorization request:`, error);
            throw new Error(`Failed to create authorization request: ${error.message}`);
        }
    }

    /**
     * Submit authorization request to insurance
     */
    async submitAuthorizationRequest(authRequestId, practiceContext) {
        await this.initialize();

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'submitAuthorizationRequest',
                practiceId: practiceContext.practiceId
            };

            // Get authorization request
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const authRequests = await SecureDataAccess.query('prior_authorizations',
                { authRequestId },
                {},
                context
            );

            if (!authRequests || authRequests.length === 0) {
                throw new Error('Authorization request not found');
            }

            const authRequest = authRequests[0];

            // Validate submission requirements
            const validationResult = await this.validateSubmissionRequirements(authRequest);
            if (!validationResult.valid) {
                throw new Error(`Submission validation failed: ${validationResult.errors.join(', ')}`);
            }

            // Submit to insurance provider
            const submissionResult = await this.submitToInsuranceProvider(authRequest, practiceContext);

            // Update authorization request
            const updateData = {
                status: this.authStatuses.SUBMITTED,
                submissionDate: new Date(),
                externalAuthId: submissionResult.externalAuthId,
                submissionReference: submissionResult.reference,
                lastUpdated: new Date()
            };

            await SecureDataAccess.update('prior_authorizations',
                { authRequestId },
                updateData,
                context
            );

            // Add to status history
            await this.addStatusHistory(authRequestId, this.authStatuses.SUBMITTED, {
                externalAuthId: submissionResult.externalAuthId,
                submissionReference: submissionResult.reference
            }, practiceContext);

            // Schedule follow-up check
            await this.scheduleFollowUpCheck(authRequestId, authRequest.urgencyLevel, practiceContext);

            return {
                success: true,
                externalAuthId: submissionResult.externalAuthId,
                reference: submissionResult.reference,
                estimatedDecisionDate: this.calculateEstimatedDecisionDate(authRequest.urgencyLevel),
                message: 'Authorization request submitted successfully'
            };

        } catch (error) {
            console.error(`Error submitting authorization request:`, error);
            throw new Error(`Failed to submit authorization request: ${error.message}`);
        }
    }

    /**
     * Update authorization status
     */
    async updateAuthorizationStatus(params, practiceContext) {
        await this.initialize();

        const { authRequestId, newStatus, authNumber, expirationDate, notes, attachments } = params;

        if (!authRequestId || !newStatus) {
            throw new Error('Authorization request ID and new status are required');
        }

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'updateAuthorizationStatus',
                practiceId: practiceContext.practiceId
            };

            const updateData = {
                status: newStatus,
                lastUpdated: new Date(),
                updatedBy: practiceContext.userId
            };

            // Add status-specific fields
            if (newStatus === this.authStatuses.APPROVED) {
                updateData.approvalDate = new Date();
                updateData.authNumber = authNumber;
                updateData.expirationDate = expirationDate ? new Date(expirationDate) : null;
            } else if (newStatus === this.authStatuses.DENIED) {
                updateData.denialDate = new Date();
                updateData.denialReason = notes;
            }

            if (attachments && attachments.length > 0) {
                updateData.responseDocuments = attachments;
            }

            // Update authorization
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.update('prior_authorizations',
                { authRequestId },
                updateData,
                context
            );

            // Add to status history
            await this.addStatusHistory(authRequestId, newStatus, {
                authNumber,
                expirationDate,
                notes,
                attachments
            }, practiceContext);

            // Handle status-specific actions
            await this.handleStatusUpdate(authRequestId, newStatus, updateData, practiceContext);

            return {
                success: true,
                status: newStatus,
                message: `Authorization status updated to ${newStatus}`
            };

        } catch (error) {
            console.error(`Error updating authorization status:`, error);
            throw new Error(`Failed to update authorization status: ${error.message}`);
        }
    }

    /**
     * Check authorization status with insurance provider
     */
    async checkAuthorizationStatus(authRequestId, practiceContext) {
        await this.initialize();

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'checkAuthorizationStatus',
                practiceId: practiceContext.practiceId
            };

            // Get authorization request
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const authRequests = await SecureDataAccess.query('prior_authorizations',
                { authRequestId },
                {},
                context
            );

            if (!authRequests || authRequests.length === 0) {
                throw new Error('Authorization request not found');
            }

            const authRequest = authRequests[0];

            // Check with insurance provider
            const statusCheck = await this.checkWithInsuranceProvider(authRequest, practiceContext);

            // Update if status changed
            if (statusCheck.status !== authRequest.status) {
                await this.updateAuthorizationStatus({
                    authRequestId,
                    newStatus: statusCheck.status,
                    authNumber: statusCheck.authNumber,
                    expirationDate: statusCheck.expirationDate,
                    notes: statusCheck.notes
                }, practiceContext);
            }

            return {
                success: true,
                currentStatus: statusCheck.status,
                lastChecked: new Date(),
                statusChanged: statusCheck.status !== authRequest.status,
                authNumber: statusCheck.authNumber,
                expirationDate: statusCheck.expirationDate
            };

        } catch (error) {
            console.error(`Error checking authorization status:`, error);
            throw new Error(`Failed to check authorization status: ${error.message}`);
        }
    }

    /**
     * Get authorizations expiring soon
     */
    async getExpiringAuthorizations(practiceContext, daysAhead = 30) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getExpiringAuthorizations',
            practiceId: practiceContext.practiceId
        };

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const expiringAuths = await SecureDataAccess.query('prior_authorizations',
                {
                    status: this.authStatuses.APPROVED,
                    expirationDate: {
                        $gte: new Date(),
                        $lte: cutoffDate
                    }
                },
                { sort: { expirationDate: 1 } },
                context
            );

            // Group by urgency
            const grouped = {
                critical: [], // Expiring in 7 days
                warning: [],  // Expiring in 14 days
                notice: []    // Expiring in 30 days
            };

            const now = new Date();
            expiringAuths.forEach(auth => {
                const daysUntilExpiration = Math.ceil((new Date(auth.expirationDate) - now) / (1000 * 60 * 60 * 24));
                
                if (daysUntilExpiration <= 7) {
                    grouped.critical.push({ ...auth, daysUntilExpiration });
                } else if (daysUntilExpiration <= 14) {
                    grouped.warning.push({ ...auth, daysUntilExpiration });
                } else {
                    grouped.notice.push({ ...auth, daysUntilExpiration });
                }
            });

            return {
                success: true,
                totalExpiring: expiringAuths.length,
                critical: grouped.critical.length,
                warning: grouped.warning.length,
                notice: grouped.notice.length,
                expiringAuthorizations: grouped
            };

        } catch (error) {
            console.error(`Error getting expiring authorizations:`, error);
            throw new Error(`Failed to get expiring authorizations: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    generateAuthRequestId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();
        return `AUTH-${timestamp}-${random}`;
    }

    async getPatientInsurance(patientId, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientInsurance',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const verifications = await SecureDataAccess.query('insurance_verifications',
            { 
                patientId, 
                verified: true,
                expiryDate: { $gt: new Date() }
            },
            { sort: { verificationDate: -1 }, limit: 1 },
            context
        );

        return verifications && verifications.length > 0 ? verifications[0] : null;
    }

    getEstimatedProcessingTime(urgencyLevel, serviceType) {
        const processingTimes = {
            [this.urgencyLevels.ROUTINE]: { min: 3, max: 14 },
            [this.urgencyLevels.URGENT]: { min: 1, max: 3 },
            [this.urgencyLevels.EMERGENT]: { min: 0, max: 1 }
        };

        const timeframe = processingTimes[urgencyLevel] || processingTimes[this.urgencyLevels.ROUTINE];
        
        return {
            minDays: timeframe.min,
            maxDays: timeframe.max,
            unit: 'business_days'
        };
    }

    validateSubmissionRequirements(authRequest) {
        const errors = [];

        // Required fields validation
        if (!authRequest.patientId) errors.push('Patient ID required');
        if (!authRequest.procedureCodes || authRequest.procedureCodes.length === 0) {
            errors.push('Procedure codes required');
        }
        if (!authRequest.diagnosisCodes || authRequest.diagnosisCodes.length === 0) {
            errors.push('Diagnosis codes required');
        }
        if (!authRequest.clinicalJustification) {
            errors.push('Clinical justification required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    async submitToInsuranceProvider(authRequest, practiceContext) {
        // Simulate submission to insurance provider
        // In production, this would integrate with actual insurance APIs
        return {
            success: true,
            externalAuthId: `EXT-AUTH-${Date.now()}`,
            reference: `REF-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
            submittedAt: new Date()
        };
    }

    async checkWithInsuranceProvider(authRequest, practiceContext) {
        // Simulate status checking with insurance provider
        // In production, this would query actual insurance APIs
        return {
            status: authRequest.status,
            authNumber: authRequest.authNumber,
            expirationDate: authRequest.expirationDate,
            lastUpdated: new Date()
        };
    }

    calculateEstimatedDecisionDate(urgencyLevel) {
        const businessDaysToAdd = {
            [this.urgencyLevels.ROUTINE]: 7,
            [this.urgencyLevels.URGENT]: 2,
            [this.urgencyLevels.EMERGENT]: 1
        };

        const daysToAdd = businessDaysToAdd[urgencyLevel] || 7;
        const decisionDate = new Date();
        decisionDate.setDate(decisionDate.getDate() + daysToAdd);
        
        return decisionDate;
    }

    async addStatusHistory(authRequestId, status, details, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'addStatusHistory',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.create('auth_status_history', {
            authRequestId,
            status,
            timestamp: new Date(),
            updatedBy: practiceContext.userId,
            details,
            practiceId: practiceContext.practiceId
        }, context);
    }

    async scheduleFollowUpCheck(authRequestId, urgencyLevel, practiceContext) {
        // Schedule automated follow-up based on urgency
        const followUpDays = {
            [this.urgencyLevels.ROUTINE]: 7,
            [this.urgencyLevels.URGENT]: 2,
            [this.urgencyLevels.EMERGENT]: 1
        };

        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + (followUpDays[urgencyLevel] || 7));

        console.log(`Scheduled follow-up check for ${authRequestId} on ${followUpDate}`);
    }

    async handleStatusUpdate(authRequestId, newStatus, updateData, practiceContext) {
        // Handle status-specific actions
        if (newStatus === this.authStatuses.APPROVED) {
            await this.handleApproval(authRequestId, updateData, practiceContext);
        } else if (newStatus === this.authStatuses.DENIED) {
            await this.handleDenial(authRequestId, updateData, practiceContext);
        } else if (newStatus === this.authStatuses.ADDITIONAL_INFO_REQUESTED) {
            await this.handleInfoRequest(authRequestId, updateData, practiceContext);
        }
    }

    async handleApproval(authRequestId, updateData, practiceContext) {
        // Send approval notification
        console.log(`Authorization ${authRequestId} approved with auth number ${updateData.authNumber}`);
        
        // Schedule expiration reminder if applicable
        if (updateData.expirationDate) {
            console.log(`Scheduling expiration reminder for ${authRequestId}`);
        }
    }

    async handleDenial(authRequestId, updateData, practiceContext) {
        // Send denial notification
        console.log(`Authorization ${authRequestId} denied: ${updateData.denialReason}`);
    }

    async handleInfoRequest(authRequestId, updateData, practiceContext) {
        // Send additional information request notification
        console.log(`Additional information requested for authorization ${authRequestId}`);
    }

    /**
     * Validation methods
     */
    validateAuthRequest(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.serviceType || !Object.values(this.authTypes).includes(data.serviceType)) {
            errors.push('Valid service type is required');
        } else {
            processedData.serviceType = data.serviceType;
        }

        if (!data.procedureCodes || (Array.isArray(data.procedureCodes) && data.procedureCodes.length === 0)) {
            errors.push('At least one procedure code is required');
        } else {
            processedData.procedureCodes = data.procedureCodes;
        }

        if (!data.diagnosisCodes || (Array.isArray(data.diagnosisCodes) && data.diagnosisCodes.length === 0)) {
            errors.push('At least one diagnosis code is required');
        } else {
            processedData.diagnosisCodes = data.diagnosisCodes;
        }

        if (!data.requestedService) {
            errors.push('Requested service description is required');
        } else {
            processedData.requestedService = data.requestedService;
        }

        if (!data.requestedStartDate) {
            errors.push('Requested start date is required');
        } else {
            processedData.requestedStartDate = data.requestedStartDate;
        }

        processedData.urgencyLevel = data.urgencyLevel || this.urgencyLevels.ROUTINE;
        processedData.clinicalJustification = data.clinicalJustification || '';
        processedData.supportingDocuments = data.supportingDocuments || [];

        return { success: errors.length === 0, errors, processedData };
    }

    async auditAuthAction(action, details) {
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

// Create instance
const priorAuthorization = new PriorAuthorization();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('priorAuthorizationService', () => priorAuthorization);
}

module.exports = priorAuthorization;