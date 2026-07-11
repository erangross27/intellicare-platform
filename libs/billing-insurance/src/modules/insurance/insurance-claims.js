/**
 * Insurance Claims Module
 * 
 * Handles insurance claim submission, processing, and tracking for healthcare services
 * across multiple insurance providers and healthcare systems.
 * 
 * Features:
 * - Claim creation and submission
 * - Real-time claim status tracking
 * - Automated claim validation
 * - Rejection handling and resubmission
 * - Multi-payer claim processing (Israeli healthcare, private insurance)
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class InsuranceClaims {
    constructor() {
        this.serviceName = 'InsuranceClaims';
        this.serviceToken = null;
        this.initialized = false;
        this.claimStatuses = {
            PENDING: 'pending',
            SUBMITTED: 'submitted',
            IN_REVIEW: 'in_review',
            APPROVED: 'approved',
            PARTIALLY_APPROVED: 'partially_approved',
            REJECTED: 'rejected',
            RESUBMITTED: 'resubmitted',
            PAID: 'paid'
        };
        this.rejectionReasons = {
            INVALID_POLICY: 'invalid_policy',
            SERVICE_NOT_COVERED: 'service_not_covered',
            MISSING_DOCUMENTATION: 'missing_documentation',
            DUPLICATE_CLAIM: 'duplicate_claim',
            AUTHORIZATION_REQUIRED: 'authorization_required'
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
     * Submit insurance claim
     */
    async submitInsuranceClaim(params, practiceContext) {
        await this.initialize();

        const validation = this.validateClaimData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { 
            patientId, 
            serviceDate, 
            serviceType, 
            amount, 
            diagnosisCodes,
            insuranceProvider,
            policyNumber 
        } = validation.processedData;

        try {
            // Generate unique claim ID
            const claimId = this.generateClaimId();

            // Verify insurance is active
            const insuranceValid = await this.verifyInsuranceForClaim(
                patientId, 
                insuranceProvider, 
                practiceContext
            );

            if (!insuranceValid.verified) {
                throw new Error('Insurance verification failed - cannot submit claim');
            }

            // Create claim record
            const claimData = {
                claimId,
                patientId,
                serviceDate: new Date(serviceDate),
                serviceType,
                amount: parseFloat(amount),
                diagnosisCodes: Array.isArray(diagnosisCodes) ? diagnosisCodes : [],
                insuranceProvider,
                policyNumber,
                status: this.claimStatuses.PENDING,
                submittedBy: practiceContext.userId,
                submittedDate: new Date(),
                practiceId: practiceContext.practiceId,
                lastUpdated: new Date(),
                submissionAttempts: 1,
                attachments: params.attachments || [],
                claimAmount: parseFloat(amount),
                approvedAmount: null,
                paidAmount: null
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'submitInsuranceClaim',
                practiceId: practiceContext.practiceId
            };

            // Store claim in database
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const createdClaim = await SecureDataAccess.create('insurance_claims', claimData, context);

            // Submit to insurance provider
            const submissionResult = await this.submitToInsuranceProvider(claimData, practiceContext);

            // Update claim status
            await SecureDataAccess.update('insurance_claims',
                { claimId },
                {
                    status: submissionResult.success ? this.claimStatuses.SUBMITTED : this.claimStatuses.REJECTED,
                    externalClaimId: submissionResult.externalClaimId,
                    submissionResponse: submissionResult.response,
                    lastUpdated: new Date()
                },
                context
            );

            // Create status history
            await this.createClaimStatusHistory(claimId, this.claimStatuses.SUBMITTED, {
                submittedTo: insuranceProvider,
                externalId: submissionResult.externalClaimId
            }, practiceContext);

            // Audit trail
            await this.auditClaimAction('SUBMIT_CLAIM', {
                claimId,
                patientId,
                amount,
                insuranceProvider,
                success: submissionResult.success,
                userId: practiceContext.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                claimId,
                externalClaimId: submissionResult.externalClaimId,
                status: submissionResult.success ? this.claimStatuses.SUBMITTED : this.claimStatuses.REJECTED,
                message: practiceContext.language === 'he'
                    ? `התביעה הוגשה בהצלחה. מספר תביעה: ${claimId}`
                    : `Claim submitted successfully. Claim ID: ${claimId}`
            };

        } catch (error) {
            console.error(`Error submitting insurance claim:`, error);
            throw new Error(`Failed to submit insurance claim: ${error.message}`);
        }
    }

    /**
     * Get claim status
     */
    async getClaimStatus(claimId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getClaimStatus',
            practiceId: practiceContext.practiceId
        };

        try {
            // Get claim details
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const claims = await SecureDataAccess.query('insurance_claims',
                { claimId },
                {},
                context
            );

            if (!claims || claims.length === 0) {
                throw new Error('Claim not found');
            }

            const claim = claims[0];

            // Get status history
            const statusHistory = await SecureDataAccess.query('claim_status_history',
                { claimId },
                { sort: { timestamp: -1 } },
                context
            );

            // Check for updates from insurance provider
            const updatedStatus = await this.checkClaimStatusWithProvider(claim, practiceContext);
            
            if (updatedStatus && updatedStatus.status !== claim.status) {
                await this.updateClaimStatus(claimId, updatedStatus, practiceContext);
            }

            return {
                success: true,
                claim: {
                    claimId: claim.claimId,
                    patientId: claim.patientId,
                    amount: claim.amount,
                    status: updatedStatus?.status || claim.status,
                    submittedDate: claim.submittedDate,
                    lastUpdated: claim.lastUpdated,
                    approvedAmount: claim.approvedAmount,
                    paidAmount: claim.paidAmount,
                    insuranceProvider: claim.insuranceProvider
                },
                statusHistory
            };

        } catch (error) {
            console.error(`Error getting claim status:`, error);
            throw new Error(`Failed to get claim status: ${error.message}`);
        }
    }

    /**
     * Process claim rejection and prepare for resubmission
     */
    async processClaimRejection(claimId, rejectionData, practiceContext) {
        await this.initialize();

        const { rejectionReason, rejectionNotes, correctionPlan } = rejectionData;

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'processClaimRejection',
                practiceId: practiceContext.practiceId
            };

            // Update claim with rejection details
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.update('insurance_claims',
                { claimId },
                {
                    status: this.claimStatuses.REJECTED,
                    rejectionReason,
                    rejectionNotes,
                    correctionPlan,
                    lastUpdated: new Date()
                },
                context
            );

            // Create rejection record
            await SecureDataAccess.create('claim_rejections', {
                claimId,
                rejectionReason,
                rejectionNotes,
                correctionPlan,
                processedBy: practiceContext.userId,
                processedAt: new Date(),
                practiceId: practiceContext.practiceId
            }, context);

            // Create status history
            await this.createClaimStatusHistory(claimId, this.claimStatuses.REJECTED, {
                rejectionReason,
                rejectionNotes
            }, practiceContext);

            // Generate resubmission tasks if correction plan exists
            if (correctionPlan && correctionPlan.length > 0) {
                await this.createResubmissionTasks(claimId, correctionPlan, practiceContext);
            }

            return {
                success: true,
                message: 'Claim rejection processed successfully',
                requiresResubmission: correctionPlan && correctionPlan.length > 0
            };

        } catch (error) {
            console.error(`Error processing claim rejection:`, error);
            throw new Error(`Failed to process claim rejection: ${error.message}`);
        }
    }

    /**
     * Resubmit corrected claim
     */
    async resubmitClaim(claimId, corrections, practiceContext) {
        await this.initialize();

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'resubmitClaim',
                practiceId: practiceContext.practiceId
            };

            // Get original claim
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const claims = await SecureDataAccess.query('insurance_claims', { claimId }, {}, context);
            if (!claims || claims.length === 0) {
                throw new Error('Original claim not found');
            }

            const originalClaim = claims[0];

            // Apply corrections
            const correctedClaimData = {
                ...originalClaim,
                ...corrections,
                status: this.claimStatuses.RESUBMITTED,
                resubmissionDate: new Date(),
                lastUpdated: new Date(),
                submissionAttempts: originalClaim.submissionAttempts + 1,
                resubmittedBy: practiceContext.userId
            };

            // Submit corrected claim
            const submissionResult = await this.submitToInsuranceProvider(correctedClaimData, practiceContext);

            // Update claim record
            await SecureDataAccess.update('insurance_claims',
                { claimId },
                {
                    status: submissionResult.success ? this.claimStatuses.SUBMITTED : this.claimStatuses.REJECTED,
                    resubmissionDate: new Date(),
                    submissionAttempts: originalClaim.submissionAttempts + 1,
                    lastUpdated: new Date(),
                    externalClaimId: submissionResult.externalClaimId
                },
                context
            );

            // Create status history
            await this.createClaimStatusHistory(claimId, this.claimStatuses.RESUBMITTED, {
                corrections,
                submissionAttempt: originalClaim.submissionAttempts + 1
            }, practiceContext);

            return {
                success: true,
                message: 'Claim resubmitted successfully',
                externalClaimId: submissionResult.externalClaimId,
                submissionAttempts: originalClaim.submissionAttempts + 1
            };

        } catch (error) {
            console.error(`Error resubmitting claim:`, error);
            throw new Error(`Failed to resubmit claim: ${error.message}`);
        }
    }

    /**
     * Get claims for patient
     */
    async getPatientClaims(patientId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientClaims',
            practiceId: practiceContext.practiceId
        };

        try {
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const claims = await SecureDataAccess.query('insurance_claims',
                { patientId },
                { sort: { submittedDate: -1 } },
                context
            );

            return {
                success: true,
                claims,
                totalClaims: claims.length,
                totalAmount: claims.reduce((sum, claim) => sum + (claim.amount || 0), 0),
                paidAmount: claims.reduce((sum, claim) => sum + (claim.paidAmount || 0), 0)
            };

        } catch (error) {
            console.error(`Error getting patient claims:`, error);
            throw new Error(`Failed to get patient claims: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    generateClaimId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();
        return `CLM-${timestamp}-${random}`;
    }

    async verifyInsuranceForClaim(patientId, insuranceProvider, practiceContext) {
        // Simulate insurance verification
        return { verified: true, coverage: 80 };
    }

    async submitToInsuranceProvider(claimData, practiceContext) {
        // Simulate submission to insurance provider
        return {
            success: true,
            externalClaimId: `EXT-${Date.now()}`,
            response: 'Claim submitted successfully to provider'
        };
    }

    async checkClaimStatusWithProvider(claim, practiceContext) {
        // Simulate checking status with provider
        return null; // No status change
    }

    async updateClaimStatus(claimId, statusUpdate, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'updateClaimStatus',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.update('insurance_claims',
            { claimId },
            {
                status: statusUpdate.status,
                approvedAmount: statusUpdate.approvedAmount,
                paidAmount: statusUpdate.paidAmount,
                lastUpdated: new Date()
            },
            context
        );
    }

    async createClaimStatusHistory(claimId, status, details, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'createClaimStatusHistory',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.create('claim_status_history', {
            claimId,
            status,
            details,
            timestamp: new Date(),
            updatedBy: practiceContext.userId,
            practiceId: practiceContext.practiceId
        }, context);
    }

    async createResubmissionTasks(claimId, correctionPlan, practiceContext) {
        // Create tasks for claim corrections
        console.log(`Creating resubmission tasks for claim ${claimId}:`, correctionPlan);
    }

    /**
     * Validation methods
     */
    validateClaimData(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.serviceDate) {
            errors.push('Service date is required');
        } else {
            processedData.serviceDate = data.serviceDate;
        }

        if (!data.serviceType) {
            errors.push('Service type is required');
        } else {
            processedData.serviceType = data.serviceType;
        }

        if (!data.amount || isNaN(parseFloat(data.amount))) {
            errors.push('Valid amount is required');
        } else {
            processedData.amount = parseFloat(data.amount);
        }

        processedData.diagnosisCodes = data.diagnosisCodes || [];
        processedData.insuranceProvider = data.insuranceProvider;
        processedData.policyNumber = data.policyNumber;

        return { success: errors.length === 0, errors, processedData };
    }

    async auditClaimAction(action, details) {
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
const insuranceClaims = new InsuranceClaims();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('insuranceClaimsService', () => insuranceClaims);
}

module.exports = insuranceClaims;