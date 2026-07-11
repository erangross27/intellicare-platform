/**
 * Financial Reporting Module
 * 
 * Handles comprehensive financial reporting, analytics dashboards, and performance metrics
 * for healthcare practice financial management.
 * 
 * Features:
 * - Revenue and expense reporting
 * - Profitability analysis by service line
 * - Insurance reimbursement analytics
 * - Financial KPIs and metrics
 * - Custom report generation
 * - Export capabilities (PDF, Excel, CSV)
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class FinancialReporting {
    constructor() {
        this.serviceName = 'FinancialReporting';
        this.serviceToken = null;
        this.initialized = false;
        this.reportTypes = {
            REVENUE_SUMMARY: 'revenue_summary',
            EXPENSE_ANALYSIS: 'expense_analysis',
            PROFIT_LOSS: 'profit_loss',
            CASH_FLOW: 'cash_flow',
            INSURANCE_ANALYTICS: 'insurance_analytics',
            SERVICE_PROFITABILITY: 'service_profitability',
            PATIENT_ANALYTICS: 'patient_analytics',
            COLLECTIONS_REPORT: 'collections_report'
        };
        this.reportPeriods = {
            DAILY: 'daily',
            WEEKLY: 'weekly',
            MONTHLY: 'monthly',
            QUARTERLY: 'quarterly',
            YEARLY: 'yearly',
            CUSTOM: 'custom'
        };
        this.exportFormats = {
            PDF: 'pdf',
            EXCEL: 'excel',
            CSV: 'csv',
            JSON: 'json'
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
     * Generate comprehensive financial report
     */
    async generateFinancialReport(params, practiceContext) {
        await this.initialize();

        const validation = this.validateReportRequest(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { reportType, period, startDate, endDate, includeComparisons } = validation.processedData;

        try {
            let reportData;

            // Generate specific report type
            switch (reportType) {
                case this.reportTypes.REVENUE_SUMMARY:
                    reportData = await this.generateRevenueSummaryReport(startDate, endDate, practiceContext);
                    break;
                case this.reportTypes.EXPENSE_ANALYSIS:
                    reportData = await this.generateExpenseAnalysisReport(startDate, endDate, practiceContext);
                    break;
                case this.reportTypes.PROFIT_LOSS:
                    reportData = await this.generateProfitLossReport(startDate, endDate, practiceContext);
                    break;
                case this.reportTypes.INSURANCE_ANALYTICS:
                    reportData = await this.generateInsuranceAnalyticsReport(startDate, endDate, practiceContext);
                    break;
                case this.reportTypes.SERVICE_PROFITABILITY:
                    reportData = await this.generateServiceProfitabilityReport(startDate, endDate, practiceContext);
                    break;
                default:
                    reportData = await this.generateComprehensiveReport(startDate, endDate, practiceContext);
            }

            // Add comparison data if requested
            if (includeComparisons) {
                reportData.comparison = await this.generateComparisonData(
                    reportType, 
                    startDate, 
                    endDate, 
                    period, 
                    practiceContext
                );
            }

            // Calculate financial KPIs
            const kpis = await this.calculateFinancialKPIs(reportData, startDate, endDate, practiceContext);

            // Store report
            const reportRecord = {
                reportId: this.generateReportId(),
                reportType,
                period,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                generatedDate: new Date(),
                generatedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId,
                reportData,
                kpis,
                includeComparisons
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'generateFinancialReport',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.create('financial_reports', reportRecord, context);

            return {
                success: true,
                reportId: reportRecord.reportId,
                reportType,
                period: { startDate, endDate },
                data: reportData,
                kpis,
                generatedDate: reportRecord.generatedDate,
                message: practiceContext.language === 'he' 
                    ? 'הדוח הכספי נוצר בהצלחה'
                    : 'Financial report generated successfully'
            };

        } catch (error) {
            console.error(`Error generating financial report:`, error);
            throw new Error(`Failed to generate financial report: ${error.message}`);
        }
    }

    /**
     * Generate revenue summary report
     */
    async generateRevenueSummaryReport(startDate, endDate, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'generateRevenueSummaryReport',
            practiceId: practiceContext.practiceId
        };

        try {
            // Get invoice data
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const invoices = await SecureDataAccess.query('invoices',
                {
                    createdDate: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    },
                    status: { $ne: 'cancelled' }
                },
                { sort: { createdDate: 1 } },
                context
            );

            // Get payment data
            const payments = await SecureDataAccess.query('payments',
                {
                    paymentDate: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    },
                    status: 'completed'
                },
                { sort: { paymentDate: 1 } },
                context
            );

            // Calculate revenue metrics
            const totalBilled = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
            const totalCollected = payments.reduce((sum, pay) => sum + pay.amount, 0);
            const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);
            
            const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

            // Revenue by payment method
            const revenueByMethod = {};
            payments.forEach(payment => {
                const method = payment.paymentMethod || 'unknown';
                revenueByMethod[method] = (revenueByMethod[method] || 0) + payment.amount;
            });

            // Monthly breakdown
            const monthlyRevenue = this.groupByMonth(invoices, 'createdDate', 'totalAmount');
            const monthlyCollections = this.groupByMonth(payments, 'paymentDate', 'amount');

            return {
                summary: {
                    totalBilled: Math.round(totalBilled * 100) / 100,
                    totalCollected: Math.round(totalCollected * 100) / 100,
                    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
                    collectionRate: Math.round(collectionRate * 100) / 100,
                    invoiceCount: invoices.length,
                    paymentCount: payments.length
                },
                revenueByMethod,
                monthlyRevenue,
                monthlyCollections,
                trends: this.calculateRevenueTrends(monthlyCollections)
            };

        } catch (error) {
            console.error(`Error generating revenue summary:`, error);
            throw new Error(`Failed to generate revenue summary: ${error.message}`);
        }
    }

    /**
     * Generate insurance analytics report
     */
    async generateInsuranceAnalyticsReport(startDate, endDate, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'generateInsuranceAnalyticsReport',
            practiceId: practiceContext.practiceId
        };

        try {
            // Get claims data
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const claims = await SecureDataAccess.query('insurance_claims',
                {
                    submittedDate: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                },
                {},
                context
            );

            // Analyze by insurance provider
            const providerAnalysis = {};
            let totalClaimsAmount = 0;
            let totalPaidAmount = 0;

            claims.forEach(claim => {
                const provider = claim.insuranceProvider;
                if (!providerAnalysis[provider]) {
                    providerAnalysis[provider] = {
                        claimCount: 0,
                        totalAmount: 0,
                        paidAmount: 0,
                        pendingAmount: 0,
                        deniedAmount: 0,
                        averageProcessingTime: 0
                    };
                }

                const analysis = providerAnalysis[provider];
                analysis.claimCount++;
                analysis.totalAmount += claim.amount;
                totalClaimsAmount += claim.amount;

                if (claim.status === 'paid') {
                    analysis.paidAmount += claim.paidAmount || 0;
                    totalPaidAmount += claim.paidAmount || 0;
                } else if (claim.status === 'rejected') {
                    analysis.deniedAmount += claim.amount;
                } else {
                    analysis.pendingAmount += claim.amount;
                }
            });

            // Calculate reimbursement rates
            Object.values(providerAnalysis).forEach(analysis => {
                analysis.reimbursementRate = analysis.totalAmount > 0 ? 
                    (analysis.paidAmount / analysis.totalAmount) * 100 : 0;
                analysis.denialRate = analysis.totalAmount > 0 ? 
                    (analysis.deniedAmount / analysis.totalAmount) * 100 : 0;
            });

            const overallReimbursementRate = totalClaimsAmount > 0 ? 
                (totalPaidAmount / totalClaimsAmount) * 100 : 0;

            return {
                summary: {
                    totalClaims: claims.length,
                    totalClaimsAmount: Math.round(totalClaimsAmount * 100) / 100,
                    totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
                    overallReimbursementRate: Math.round(overallReimbursementRate * 100) / 100,
                    uniqueProviders: Object.keys(providerAnalysis).length
                },
                providerAnalysis,
                topPayingProviders: this.getTopProviders(providerAnalysis, 'paidAmount'),
                slowestPayingProviders: this.getSlowestProviders(providerAnalysis)
            };

        } catch (error) {
            console.error(`Error generating insurance analytics:`, error);
            throw new Error(`Failed to generate insurance analytics: ${error.message}`);
        }
    }

    /**
     * Calculate financial KPIs
     */
    async calculateFinancialKPIs(reportData, startDate, endDate, practiceContext) {
        try {
            // Calculate period length
            const periodDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));

            // Get patient volume for period
            const patientVolume = await this.getPatientVolume(startDate, endDate, practiceContext);

            const kpis = {};

            // Revenue KPIs
            if (reportData.summary) {
                kpis.revenue = {
                    totalRevenue: reportData.summary.totalCollected || 0,
                    averageDailyRevenue: periodDays > 0 ? 
                        (reportData.summary.totalCollected || 0) / periodDays : 0,
                    revenuePerPatient: patientVolume.uniquePatients > 0 ? 
                        (reportData.summary.totalCollected || 0) / patientVolume.uniquePatients : 0,
                    collectionRate: reportData.summary.collectionRate || 0
                };
            }

            // Efficiency KPIs
            kpis.efficiency = {
                averageTransactionValue: reportData.summary?.paymentCount > 0 ? 
                    (reportData.summary.totalCollected || 0) / reportData.summary.paymentCount : 0,
                daysInAR: this.calculateDaysInAR(reportData.summary),
                badDebtRatio: await this.calculateBadDebtRatio(startDate, endDate, practiceContext)
            };

            // Growth KPIs
            if (reportData.trends) {
                kpis.growth = {
                    revenueGrowthRate: reportData.trends.growthRate || 0,
                    trendDirection: reportData.trends.direction || 'stable'
                };
            }

            return kpis;

        } catch (error) {
            console.error(`Error calculating KPIs:`, error);
            return {};
        }
    }

    /**
     * Export report to specified format
     */
    async exportReport(reportId, format, practiceContext) {
        await this.initialize();

        if (!Object.values(this.exportFormats).includes(format)) {
            throw new Error('Invalid export format');
        }

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'exportReport',
                practiceId: practiceContext.practiceId
            };

            // Get report data
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const reports = await SecureDataAccess.query('financial_reports',
                { reportId },
                {},
                context
            );

            if (!reports || reports.length === 0) {
                throw new Error('Report not found');
            }

            const report = reports[0];

            // Generate export based on format
            let exportResult;
            switch (format) {
                case this.exportFormats.PDF:
                    exportResult = await this.generatePDFExport(report);
                    break;
                case this.exportFormats.EXCEL:
                    exportResult = await this.generateExcelExport(report);
                    break;
                case this.exportFormats.CSV:
                    exportResult = await this.generateCSVExport(report);
                    break;
                case this.exportFormats.JSON:
                    exportResult = { data: report.reportData, filename: `${reportId}.json` };
                    break;
                default:
                    throw new Error('Unsupported export format');
            }

            return {
                success: true,
                filename: exportResult.filename,
                data: exportResult.data,
                format,
                generatedDate: new Date()
            };

        } catch (error) {
            console.error(`Error exporting report:`, error);
            throw new Error(`Failed to export report: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    generateReportId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();
        return `RPT-${timestamp}-${random}`;
    }

    groupByMonth(data, dateField, amountField) {
        const grouped = {};
        
        data.forEach(item => {
            const date = new Date(item[dateField]);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!grouped[monthKey]) {
                grouped[monthKey] = { month: monthKey, amount: 0, count: 0 };
            }
            
            grouped[monthKey].amount += item[amountField] || 0;
            grouped[monthKey].count++;
        });
        
        return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
    }

    calculateRevenueTrends(monthlyData) {
        if (monthlyData.length < 2) {
            return { direction: 'insufficient_data', growthRate: 0 };
        }

        const values = monthlyData.map(d => d.amount);
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));

        const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

        const growthRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
        const direction = growthRate > 5 ? 'increasing' : growthRate < -5 ? 'decreasing' : 'stable';

        return { direction, growthRate: Math.round(growthRate * 100) / 100 };
    }

    getTopProviders(providerAnalysis, metric) {
        return Object.entries(providerAnalysis)
            .sort((a, b) => b[1][metric] - a[1][metric])
            .slice(0, 5)
            .map(([provider, analysis]) => ({
                provider,
                value: analysis[metric],
                claimCount: analysis.claimCount
            }));
    }

    getSlowestProviders(providerAnalysis) {
        return Object.entries(providerAnalysis)
            .filter(([_, analysis]) => analysis.averageProcessingTime > 0)
            .sort((a, b) => b[1].averageProcessingTime - a[1].averageProcessingTime)
            .slice(0, 5)
            .map(([provider, analysis]) => ({
                provider,
                averageProcessingTime: analysis.averageProcessingTime,
                claimCount: analysis.claimCount
            }));
    }

    calculateDaysInAR(summary) {
        // Simple Days in A/R calculation
        if (!summary || !summary.totalOutstanding || !summary.totalCollected) return 0;
        
        const dailyRevenue = summary.totalCollected / 30; // Assume 30-day period
        return dailyRevenue > 0 ? summary.totalOutstanding / dailyRevenue : 0;
    }

    async calculateBadDebtRatio(startDate, endDate, practiceContext) {
        // Get write-offs for the period
        const context = {
            serviceId: this.serviceName,
            operation: 'calculateBadDebtRatio',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const writeOffs = await SecureDataAccess.query('write_offs',
            {
                processedDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                },
                adjustmentType: 'bad_debt'
            },
            {},
            context
        );

        const totalWriteOffs = writeOffs.reduce((sum, wo) => sum + wo.amount, 0);
        
        // Get total revenue for comparison
        const invoices = await SecureDataAccess.query('invoices',
            {
                createdDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            },
            {},
            context
        );

        const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        
        return totalRevenue > 0 ? (totalWriteOffs / totalRevenue) * 100 : 0;
    }

    async getPatientVolume(startDate, endDate, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientVolume',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const appointments = await SecureDataAccess.query('appointments',
            {
                appointmentDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                },
                status: { $in: ['completed', 'attended'] }
            },
            {},
            context
        );

        return {
            totalVisits: appointments.length,
            uniquePatients: new Set(appointments.map(apt => apt.patientId)).size
        };
    }

    async generatePDFExport(report) {
        // PDF generation would be implemented here
        return {
            filename: `${report.reportId}.pdf`,
            data: 'PDF_DATA_PLACEHOLDER'
        };
    }

    async generateExcelExport(report) {
        // Excel generation would be implemented here
        return {
            filename: `${report.reportId}.xlsx`,
            data: 'EXCEL_DATA_PLACEHOLDER'
        };
    }

    async generateCSVExport(report) {
        // CSV generation would be implemented here
        return {
            filename: `${report.reportId}.csv`,
            data: 'CSV_DATA_PLACEHOLDER'
        };
    }

    /**
     * Validation methods
     */
    validateReportRequest(data) {
        const errors = [];
        const processedData = {};

        if (!data.reportType || !Object.values(this.reportTypes).includes(data.reportType)) {
            processedData.reportType = this.reportTypes.REVENUE_SUMMARY;
        } else {
            processedData.reportType = data.reportType;
        }

        if (!data.startDate) {
            errors.push('Start date is required');
        } else {
            processedData.startDate = data.startDate;
        }

        if (!data.endDate) {
            errors.push('End date is required');
        } else {
            processedData.endDate = data.endDate;
        }

        processedData.period = data.period || this.reportPeriods.CUSTOM;
        processedData.includeComparisons = data.includeComparisons || false;

        return { success: errors.length === 0, errors, processedData };
    }
}

// Create instance
const financialReporting = new FinancialReporting();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('financialReportingService', () => financialReporting);
}

module.exports = financialReporting;