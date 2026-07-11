/**
 * Invoice Management Module
 * 
 * Handles invoice creation, management, and processing for healthcare services
 * with multi-currency support and Israeli tax compliance.
 * 
 * Features:
 * - Invoice creation and generation
 * - Multi-currency support (ILS, USD, EUR)
 * - Israeli tax compliance (VAT handling)
 * - Automated invoice numbering
 * - Payment term management
 * - Invoice status tracking
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class InvoiceManagement {
    constructor() {
        this.serviceName = 'InvoiceManagement';
        this.serviceToken = null;
        this.initialized = false;
        this.invoiceStatuses = {
            DRAFT: 'draft',
            SENT: 'sent',
            VIEWED: 'viewed',
            PAID: 'paid',
            PARTIALLY_PAID: 'partially_paid',
            OVERDUE: 'overdue',
            CANCELLED: 'cancelled',
            REFUNDED: 'refunded'
        };
        this.currencies = {
            ILS: 'ils',
            USD: 'usd',
            EUR: 'eur'
        };
        this.paymentTerms = {
            IMMEDIATE: 0,
            NET_15: 15,
            NET_30: 30,
            NET_45: 45,
            NET_60: 60
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
     * Create new invoice
     */
    async createInvoice(params, practiceContext) {
        await this.initialize();

        const validation = this.validateInvoiceData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { 
            patientId, 
            items, 
            currency, 
            paymentTerms,
            dueDate,
            notes 
        } = validation.processedData;

        try {
            // Generate invoice number
            const invoiceNumber = await this.generateInvoiceNumber(practiceContext);

            // Calculate totals
            const calculations = this.calculateInvoiceTotals(items, currency, practiceContext);

            // Get patient details
            const patient = await this.getPatientDetails(patientId, practiceContext);
            if (!patient) {
                throw new Error('Patient not found');
            }

            // Create invoice record
            const invoiceData = {
                invoiceNumber,
                patientId,
                patientName: `${patient.firstName} ${patient.lastName}`,
                patientEmail: patient.email,
                items: items.map(item => ({
                    ...item,
                    amount: parseFloat(item.amount),
                    quantity: parseInt(item.quantity) || 1
                })),
                subtotal: calculations.subtotal,
                taxAmount: calculations.taxAmount,
                taxRate: calculations.taxRate,
                totalAmount: calculations.totalAmount,
                currency,
                paymentTerms: paymentTerms || this.paymentTerms.NET_30,
                dueDate: dueDate ? new Date(dueDate) : this.calculateDueDate(paymentTerms),
                status: this.invoiceStatuses.DRAFT,
                createdDate: new Date(),
                createdBy: practiceContext.userId,
                practiceId: practiceContext.practiceId,
                notes: notes || '',
                paidAmount: 0,
                remainingAmount: calculations.totalAmount
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'createInvoice',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const createdInvoice = await SecureDataAccess.create('invoices', invoiceData, context);

            // Generate PDF if required
            if (params.generatePDF) {
                await this.generateInvoicePDF(createdInvoice, practiceContext);
            }

            // Audit trail
            await this.auditInvoiceAction('CREATE_INVOICE', {
                invoiceNumber,
                patientId,
                totalAmount: calculations.totalAmount,
                currency,
                userId: practiceContext.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                invoiceId: createdInvoice._id,
                invoiceNumber,
                totalAmount: calculations.totalAmount,
                currency,
                dueDate: invoiceData.dueDate,
                status: this.invoiceStatuses.DRAFT,
                message: practiceContext.language === 'he'
                    ? `חשבונית ${invoiceNumber} נוצרה בהצלחה`
                    : `Invoice ${invoiceNumber} created successfully`
            };

        } catch (error) {
            console.error(`Error creating invoice:`, error);
            throw new Error(`Failed to create invoice: ${error.message}`);
        }
    }

    /**
     * Get invoice details
     */
    async getInvoice(invoiceId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getInvoice',
            practiceId: practiceContext.practiceId
        };

        try {
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const invoices = await SecureDataAccess.query('invoices',
                { _id: invoiceId },
                {},
                context
            );

            if (!invoices || invoices.length === 0) {
                throw new Error('Invoice not found');
            }

            const invoice = invoices[0];

            // Get payment history for this invoice
            const payments = await SecureDataAccess.query('payments',
                { invoiceId },
                { sort: { paymentDate: -1 } },
                context
            );

            return {
                success: true,
                invoice: {
                    ...invoice,
                    payments,
                    paymentHistory: payments.length
                }
            };

        } catch (error) {
            console.error(`Error getting invoice:`, error);
            throw new Error(`Failed to get invoice: ${error.message}`);
        }
    }

    /**
     * Update invoice status
     */
    async updateInvoiceStatus(invoiceId, newStatus, practiceContext) {
        await this.initialize();

        if (!Object.values(this.invoiceStatuses).includes(newStatus)) {
            throw new Error('Invalid invoice status');
        }

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'updateInvoiceStatus',
                practiceId: practiceContext.practiceId
            };

            const updateData = {
                status: newStatus,
                lastUpdated: new Date(),
                updatedBy: practiceContext.userId
            };

            // Add status-specific data
            if (newStatus === this.invoiceStatuses.SENT) {
                updateData.sentDate = new Date();
            } else if (newStatus === this.invoiceStatuses.VIEWED) {
                updateData.viewedDate = new Date();
            }

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.update('invoices',
                { _id: invoiceId },
                updateData,
                context
            );

            // Create status history
            await this.createInvoiceStatusHistory(invoiceId, newStatus, practiceContext);

            return {
                success: true,
                message: `Invoice status updated to ${newStatus}`
            };

        } catch (error) {
            console.error(`Error updating invoice status:`, error);
            throw new Error(`Failed to update invoice status: ${error.message}`);
        }
    }

    /**
     * Send invoice to patient
     */
    async sendInvoice(invoiceId, deliveryMethod, practiceContext) {
        await this.initialize();

        try {
            // Get invoice details
            const invoiceResult = await this.getInvoice(invoiceId, practiceContext);
            const invoice = invoiceResult.invoice;

            // Generate PDF if not exists
            const pdfPath = await this.generateInvoicePDF(invoice, practiceContext);

            // Send via requested method
            let sendResult;
            if (deliveryMethod === 'email') {
                sendResult = await this.sendInvoiceByEmail(invoice, pdfPath, practiceContext);
            } else if (deliveryMethod === 'portal') {
                sendResult = await this.sendInvoiceToPortal(invoice, practiceContext);
            } else {
                throw new Error('Unsupported delivery method');
            }

            if (sendResult.success) {
                await this.updateInvoiceStatus(invoiceId, this.invoiceStatuses.SENT, practiceContext);
            }

            return {
                success: sendResult.success,
                message: sendResult.message,
                deliveryMethod
            };

        } catch (error) {
            console.error(`Error sending invoice:`, error);
            throw new Error(`Failed to send invoice: ${error.message}`);
        }
    }

    /**
     * Get invoices for patient
     */
    async getPatientInvoices(patientId, practiceContext, filters = {}) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientInvoices',
            practiceId: practiceContext.practiceId
        };

        try {
            const query = { patientId };

            // Apply filters
            if (filters.status) {
                query.status = filters.status;
            }
            if (filters.fromDate) {
                query.createdDate = { $gte: new Date(filters.fromDate) };
            }
            if (filters.toDate) {
                query.createdDate = { ...query.createdDate, $lte: new Date(filters.toDate) };
            }

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const invoices = await SecureDataAccess.query('invoices',
                query,
                { sort: { createdDate: -1 } },
                context
            );

            const summary = {
                totalInvoices: invoices.length,
                totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
                paidAmount: invoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
                outstandingAmount: invoices.reduce((sum, inv) => sum + inv.remainingAmount, 0),
                overdue: invoices.filter(inv => 
                    inv.status !== this.invoiceStatuses.PAID && 
                    new Date() > new Date(inv.dueDate)
                ).length
            };

            return {
                success: true,
                invoices,
                summary
            };

        } catch (error) {
            console.error(`Error getting patient invoices:`, error);
            throw new Error(`Failed to get patient invoices: ${error.message}`);
        }
    }

    /**
     * Check for overdue invoices
     */
    async checkOverdueInvoices(practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'checkOverdueInvoices',
            practiceId: practiceContext.practiceId
        };

        try {
            const currentDate = new Date();
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const overdueInvoices = await SecureDataAccess.query('invoices',
                {
                    dueDate: { $lt: currentDate },
                    status: { $nin: [this.invoiceStatuses.PAID, this.invoiceStatuses.CANCELLED, this.invoiceStatuses.REFUNDED] },
                    remainingAmount: { $gt: 0 }
                },
                { sort: { dueDate: 1 } },
                context
            );

            // Update status to overdue
            for (const invoice of overdueInvoices) {
                if (invoice.status !== this.invoiceStatuses.OVERDUE) {
                    await this.updateInvoiceStatus(invoice._id, this.invoiceStatuses.OVERDUE, practiceContext);
                }
            }

            return {
                success: true,
                overdueCount: overdueInvoices.length,
                overdueInvoices,
                totalOverdueAmount: overdueInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0)
            };

        } catch (error) {
            console.error(`Error checking overdue invoices:`, error);
            throw new Error(`Failed to check overdue invoices: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    async generateInvoiceNumber(practiceContext) {
        const year = new Date().getFullYear();
        const context = {
            serviceId: this.serviceName,
            operation: 'generateInvoiceNumber',
            practiceId: practiceContext.practiceId
        };

        // Get last invoice number for this year
        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const lastInvoice = await SecureDataAccess.query('invoices',
            { 
                practiceId: practiceContext.practiceId,
                createdDate: {
                    $gte: new Date(year, 0, 1),
                    $lt: new Date(year + 1, 0, 1)
                }
            },
            { sort: { createdDate: -1 }, limit: 1 },
            context
        );

        let sequenceNumber = 1;
        if (lastInvoice && lastInvoice.length > 0) {
            const lastNumber = lastInvoice[0].invoiceNumber;
            const match = lastNumber.match(/INV-(\d{4})-(\d{4})/);
            if (match) {
                sequenceNumber = parseInt(match[2]) + 1;
            }
        }

        return `INV-${year}-${sequenceNumber.toString().padStart(4, '0')}`;
    }

    calculateInvoiceTotals(items, currency, practiceContext) {
        let subtotal = 0;
        
        for (const item of items) {
            const amount = parseFloat(item.amount);
            const quantity = parseInt(item.quantity) || 1;
            subtotal += amount * quantity;
        }

        // Calculate Israeli VAT (17%)
        const isIsraeliCurrency = currency === this.currencies.ILS;
        const taxRate = isIsraeliCurrency ? 0.17 : 0; // 17% VAT for Israeli invoices
        const taxAmount = subtotal * taxRate;
        const totalAmount = subtotal + taxAmount;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            taxAmount: Math.round(taxAmount * 100) / 100,
            taxRate,
            totalAmount: Math.round(totalAmount * 100) / 100
        };
    }

    calculateDueDate(paymentTerms) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (paymentTerms || this.paymentTerms.NET_30));
        return dueDate;
    }

    async getPatientDetails(patientId, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientDetails',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const patients = await SecureDataAccess.query('patients', { _id: patientId }, {}, context);
        return patients && patients.length > 0 ? patients[0] : null;
    }

    async generateInvoicePDF(invoice, practiceContext) {
        // PDF generation logic would go here
        console.log(`Generating PDF for invoice ${invoice.invoiceNumber}`);
        return `/invoices/${invoice.invoiceNumber}.pdf`;
    }

    async sendInvoiceByEmail(invoice, pdfPath, practiceContext) {
        // Email sending logic would go here
        console.log(`Sending invoice ${invoice.invoiceNumber} via email to ${invoice.patientEmail}`);
        return { success: true, message: 'Invoice sent via email' };
    }

    async sendInvoiceToPortal(invoice, practiceContext) {
        // Portal notification logic would go here
        console.log(`Sending invoice ${invoice.invoiceNumber} to patient portal`);
        return { success: true, message: 'Invoice sent to patient portal' };
    }

    async createInvoiceStatusHistory(invoiceId, status, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'createInvoiceStatusHistory',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.create('invoice_status_history', {
            invoiceId,
            status,
            timestamp: new Date(),
            updatedBy: practiceContext.userId,
            practiceId: practiceContext.practiceId
        }, context);
    }

    /**
     * Validation methods
     */
    validateInvoiceData(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            errors.push('At least one invoice item is required');
        } else {
            // Validate each item
            for (const item of data.items) {
                if (!item.description || !item.amount) {
                    errors.push('Each item must have description and amount');
                    break;
                }
                if (isNaN(parseFloat(item.amount))) {
                    errors.push('Item amounts must be valid numbers');
                    break;
                }
            }
            processedData.items = data.items;
        }

        if (data.currency && !Object.values(this.currencies).includes(data.currency)) {
            errors.push('Invalid currency');
        } else {
            processedData.currency = data.currency || this.currencies.ILS;
        }

        processedData.paymentTerms = data.paymentTerms;
        processedData.dueDate = data.dueDate;
        processedData.notes = data.notes;

        return { success: errors.length === 0, errors, processedData };
    }

    async auditInvoiceAction(action, details) {
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
const invoiceManagement = new InvoiceManagement();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('invoiceManagementService', () => invoiceManagement);
}

module.exports = invoiceManagement;