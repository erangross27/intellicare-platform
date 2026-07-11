/**
 * Refund Processing Module
 * Migrated to DDD NX architecture - Billing Insurance Context
 * 
 * Handles comprehensive refund processing, tracking, and management
 * for healthcare payment operations.
 * 
 * Features:
 * - Refund request creation and approval workflow
 * - Multi-method refund processing (credit card, ACH, check)
 * - Partial and full refund handling
 * - Refund tracking and status management
 * - Automated refund reconciliation
 * - Compliance and audit trail
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class RefundProcessing {
    constructor() {
        this.serviceName = 'RefundProcessing';
        this.serviceToken = null;
        this.initialized = false;
        this.refundStatuses = {
            PENDING_APPROVAL: 'pending_approval',
            APPROVED: 'approved',
            PROCESSING: 'processing',
            COMPLETED: 'completed',
            FAILED: 'failed',
            CANCELLED: 'cancelled'
        };
        this.refundMethods = {
            ORIGINAL_PAYMENT: 'original_payment',
            CREDIT_CARD: 'credit_card',
            ACH: 'ach',
            CHECK: 'check',
            CASH: 'cash'
        };
        this.refundTypes = {
            OVERPAYMENT: 'overpayment',
            CANCELLED_SERVICE: 'cancelled_service',
            INSURANCE_ADJUSTMENT: 'insurance_adjustment',
            BILLING_ERROR: 'billing_error',
            PATIENT_REQUEST: 'patient_request',
            DUPLICATE_PAYMENT: 'duplicate_payment'
        };
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            const proxy = getServiceProxy();
            const serviceAccountManager = proxy.getService('serviceAccountManager');
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceName);
            this.initialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize RefundProcessing:', error);
            throw error;
        }
    }

    /**
     * Create refund request
     */
    async createRefundRequest(params, practiceContext) {
        await this.initialize();

        const validation = this.validateRefundRequest(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { 
            patientId, 
            originalPaymentId, 
            refundAmount, 
            refundType, 
            reason,
            refundMethod,
            requiresApproval 
        } = validation.processedData;

        try {
            // Get original payment details
            const originalPayment = await this.getPaymentDetails(originalPaymentId, practiceContext);
            if (!originalPayment) {
                throw new Error('Original payment not found');
            }

            // Validate refund amount
            const maxRefundable = this.calculateMaxRefundable(originalPayment);
            if (refundAmount > maxRefundable) {
                throw new Error(`Refund amount exceeds maximum refundable amount of ${maxRefundable}`);
            }

            // Generate refund request ID
            const refundRequestId = this.generateRefundRequestId();

            // Create refund request
            const refundRequest = {
                refundRequestId,
                patientId,
                originalPaymentId,
                originalAmount: originalPayment.amount,
                refundAmount: parseFloat(refundAmount),
                refundType,
                reason,
                refundMethod: refundMethod || this.refundMethods.ORIGINAL_PAYMENT,
                status: requiresApproval ? this.refundStatuses.PENDING_APPROVAL : this.refundStatuses.APPROVED,
                requiresApproval,
                requestDate: new Date(),
                requestedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId,
                originalPaymentMethod: originalPayment.paymentMethod,
                originalPaymentDate: originalPayment.paymentDate,
                statusHistory: [{
                    status: requiresApproval ? this.refundStatuses.PENDING_APPROVAL : this.refundStatuses.APPROVED,
                    timestamp: new Date(),
                    updatedBy: practiceContext.userId,
                    notes: 'Refund request created'
                }]
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'createRefundRequest',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.create('refund_requests', refundRequest, context);

            // If auto-approval, process immediately
            if (!requiresApproval) {
                await this.processRefund(refundRequestId, practiceContext);
            }

            // Audit trail
            await this.auditRefundAction('CREATE_REFUND_REQUEST', {
                refundRequestId,
                patientId,
                refundAmount,
                refundType,
                requiresApproval,
                userId: practiceContext.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                refundRequestId,
                status: refundRequest.status,
                refundAmount: refundRequest.refundAmount,
                estimatedProcessingTime: this.getEstimatedProcessingTime(refundRequest.refundMethod),
                message: practiceContext.language === 'he' 
                    ? `בקשת החזר ${refundRequestId} נוצרה בהצלחה`
                    : `Refund request ${refundRequestId} created successfully`
            };

        } catch (error) {
            console.error(`Error creating refund request:`, error);
            throw new Error(`Failed to create refund request: ${error.message}`);
        }
    }

    /**
     * Approve refund request
     */
    async approveRefundRequest(params, practiceContext) {
        await this.initialize();

        const { refundRequestId, approvalNotes } = params;

        if (!refundRequestId) {
            throw new Error('Refund request ID is required');
        }

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'approveRefundRequest',
                practiceId: practiceContext.practiceId
            };

            // Get refund request
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const requests = await SecureDataAccess.query('refund_requests',
                { refundRequestId },
                {},
                context
            );

            if (!requests || requests.length === 0) {
                throw new Error('Refund request not found');
            }

            const refundRequest = requests[0];

            if (refundRequest.status !== this.refundStatuses.PENDING_APPROVAL) {
                throw new Error('Refund request is not pending approval');
            }

            // Update status to approved
            await SecureDataAccess.update('refund_requests',
                { refundRequestId },
                {
                    status: this.refundStatuses.APPROVED,
                    approvedDate: new Date(),
                    approvedBy: practiceContext.userId,
                    approvalNotes,
                    lastUpdated: new Date()
                },
                context
            );

            // Add to status history
            await this.addRefundStatusHistory(refundRequestId, this.refundStatuses.APPROVED, {
                approvedBy: practiceContext.userId,
                approvalNotes
            }, practiceContext);

            // Process the refund
            const processingResult = await this.processRefund(refundRequestId, practiceContext);

            return {
                success: true,
                refundRequestId,
                status: this.refundStatuses.APPROVED,
                processingResult,
                message: 'Refund request approved and processing initiated'
            };

        } catch (error) {
            console.error(`Error approving refund request:`, error);
            throw new Error(`Failed to approve refund request: ${error.message}`);
        }
    }

    /**
     * Process approved refund
     */
    async processRefund(refundRequestId, practiceContext) {
        await this.initialize();

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'processRefund',
                practiceId: practiceContext.practiceId
            };

            // Get refund request
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const requests = await SecureDataAccess.query('refund_requests',
                { refundRequestId },
                {},
                context
            );

            if (!requests || requests.length === 0) {
                throw new Error('Refund request not found');
            }

            const refundRequest = requests[0];

            if (refundRequest.status !== this.refundStatuses.APPROVED) {
                throw new Error('Refund request must be approved before processing');
            }

            // Update status to processing
            await SecureDataAccess.update('refund_requests',
                { refundRequestId },
                {
                    status: this.refundStatuses.PROCESSING,
                    processingStartDate: new Date(),
                    lastUpdated: new Date()
                },
                context
            );

            await this.addRefundStatusHistory(refundRequestId, this.refundStatuses.PROCESSING, {
                processingStarted: true
            }, practiceContext);

            // Execute refund based on method
            let processingResult;
            try {
                processingResult = await this.executeRefund(refundRequest, practiceContext);
            } catch (processingError) {
                // Mark as failed
                await this.handleRefundFailure(refundRequestId, processingError.message, practiceContext);
                throw processingError;
            }

            // Update to completed status
            await SecureDataAccess.update('refund_requests',
                { refundRequestId },
                {
                    status: this.refundStatuses.COMPLETED,
                    completedDate: new Date(),
                    transactionId: processingResult.transactionId,
                    processorResponse: processingResult.response,
                    lastUpdated: new Date()
                },
                context
            );

            await this.addRefundStatusHistory(refundRequestId, this.refundStatuses.COMPLETED, {
                transactionId: processingResult.transactionId,
                processingResult
            }, practiceContext);

            // Update original payment record
            await this.updateOriginalPaymentRefund(
                refundRequest.originalPaymentId, 
                refundRequest.refundAmount, 
                practiceContext
            );

            return {
                success: true,
                transactionId: processingResult.transactionId,
                completedDate: new Date(),
                message: 'Refund processed successfully'
            };

        } catch (error) {
            console.error(`Error processing refund:`, error);
            throw new Error(`Failed to process refund: ${error.message}`);
        }
    }

    /**
     * Get refund status and details
     */
    async getRefundStatus(refundRequestId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getRefundStatus',
            practiceId: practiceContext.practiceId
        };

        try {
            // Get refund request
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const requests = await SecureDataAccess.query('refund_requests',
                { refundRequestId },
                {},
                context
            );

            if (!requests || requests.length === 0) {
                throw new Error('Refund request not found');
            }

            const refundRequest = requests[0];

            // Get status history
            const statusHistory = await SecureDataAccess.query('refund_status_history',
                { refundRequestId },
                { sort: { timestamp: -1 } },
                context
            );

            return {
                success: true,
                refund: {
                    refundRequestId: refundRequest.refundRequestId,
                    patientId: refundRequest.patientId,
                    refundAmount: refundRequest.refundAmount,
                    refundType: refundRequest.refundType,
                    status: refundRequest.status,
                    requestDate: refundRequest.requestDate,
                    completedDate: refundRequest.completedDate,
                    transactionId: refundRequest.transactionId,
                    refundMethod: refundRequest.refundMethod
                },
                statusHistory
            };

        } catch (error) {
            console.error(`Error getting refund status:`, error);
            throw new Error(`Failed to get refund status: ${error.message}`);
        }
    }

    /**
     * Get patient refund history
     */
    async getPatientRefundHistory(patientId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientRefundHistory',
            practiceId: practiceContext.practiceId
        };

        try {
            const refunds = await SecureDataAccess.query('refund_requests',
                { patientId },
                { sort: { requestDate: -1 } },
                context
            );

            const summary = {
                totalRefunds: refunds.length,
                totalAmount: refunds
                    .filter(r => r.status === this.refundStatuses.COMPLETED)
                    .reduce((sum, r) => sum + r.refundAmount, 0),
                pendingRefunds: refunds.filter(r => 
                    [this.refundStatuses.PENDING_APPROVAL, this.refundStatuses.PROCESSING].includes(r.status)
                ).length,
                completedRefunds: refunds.filter(r => r.status === this.refundStatuses.COMPLETED).length,
                failedRefunds: refunds.filter(r => r.status === this.refundStatuses.FAILED).length
            };

            return {
                success: true,
                refunds,
                summary
            };

        } catch (error) {
            console.error(`Error getting patient refund history:`, error);
            throw new Error(`Failed to get patient refund history: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    generateRefundRequestId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();
        return `REF-${timestamp}-${random}`;
    }

    async getPaymentDetails(paymentId, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getPaymentDetails',
            practiceId: practiceContext.practiceId
        };

        const payments = await SecureDataAccess.query('payments', { paymentId }, {}, context);
        return payments && payments.length > 0 ? payments[0] : null;
    }

    calculateMaxRefundable(originalPayment) {
        // Calculate maximum refundable amount considering previous refunds
        const totalRefunded = originalPayment.refundedAmount || 0;
        return originalPayment.amount - totalRefunded;
    }

    getEstimatedProcessingTime(refundMethod) {
        const processingTimes = {
            [this.refundMethods.ORIGINAL_PAYMENT]: { min: 3, max: 5, unit: 'business_days' },
            [this.refundMethods.CREDIT_CARD]: { min: 3, max: 5, unit: 'business_days' },
            [this.refundMethods.ACH]: { min: 1, max: 3, unit: 'business_days' },
            [this.refundMethods.CHECK]: { min: 5, max: 10, unit: 'business_days' },
            [this.refundMethods.CASH]: { min: 0, max: 1, unit: 'business_days' }
        };

        return processingTimes[refundMethod] || processingTimes[this.refundMethods.ORIGINAL_PAYMENT];
    }

    async executeRefund(refundRequest, practiceContext) {
        // Execute refund based on method
        switch (refundRequest.refundMethod) {
            case this.refundMethods.CREDIT_CARD:
                return await this.processCreditCardRefund(refundRequest, practiceContext);
            case this.refundMethods.ACH:
                return await this.processACHRefund(refundRequest, practiceContext);
            case this.refundMethods.CHECK:
                return await this.processCheckRefund(refundRequest, practiceContext);
            case this.refundMethods.CASH:
                return await this.processCashRefund(refundRequest, practiceContext);
            default:
                return await this.processOriginalMethodRefund(refundRequest, practiceContext);
        }
    }

    async processCreditCardRefund(refundRequest, practiceContext) {
        // Simulate credit card refund processing
        return {
            success: true,
            transactionId: `CC-REF-${Date.now()}`,
            response: 'Credit card refund processed successfully',
            processingFee: refundRequest.refundAmount * 0.029 // 2.9% processing fee
        };
    }

    async processACHRefund(refundRequest, practiceContext) {
        // Simulate ACH refund processing
        return {
            success: true,
            transactionId: `ACH-REF-${Date.now()}`,
            response: 'ACH refund initiated successfully',
            processingFee: 1.50 // Flat ACH fee
        };
    }

    async processCheckRefund(refundRequest, practiceContext) {
        // Simulate check refund processing
        return {
            success: true,
            transactionId: `CHK-REF-${Date.now()}`,
            response: 'Check refund queued for printing and mailing',
            processingFee: 2.00 // Flat check processing fee
        };
    }

    async processCashRefund(refundRequest, practiceContext) {
        // Simulate cash refund processing
        return {
            success: true,
            transactionId: `CASH-REF-${Date.now()}`,
            response: 'Cash refund ready for pickup',
            processingFee: 0
        };
    }

    async processOriginalMethodRefund(refundRequest, practiceContext) {
        // Process refund using original payment method
        switch (refundRequest.originalPaymentMethod) {
            case 'credit_card':
            case 'debit_card':
                return await this.processCreditCardRefund(refundRequest, practiceContext);
            case 'ach':
            case 'bank_transfer':
                return await this.processACHRefund(refundRequest, practiceContext);
            case 'cash':
                return await this.processCashRefund(refundRequest, practiceContext);
            default:
                return await this.processCheckRefund(refundRequest, practiceContext);
        }
    }

    async handleRefundFailure(refundRequestId, errorMessage, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'handleRefundFailure',
            practiceId: practiceContext.practiceId
        };

        await SecureDataAccess.update('refund_requests',
            { refundRequestId },
            {
                status: this.refundStatuses.FAILED,
                failureDate: new Date(),
                failureReason: errorMessage,
                lastUpdated: new Date()
            },
            context
        );

        await this.addRefundStatusHistory(refundRequestId, this.refundStatuses.FAILED, {
            failureReason: errorMessage
        }, practiceContext);
    }

    async updateOriginalPaymentRefund(paymentId, refundAmount, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'updateOriginalPaymentRefund',
            practiceId: practiceContext.practiceId
        };

        // Get current payment details
        const payment = await this.getPaymentDetails(paymentId, practiceContext);
        if (payment) {
            const newRefundedAmount = (payment.refundedAmount || 0) + refundAmount;
            const newStatus = newRefundedAmount >= payment.amount ? 'refunded' : 'partially_refunded';

            await SecureDataAccess.update('payments',
                { paymentId },
                {
                    refundedAmount: newRefundedAmount,
                    status: newStatus,
                    lastUpdated: new Date()
                },
                context
            );
        }
    }

    async addRefundStatusHistory(refundRequestId, status, details, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'addRefundStatusHistory',
            practiceId: practiceContext.practiceId
        };

        await SecureDataAccess.create('refund_status_history', {
            refundRequestId,
            status,
            timestamp: new Date(),
            updatedBy: practiceContext.userId,
            details,
            practiceId: practiceContext.practiceId
        }, context);
    }

    /**
     * Validation methods
     */
    validateRefundRequest(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.originalPaymentId) {
            errors.push('Original payment ID is required');
        } else {
            processedData.originalPaymentId = data.originalPaymentId;
        }

        if (!data.refundAmount || isNaN(parseFloat(data.refundAmount))) {
            errors.push('Valid refund amount is required');
        } else if (parseFloat(data.refundAmount) <= 0) {
            errors.push('Refund amount must be greater than zero');
        } else {
            processedData.refundAmount = parseFloat(data.refundAmount);
        }

        if (!data.refundType || !Object.values(this.refundTypes).includes(data.refundType)) {
            errors.push('Valid refund type is required');
        } else {
            processedData.refundType = data.refundType;
        }

        if (!data.reason) {
            errors.push('Reason for refund is required');
        } else {
            processedData.reason = data.reason;
        }

        processedData.refundMethod = data.refundMethod || this.refundMethods.ORIGINAL_PAYMENT;
        processedData.requiresApproval = data.requiresApproval !== false; // Default to true

        return { success: errors.length === 0, errors, processedData };
    }

    async auditRefundAction(action, details) {
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

// Create singleton instance  
const refundProcessing = new RefundProcessing();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('refundProcessing', () => refundProcessing);
}

module.exports = refundProcessing;