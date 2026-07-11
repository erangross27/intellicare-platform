/**
 * Payment Processing Module
 * 
 * Handles payment processing, recording, and reconciliation for healthcare services
 * with support for multiple payment methods and currencies.
 * 
 * Features:
 * - Multi-method payment processing (cash, credit card, bank transfer, insurance)
 * - Payment recording and tracking
 * - Partial payment handling
 * - Payment reconciliation
 * - Refund processing
 * - Multi-currency support
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class PaymentProcessing {
    constructor() {
        this.serviceName = 'PaymentProcessing';
        this.serviceToken = null;
        this.initialized = false;
        this.paymentMethods = {
            CASH: 'cash',
            CREDIT_CARD: 'credit_card',
            DEBIT_CARD: 'debit_card',
            BANK_TRANSFER: 'bank_transfer',
            CHECK: 'check',
            INSURANCE: 'insurance',
            DIGITAL_WALLET: 'digital_wallet',
            CRYPTOCURRENCY: 'cryptocurrency'
        };
        this.paymentStatuses = {
            PENDING: 'pending',
            PROCESSING: 'processing',
            COMPLETED: 'completed',
            FAILED: 'failed',
            CANCELLED: 'cancelled',
            REFUNDED: 'refunded',
            PARTIALLY_REFUNDED: 'partially_refunded'
        };
        this.currencies = {
            ILS: 'ils',
            USD: 'usd',
            EUR: 'eur'
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
     * Process payment
     */
    async processPayment(params, practiceContext) {
        await this.initialize();

        const validation = this.validatePaymentData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { 
            invoiceId, 
            amount, 
            paymentMethod, 
            currency,
            paymentDetails,
            reference 
        } = validation.processedData;

        try {
            // Get invoice details
            const invoice = await this.getInvoiceDetails(invoiceId, practiceContext);
            if (!invoice) {
                throw new Error('Invoice not found');
            }

            // Validate payment amount
            if (amount > invoice.remainingAmount) {
                throw new Error('Payment amount exceeds remaining invoice balance');
            }

            // Generate payment ID
            const paymentId = this.generatePaymentId();

            // Create payment record
            const paymentData = {
                paymentId,
                invoiceId,
                patientId: invoice.patientId,
                amount: parseFloat(amount),
                currency: currency || invoice.currency,
                paymentMethod,
                paymentDetails: this.sanitizePaymentDetails(paymentDetails),
                reference: reference || `PAY-${Date.now()}`,
                status: this.paymentStatuses.PENDING,
                paymentDate: new Date(),
                processedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId,
                exchangeRate: await this.getExchangeRate(currency, invoice.currency),
                originalAmount: parseFloat(amount),
                convertedAmount: null
            };

            // Calculate converted amount if currencies differ
            if (currency !== invoice.currency) {
                paymentData.convertedAmount = paymentData.amount * paymentData.exchangeRate;
            } else {
                paymentData.convertedAmount = paymentData.amount;
            }

            const context = {
                serviceId: this.serviceName,
                operation: 'processPayment',
                practiceId: practiceContext.practiceId
            };

            // Store payment record
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const createdPayment = await SecureDataAccess.create('payments', paymentData, context);

            // Process payment based on method
            let processingResult;
            try {
                processingResult = await this.executePayment(paymentData, practiceContext);
            } catch (processingError) {
                // Update payment status to failed
                await this.updatePaymentStatus(paymentId, this.paymentStatuses.FAILED, {
                    error: processingError.message
                }, practiceContext);
                throw processingError;
            }

            // Update payment status
            const finalStatus = processingResult.success ? 
                this.paymentStatuses.COMPLETED : 
                this.paymentStatuses.FAILED;

            await this.updatePaymentStatus(paymentId, finalStatus, {
                transactionId: processingResult.transactionId,
                processorResponse: processingResult.response
            }, practiceContext);

            // Update invoice if payment successful
            if (processingResult.success) {
                await this.updateInvoiceBalance(invoiceId, paymentData.convertedAmount, practiceContext);
            }

            // Audit trail
            await this.auditPaymentAction('PROCESS_PAYMENT', {
                paymentId,
                invoiceId,
                amount: paymentData.convertedAmount,
                paymentMethod,
                success: processingResult.success,
                userId: practiceContext.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: processingResult.success,
                paymentId,
                transactionId: processingResult.transactionId,
                status: finalStatus,
                amount: paymentData.convertedAmount,
                message: processingResult.success 
                    ? (practiceContext.language === 'he' ? 'התשלום עובד בהצלחה' : 'Payment processed successfully')
                    : (practiceContext.language === 'he' ? 'התשלום נכשל' : 'Payment failed')
            };

        } catch (error) {
            console.error(`Error processing payment:`, error);
            throw new Error(`Failed to process payment: ${error.message}`);
        }
    }

    /**
     * Record manual payment
     */
    async recordPayment(params, practiceContext) {
        await this.initialize();

        const validation = this.validatePaymentData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { invoiceId, amount, paymentMethod, reference, paymentDate } = validation.processedData;

        try {
            const paymentId = this.generatePaymentId();

            // Get invoice details
            const invoice = await this.getInvoiceDetails(invoiceId, practiceContext);
            if (!invoice) {
                throw new Error('Invoice not found');
            }

            const paymentData = {
                paymentId,
                invoiceId,
                patientId: invoice.patientId,
                amount: parseFloat(amount),
                currency: invoice.currency,
                paymentMethod,
                reference: reference || `MANUAL-${Date.now()}`,
                status: this.paymentStatuses.COMPLETED,
                paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
                recordedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId,
                manualEntry: true,
                convertedAmount: parseFloat(amount)
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'recordPayment',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.create('payments', paymentData, context);

            // Update invoice balance
            await this.updateInvoiceBalance(invoiceId, paymentData.amount, practiceContext);

            return {
                success: true,
                paymentId,
                message: 'Payment recorded successfully'
            };

        } catch (error) {
            console.error(`Error recording payment:`, error);
            throw new Error(`Failed to record payment: ${error.message}`);
        }
    }

    /**
     * Process refund
     */
    async processRefund(params, practiceContext) {
        await this.initialize();

        const { paymentId, refundAmount, reason } = params;

        if (!paymentId || !refundAmount || isNaN(parseFloat(refundAmount))) {
            throw new Error('Payment ID and valid refund amount are required');
        }

        try {
            // Get original payment
            const payment = await this.getPaymentDetails(paymentId, practiceContext);
            if (!payment) {
                throw new Error('Payment not found');
            }

            if (payment.status !== this.paymentStatuses.COMPLETED) {
                throw new Error('Can only refund completed payments');
            }

            const refundAmountNum = parseFloat(refundAmount);
            const currentRefunded = payment.refundedAmount || 0;
            const maxRefund = payment.amount - currentRefunded;

            if (refundAmountNum > maxRefund) {
                throw new Error('Refund amount exceeds available refund balance');
            }

            const refundId = this.generateRefundId();

            // Create refund record
            const refundData = {
                refundId,
                paymentId,
                invoiceId: payment.invoiceId,
                patientId: payment.patientId,
                refundAmount: refundAmountNum,
                currency: payment.currency,
                reason,
                status: this.paymentStatuses.PROCESSING,
                refundDate: new Date(),
                processedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'processRefund',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.create('refunds', refundData, context);

            // Execute refund based on original payment method
            const refundResult = await this.executeRefund(payment, refundAmountNum, practiceContext);

            // Update refund status
            const finalStatus = refundResult.success ? 
                this.paymentStatuses.REFUNDED : 
                this.paymentStatuses.FAILED;

            await SecureDataAccess.update('refunds',
                { refundId },
                {
                    status: finalStatus,
                    transactionId: refundResult.transactionId,
                    processorResponse: refundResult.response
                },
                context
            );

            // Update payment refund amount
            if (refundResult.success) {
                const newRefundedAmount = currentRefunded + refundAmountNum;
                const paymentStatus = newRefundedAmount >= payment.amount ? 
                    this.paymentStatuses.REFUNDED : 
                    this.paymentStatuses.PARTIALLY_REFUNDED;

                await SecureDataAccess.update('payments',
                    { paymentId },
                    {
                        refundedAmount: newRefundedAmount,
                        status: paymentStatus,
                        lastUpdated: new Date()
                    },
                    context
                );

                // Update invoice balance
                await this.updateInvoiceBalance(payment.invoiceId, -refundAmountNum, practiceContext);
            }

            return {
                success: refundResult.success,
                refundId,
                transactionId: refundResult.transactionId,
                message: refundResult.success ? 'Refund processed successfully' : 'Refund failed'
            };

        } catch (error) {
            console.error(`Error processing refund:`, error);
            throw new Error(`Failed to process refund: ${error.message}`);
        }
    }

    /**
     * Get payment history for patient
     */
    async getPaymentHistory(patientId, practiceContext, filters = {}) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getPaymentHistory',
            practiceId: practiceContext.practiceId
        };

        try {
            const query = { patientId };

            // Apply filters
            if (filters.fromDate) {
                query.paymentDate = { $gte: new Date(filters.fromDate) };
            }
            if (filters.toDate) {
                query.paymentDate = { ...query.paymentDate, $lte: new Date(filters.toDate) };
            }
            if (filters.paymentMethod) {
                query.paymentMethod = filters.paymentMethod;
            }
            if (filters.status) {
                query.status = filters.status;
            }

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const payments = await SecureDataAccess.query('payments',
                query,
                { sort: { paymentDate: -1 } },
                context
            );

            const summary = {
                totalPayments: payments.length,
                totalAmount: payments
                    .filter(p => p.status === this.paymentStatuses.COMPLETED)
                    .reduce((sum, p) => sum + p.amount, 0),
                refundedAmount: payments.reduce((sum, p) => sum + (p.refundedAmount || 0), 0),
                methodBreakdown: this.calculateMethodBreakdown(payments)
            };

            return {
                success: true,
                payments,
                summary
            };

        } catch (error) {
            console.error(`Error getting payment history:`, error);
            throw new Error(`Failed to get payment history: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    generatePaymentId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();
        return `PAY-${timestamp}-${random}`;
    }

    generateRefundId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();
        return `REF-${timestamp}-${random}`;
    }

    async getInvoiceDetails(invoiceId, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getInvoiceDetails',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const invoices = await SecureDataAccess.query('invoices', { _id: invoiceId }, {}, context);
        return invoices && invoices.length > 0 ? invoices[0] : null;
    }

    async getPaymentDetails(paymentId, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getPaymentDetails',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const payments = await SecureDataAccess.query('payments', { paymentId }, {}, context);
        return payments && payments.length > 0 ? payments[0] : null;
    }

    sanitizePaymentDetails(details) {
        if (!details) return {};
        
        // Remove sensitive information
        const sanitized = { ...details };
        if (sanitized.cardNumber) {
            sanitized.cardNumber = `****${sanitized.cardNumber.slice(-4)}`;
        }
        if (sanitized.cvv) {
            delete sanitized.cvv;
        }
        return sanitized;
    }

    async getExchangeRate(fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return 1.0;
        
        // In production, get real exchange rates from currency API
        const rates = {
            'usd_ils': 3.8,
            'eur_ils': 4.2,
            'ils_usd': 0.26,
            'ils_eur': 0.24
        };
        
        return rates[`${fromCurrency}_${toCurrency}`] || 1.0;
    }

    async executePayment(paymentData, practiceContext) {
        // Simulate payment processing
        // In production, integrate with actual payment processors
        switch (paymentData.paymentMethod) {
            case this.paymentMethods.CREDIT_CARD:
            case this.paymentMethods.DEBIT_CARD:
                return {
                    success: true,
                    transactionId: `TXN-${Date.now()}`,
                    response: 'Payment approved'
                };
            case this.paymentMethods.CASH:
                return {
                    success: true,
                    transactionId: `CASH-${Date.now()}`,
                    response: 'Cash payment recorded'
                };
            default:
                return {
                    success: true,
                    transactionId: `OTHER-${Date.now()}`,
                    response: 'Payment processed'
                };
        }
    }

    async executeRefund(payment, refundAmount, practiceContext) {
        // Simulate refund processing
        return {
            success: true,
            transactionId: `REFUND-${Date.now()}`,
            response: 'Refund processed successfully'
        };
    }

    async updatePaymentStatus(paymentId, status, details, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'updatePaymentStatus',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.update('payments',
            { paymentId },
            {
                status,
                ...details,
                lastUpdated: new Date()
            },
            context
        );
    }

    async updateInvoiceBalance(invoiceId, paymentAmount, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'updateInvoiceBalance',
            practiceId: practiceContext.practiceId
        };

        // Get current invoice
        const invoice = await this.getInvoiceDetails(invoiceId, practiceContext);
        if (!invoice) return;

        const newPaidAmount = invoice.paidAmount + paymentAmount;
        const newRemainingAmount = invoice.totalAmount - newPaidAmount;
        
        let newStatus = 'sent';
        if (newRemainingAmount <= 0) {
            newStatus = 'paid';
        } else if (newPaidAmount > 0) {
            newStatus = 'partially_paid';
        }

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.update('invoices',
            { _id: invoiceId },
            {
                paidAmount: newPaidAmount,
                remainingAmount: Math.max(0, newRemainingAmount),
                status: newStatus,
                lastUpdated: new Date()
            },
            context
        );
    }

    calculateMethodBreakdown(payments) {
        const breakdown = {};
        
        for (const payment of payments) {
            if (payment.status === this.paymentStatuses.COMPLETED) {
                if (!breakdown[payment.paymentMethod]) {
                    breakdown[payment.paymentMethod] = {
                        count: 0,
                        amount: 0
                    };
                }
                breakdown[payment.paymentMethod].count++;
                breakdown[payment.paymentMethod].amount += payment.amount;
            }
        }
        
        return breakdown;
    }

    /**
     * Validation methods
     */
    validatePaymentData(data) {
        const errors = [];
        const processedData = {};

        if (!data.invoiceId) {
            errors.push('Invoice ID is required');
        } else {
            processedData.invoiceId = data.invoiceId;
        }

        if (!data.amount || isNaN(parseFloat(data.amount))) {
            errors.push('Valid payment amount is required');
        } else if (parseFloat(data.amount) <= 0) {
            errors.push('Payment amount must be greater than zero');
        } else {
            processedData.amount = parseFloat(data.amount);
        }

        if (!data.paymentMethod || !Object.values(this.paymentMethods).includes(data.paymentMethod)) {
            errors.push('Valid payment method is required');
        } else {
            processedData.paymentMethod = data.paymentMethod;
        }

        processedData.currency = data.currency;
        processedData.paymentDetails = data.paymentDetails;
        processedData.reference = data.reference;
        processedData.paymentDate = data.paymentDate;

        return { success: errors.length === 0, errors, processedData };
    }

    async auditPaymentAction(action, details) {
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
const paymentProcessing = new PaymentProcessing();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('paymentProcessingService', () => paymentProcessing);
}

module.exports = paymentProcessing;