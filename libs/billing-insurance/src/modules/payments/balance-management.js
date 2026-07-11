/**
 * Balance Management Module
 * 
 * Handles patient balance tracking, account aging, and collections management
 * for healthcare practice financial operations.
 * 
 * Features:
 * - Patient balance tracking and updates
 * - Account aging analysis (30, 60, 90+ days)
 * - Collections workflow management
 * - Payment plan setup and monitoring
 * - Write-off and adjustment processing
 * - Balance alerts and notifications
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class BalanceManagement {
    constructor() {
        this.serviceName = 'BalanceManagement';
        this.serviceToken = null;
        this.initialized = false;
        this.balanceStatuses = {
            CURRENT: 'current',
            OVERDUE: 'overdue',
            IN_COLLECTIONS: 'in_collections',
            PAYMENT_PLAN: 'payment_plan',
            WRITTEN_OFF: 'written_off'
        };
        this.agingBuckets = {
            CURRENT: { min: 0, max: 30 },
            THIRTY_DAYS: { min: 31, max: 60 },
            SIXTY_DAYS: { min: 61, max: 90 },
            NINETY_PLUS: { min: 91, max: 999999 }
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
     * Get patient balance summary
     */
    async getPatientBalance(patientId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientBalance',
            practiceId: practiceContext.practiceId
        };

        try {
            // Get all unpaid invoices for patient
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const unpaidInvoices = await SecureDataAccess.query('invoices',
                { 
                    patientId, 
                    status: { $nin: ['paid', 'cancelled', 'refunded'] },
                    remainingAmount: { $gt: 0 }
                },
                { sort: { dueDate: 1 } },
                context
            );

            // Calculate balance aging
            const agingAnalysis = this.calculateBalanceAging(unpaidInvoices);
            
            // Get payment history
            const recentPayments = await SecureDataAccess.query('payments',
                { patientId },
                { sort: { paymentDate: -1 }, limit: 5 },
                context
            );

            // Check for active payment plan
            const activePlan = await this.getActivePaymentPlan(patientId, practiceContext);

            const balanceSummary = {
                patientId,
                totalBalance: unpaidInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0),
                invoiceCount: unpaidInvoices.length,
                aging: agingAnalysis,
                oldestInvoiceDate: unpaidInvoices.length > 0 ? unpaidInvoices[0].createdDate : null,
                status: this.determineBalanceStatus(agingAnalysis, activePlan),
                hasPaymentPlan: !!activePlan,
                recentPayments,
                lastUpdated: new Date()
            };

            return {
                success: true,
                balance: balanceSummary,
                invoices: unpaidInvoices,
                paymentPlan: activePlan
            };

        } catch (error) {
            console.error(`Error getting patient balance:`, error);
            throw new Error(`Failed to get patient balance: ${error.message}`);
        }
    }

    /**
     * Process balance aging analysis for all patients
     */
    async processAgingAnalysis(practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'processAgingAnalysis',
            practiceId: practiceContext.practiceId
        };

        try {
            // Get all patients with outstanding balances
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const patientsWithBalances = await SecureDataAccess.query('invoices',
                { 
                    status: { $nin: ['paid', 'cancelled', 'refunded'] },
                    remainingAmount: { $gt: 0 }
                },
                {},
                context
            );

            // Group by patient
            const patientBalances = {};
            patientsWithBalances.forEach(invoice => {
                if (!patientBalances[invoice.patientId]) {
                    patientBalances[invoice.patientId] = [];
                }
                patientBalances[invoice.patientId].push(invoice);
            });

            // Analyze aging for each patient
            const agingReport = {
                totalPatients: Object.keys(patientBalances).length,
                totalBalance: 0,
                agingSummary: {
                    current: { count: 0, amount: 0 },
                    thirtyDays: { count: 0, amount: 0 },
                    sixtyDays: { count: 0, amount: 0 },
                    ninetyPlus: { count: 0, amount: 0 }
                },
                patientAging: []
            };

            Object.entries(patientBalances).forEach(([patientId, invoices]) => {
                const patientAging = this.calculateBalanceAging(invoices);
                const totalPatientBalance = invoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);

                agingReport.totalBalance += totalPatientBalance;
                
                // Add to summary buckets
                Object.entries(patientAging.buckets).forEach(([bucket, data]) => {
                    if (agingReport.agingSummary[bucket]) {
                        agingReport.agingSummary[bucket].count += data.count;
                        agingReport.agingSummary[bucket].amount += data.amount;
                    }
                });

                agingReport.patientAging.push({
                    patientId,
                    totalBalance: totalPatientBalance,
                    aging: patientAging
                });
            });

            // Sort patients by total balance (highest first)
            agingReport.patientAging.sort((a, b) => b.totalBalance - a.totalBalance);

            // Store aging report
            await SecureDataAccess.create('balance_aging_reports', {
                ...agingReport,
                reportDate: new Date(),
                generatedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId
            }, context);

            return {
                success: true,
                agingReport,
                collectionsRequired: agingReport.patientAging.filter(p => p.aging.daysOutstanding > 30).length
            };

        } catch (error) {
            console.error(`Error processing aging analysis:`, error);
            throw new Error(`Failed to process aging analysis: ${error.message}`);
        }
    }

    /**
     * Create payment plan for patient
     */
    async createPaymentPlan(params, practiceContext) {
        await this.initialize();

        const validation = this.validatePaymentPlanData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { 
            patientId, 
            totalAmount, 
            monthlyPayment, 
            numberOfPayments,
            startDate,
            interestRate 
        } = validation.processedData;

        try {
            // Calculate payment schedule
            const paymentSchedule = this.calculatePaymentSchedule(
                totalAmount,
                monthlyPayment,
                numberOfPayments,
                startDate,
                interestRate || 0
            );

            const paymentPlan = {
                paymentPlanId: this.generatePaymentPlanId(),
                patientId,
                totalAmount: parseFloat(totalAmount),
                monthlyPayment: parseFloat(monthlyPayment),
                numberOfPayments: parseInt(numberOfPayments),
                remainingPayments: parseInt(numberOfPayments),
                interestRate: parseFloat(interestRate || 0),
                startDate: new Date(startDate),
                nextPaymentDate: new Date(startDate),
                status: 'active',
                paymentSchedule,
                createdDate: new Date(),
                createdBy: practiceContext.userId,
                practiceId: practiceContext.practiceId
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'createPaymentPlan',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.create('payment_plans', paymentPlan, context);

            // Update patient balance status
            await this.updatePatientBalanceStatus(patientId, this.balanceStatuses.PAYMENT_PLAN, practiceContext);

            return {
                success: true,
                paymentPlanId: paymentPlan.paymentPlanId,
                paymentSchedule,
                message: 'Payment plan created successfully'
            };

        } catch (error) {
            console.error(`Error creating payment plan:`, error);
            throw new Error(`Failed to create payment plan: ${error.message}`);
        }
    }

    /**
     * Process payment plan payment
     */
    async processPaymentPlanPayment(params, practiceContext) {
        await this.initialize();

        const { paymentPlanId, paymentAmount, paymentDate } = params;

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'processPaymentPlanPayment',
                practiceId: practiceContext.practiceId
            };

            // Get payment plan
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const plans = await SecureDataAccess.query('payment_plans',
                { paymentPlanId },
                {},
                context
            );

            if (!plans || plans.length === 0) {
                throw new Error('Payment plan not found');
            }

            const paymentPlan = plans[0];

            // Record payment
            const paymentRecord = {
                paymentPlanId,
                patientId: paymentPlan.patientId,
                paymentAmount: parseFloat(paymentAmount),
                paymentDate: new Date(paymentDate || Date.now()),
                recordedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId
            };

            await SecureDataAccess.create('payment_plan_payments', paymentRecord, context);

            // Update payment plan
            const newRemainingPayments = Math.max(0, paymentPlan.remainingPayments - 1);
            const newNextPaymentDate = new Date(paymentPlan.nextPaymentDate);
            newNextPaymentDate.setMonth(newNextPaymentDate.getMonth() + 1);

            const updateData = {
                remainingPayments: newRemainingPayments,
                nextPaymentDate: newRemainingPayments > 0 ? newNextPaymentDate : null,
                status: newRemainingPayments === 0 ? 'completed' : 'active',
                lastPaymentDate: new Date(paymentDate || Date.now()),
                lastUpdated: new Date()
            };

            await SecureDataAccess.update('payment_plans',
                { paymentPlanId },
                updateData,
                context
            );

            return {
                success: true,
                remainingPayments: newRemainingPayments,
                nextPaymentDate: updateData.nextPaymentDate,
                planStatus: updateData.status,
                message: newRemainingPayments === 0 ? 'Payment plan completed' : 'Payment recorded successfully'
            };

        } catch (error) {
            console.error(`Error processing payment plan payment:`, error);
            throw new Error(`Failed to process payment plan payment: ${error.message}`);
        }
    }

    /**
     * Process write-off or adjustment
     */
    async processWriteOff(params, practiceContext) {
        await this.initialize();

        const { patientId, invoiceId, writeOffAmount, reason, adjustmentType } = params;

        if (!patientId || !writeOffAmount || !reason) {
            throw new Error('Patient ID, write-off amount, and reason are required');
        }

        try {
            const writeOffRecord = {
                writeOffId: this.generateWriteOffId(),
                patientId,
                invoiceId: invoiceId || null,
                amount: parseFloat(writeOffAmount),
                reason,
                adjustmentType: adjustmentType || 'bad_debt',
                processedDate: new Date(),
                processedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'processWriteOff',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.create('write_offs', writeOffRecord, context);

            // Update invoice if specified
            if (invoiceId) {
                const invoice = await this.getInvoiceDetails(invoiceId, practiceContext);
                if (invoice) {
                    const newRemainingAmount = Math.max(0, invoice.remainingAmount - parseFloat(writeOffAmount));
                    const newStatus = newRemainingAmount === 0 ? 'written_off' : invoice.status;

                    await SecureDataAccess.update('invoices',
                        { _id: invoiceId },
                        {
                            remainingAmount: newRemainingAmount,
                            status: newStatus,
                            lastUpdated: new Date()
                        },
                        context
                    );
                }
            }

            return {
                success: true,
                writeOffId: writeOffRecord.writeOffId,
                message: 'Write-off processed successfully'
            };

        } catch (error) {
            console.error(`Error processing write-off:`, error);
            throw new Error(`Failed to process write-off: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    calculateBalanceAging(invoices) {
        const today = new Date();
        const buckets = {
            current: { count: 0, amount: 0 },
            thirtyDays: { count: 0, amount: 0 },
            sixtyDays: { count: 0, amount: 0 },
            ninetyPlus: { count: 0, amount: 0 }
        };

        let oldestDaysOutstanding = 0;

        invoices.forEach(invoice => {
            const dueDate = new Date(invoice.dueDate);
            const daysOutstanding = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
            
            oldestDaysOutstanding = Math.max(oldestDaysOutstanding, daysOutstanding);

            if (daysOutstanding <= 30) {
                buckets.current.count++;
                buckets.current.amount += invoice.remainingAmount;
            } else if (daysOutstanding <= 60) {
                buckets.thirtyDays.count++;
                buckets.thirtyDays.amount += invoice.remainingAmount;
            } else if (daysOutstanding <= 90) {
                buckets.sixtyDays.count++;
                buckets.sixtyDays.amount += invoice.remainingAmount;
            } else {
                buckets.ninetyPlus.count++;
                buckets.ninetyPlus.amount += invoice.remainingAmount;
            }
        });

        return {
            daysOutstanding: oldestDaysOutstanding,
            buckets
        };
    }

    determineBalanceStatus(agingAnalysis, activePlan) {
        if (activePlan) return this.balanceStatuses.PAYMENT_PLAN;
        if (agingAnalysis.buckets.ninetyPlus.amount > 0) return this.balanceStatuses.IN_COLLECTIONS;
        if (agingAnalysis.daysOutstanding > 30) return this.balanceStatuses.OVERDUE;
        return this.balanceStatuses.CURRENT;
    }

    async getActivePaymentPlan(patientId, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getActivePaymentPlan',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const plans = await SecureDataAccess.query('payment_plans',
            { patientId, status: 'active' },
            { sort: { createdDate: -1 }, limit: 1 },
            context
        );

        return plans && plans.length > 0 ? plans[0] : null;
    }

    calculatePaymentSchedule(totalAmount, monthlyPayment, numberOfPayments, startDate, interestRate) {
        const schedule = [];
        const monthlyInterestRate = interestRate / 12 / 100;
        let remainingBalance = totalAmount;
        let currentDate = new Date(startDate);

        for (let i = 1; i <= numberOfPayments; i++) {
            const interestAmount = remainingBalance * monthlyInterestRate;
            const principalAmount = Math.min(monthlyPayment - interestAmount, remainingBalance);
            remainingBalance = Math.max(0, remainingBalance - principalAmount);

            schedule.push({
                paymentNumber: i,
                dueDate: new Date(currentDate),
                paymentAmount: monthlyPayment,
                principalAmount: Math.round(principalAmount * 100) / 100,
                interestAmount: Math.round(interestAmount * 100) / 100,
                remainingBalance: Math.round(remainingBalance * 100) / 100
            });

            currentDate.setMonth(currentDate.getMonth() + 1);

            if (remainingBalance === 0) break;
        }

        return schedule;
    }

    generatePaymentPlanId() {
        return `PP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    generateWriteOffId() {
        return `WO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
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

    async updatePatientBalanceStatus(patientId, status, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'updatePatientBalanceStatus',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.update('patients',
            { _id: patientId },
            { 
                balanceStatus: status,
                lastUpdated: new Date()
            },
            context
        );
    }

    /**
     * Validation methods
     */
    validatePaymentPlanData(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.totalAmount || isNaN(parseFloat(data.totalAmount))) {
            errors.push('Valid total amount is required');
        } else {
            processedData.totalAmount = parseFloat(data.totalAmount);
        }

        if (!data.monthlyPayment || isNaN(parseFloat(data.monthlyPayment))) {
            errors.push('Valid monthly payment amount is required');
        } else {
            processedData.monthlyPayment = parseFloat(data.monthlyPayment);
        }

        if (!data.numberOfPayments || isNaN(parseInt(data.numberOfPayments))) {
            errors.push('Valid number of payments is required');
        } else {
            processedData.numberOfPayments = parseInt(data.numberOfPayments);
        }

        if (!data.startDate) {
            errors.push('Start date is required');
        } else {
            processedData.startDate = data.startDate;
        }

        processedData.interestRate = parseFloat(data.interestRate) || 0;

        return { success: errors.length === 0, errors, processedData };
    }
}

// Create instance
const balanceManagement = new BalanceManagement();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('balanceManagementService', () => balanceManagement);
}

module.exports = balanceManagement;