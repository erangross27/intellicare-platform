/**
 * Payment Reconciliation Module
 * 
 * Handles payment reconciliation, bank statement matching, and financial
 * discrepancy resolution for healthcare payment processing.
 * 
 * Features:
 * - Automated bank statement reconciliation
 * - Payment matching and discrepancy identification
 * - Manual reconciliation tools
 * - Reconciliation reporting and analytics
 * - Multi-account and multi-currency support
 * - Exception handling and resolution tracking
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class PaymentReconciliation {
    constructor() {
        this.serviceName = 'PaymentReconciliation';
        this.serviceToken = null;
        this.initialized = false;
        this.reconciliationStatuses = {
            PENDING: 'pending',
            IN_PROGRESS: 'in_progress',
            MATCHED: 'matched',
            UNMATCHED: 'unmatched',
            DISPUTED: 'disputed',
            RESOLVED: 'resolved'
        };
        this.discrepancyTypes = {
            AMOUNT_MISMATCH: 'amount_mismatch',
            DATE_MISMATCH: 'date_mismatch',
            MISSING_PAYMENT: 'missing_payment',
            DUPLICATE_PAYMENT: 'duplicate_payment',
            UNKNOWN_PAYMENT: 'unknown_payment',
            REFUND_MISMATCH: 'refund_mismatch'
        };
        this.matchingMethods = {
            EXACT: 'exact',
            FUZZY: 'fuzzy',
            MANUAL: 'manual'
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
     * Process bank statement reconciliation
     */
    async processBankReconciliation(params, practiceContext) {
        await this.initialize();

        const validation = this.validateReconciliationRequest(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { 
            bankAccountId, 
            statementDate, 
            statementTransactions,
            reconciliationPeriod 
        } = validation.processedData;

        try {
            // Generate reconciliation batch ID
            const reconciliationId = this.generateReconciliationId();

            // Get system payments for the period
            const systemPayments = await this.getSystemPayments(
                bankAccountId, 
                reconciliationPeriod, 
                practiceContext
            );

            // Perform automatic matching
            const matchingResults = await this.performAutomaticMatching(
                statementTransactions, 
                systemPayments
            );

            // Identify discrepancies
            const discrepancies = await this.identifyDiscrepancies(
                matchingResults,
                statementTransactions,
                systemPayments
            );

            // Create reconciliation record
            const reconciliation = {
                reconciliationId,
                bankAccountId,
                statementDate: new Date(statementDate),
                reconciliationPeriod,
                status: discrepancies.length > 0 ? 
                    this.reconciliationStatuses.UNMATCHED : 
                    this.reconciliationStatuses.MATCHED,
                totalStatementTransactions: statementTransactions.length,
                totalSystemPayments: systemPayments.length,
                matchedTransactions: matchingResults.matched.length,
                unmatchedTransactions: matchingResults.unmatched.length,
                discrepanciesFound: discrepancies.length,
                statementBalance: this.calculateStatementBalance(statementTransactions),
                systemBalance: this.calculateSystemBalance(systemPayments),
                balanceDifference: 0,
                createdDate: new Date(),
                processedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId,
                matchingResults,
                discrepancies
            };

            reconciliation.balanceDifference = 
                reconciliation.statementBalance - reconciliation.systemBalance;

            const context = {
                serviceId: this.serviceName,
                operation: 'processBankReconciliation',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.create('payment_reconciliations', reconciliation, context);

            // Create individual discrepancy records
            for (const discrepancy of discrepancies) {
                await this.createDiscrepancyRecord(reconciliationId, discrepancy, practiceContext);
            }

            // Generate reconciliation report
            const report = await this.generateReconciliationReport(reconciliation, practiceContext);

            return {
                success: true,
                reconciliationId,
                status: reconciliation.status,
                summary: {
                    totalTransactions: reconciliation.totalStatementTransactions,
                    matchedTransactions: reconciliation.matchedTransactions,
                    unmatchedTransactions: reconciliation.unmatchedTransactions,
                    discrepancies: reconciliation.discrepanciesFound,
                    balanceDifference: reconciliation.balanceDifference
                },
                discrepancies,
                report,
                message: discrepancies.length > 0 ?
                    `Reconciliation completed with ${discrepancies.length} discrepancies requiring attention` :
                    'Reconciliation completed successfully - all transactions matched'
            };

        } catch (error) {
            console.error(`Error processing bank reconciliation:`, error);
            throw new Error(`Failed to process bank reconciliation: ${error.message}`);
        }
    }

    /**
     * Resolve reconciliation discrepancy
     */
    async resolveDiscrepancy(params, practiceContext) {
        await this.initialize();

        const { discrepancyId, resolutionType, resolutionNotes, adjustmentAmount } = params;

        if (!discrepancyId || !resolutionType) {
            throw new Error('Discrepancy ID and resolution type are required');
        }

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'resolveDiscrepancy',
                practiceId: practiceContext.practiceId
            };

            // Get discrepancy record
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const discrepancies = await SecureDataAccess.query('reconciliation_discrepancies',
                { discrepancyId },
                {},
                context
            );

            if (!discrepancies || discrepancies.length === 0) {
                throw new Error('Discrepancy not found');
            }

            const discrepancy = discrepancies[0];

            // Process resolution
            let resolutionResult;
            switch (resolutionType) {
                case 'manual_match':
                    resolutionResult = await this.processManualMatch(discrepancy, params, practiceContext);
                    break;
                case 'create_adjustment':
                    resolutionResult = await this.createAdjustmentEntry(discrepancy, adjustmentAmount, practiceContext);
                    break;
                case 'mark_as_error':
                    resolutionResult = await this.markAsSystemError(discrepancy, resolutionNotes, practiceContext);
                    break;
                case 'request_reversal':
                    resolutionResult = await this.requestPaymentReversal(discrepancy, resolutionNotes, practiceContext);
                    break;
                default:
                    throw new Error(`Unknown resolution type: ${resolutionType}`);
            }

            // Update discrepancy record
            await SecureDataAccess.update('reconciliation_discrepancies',
                { discrepancyId },
                {
                    status: this.reconciliationStatuses.RESOLVED,
                    resolutionType,
                    resolutionNotes,
                    resolutionDate: new Date(),
                    resolvedBy: practiceContext.userId,
                    resolutionResult
                },
                context
            );

            return {
                success: true,
                discrepancyId,
                resolutionType,
                resolutionResult,
                message: 'Discrepancy resolved successfully'
            };

        } catch (error) {
            console.error(`Error resolving discrepancy:`, error);
            throw new Error(`Failed to resolve discrepancy: ${error.message}`);
        }
    }

    /**
     * Get reconciliation status and summary
     */
    async getReconciliationStatus(reconciliationId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getReconciliationStatus',
            practiceId: practiceContext.practiceId
        };

        try {
            // Get reconciliation record
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const reconciliations = await SecureDataAccess.query('payment_reconciliations',
                { reconciliationId },
                {},
                context
            );

            if (!reconciliations || reconciliations.length === 0) {
                throw new Error('Reconciliation not found');
            }

            const reconciliation = reconciliations[0];

            // Get discrepancies
            const discrepancies = await SecureDataAccess.query('reconciliation_discrepancies',
                { reconciliationId },
                { sort: { createdDate: -1 } },
                context
            );

            // Calculate current status
            const unresolvedDiscrepancies = discrepancies.filter(d => 
                d.status !== this.reconciliationStatuses.RESOLVED
            );

            const currentStatus = unresolvedDiscrepancies.length > 0 ?
                this.reconciliationStatuses.UNMATCHED :
                this.reconciliationStatuses.MATCHED;

            return {
                success: true,
                reconciliation: {
                    reconciliationId: reconciliation.reconciliationId,
                    bankAccountId: reconciliation.bankAccountId,
                    statementDate: reconciliation.statementDate,
                    status: currentStatus,
                    totalTransactions: reconciliation.totalStatementTransactions,
                    matchedTransactions: reconciliation.matchedTransactions,
                    balanceDifference: reconciliation.balanceDifference
                },
                discrepancies: {
                    total: discrepancies.length,
                    unresolved: unresolvedDiscrepancies.length,
                    resolved: discrepancies.length - unresolvedDiscrepancies.length,
                    details: discrepancies
                }
            };

        } catch (error) {
            console.error(`Error getting reconciliation status:`, error);
            throw new Error(`Failed to get reconciliation status: ${error.message}`);
        }
    }

    /**
     * Generate reconciliation summary report
     */
    async generateReconciliationSummary(params, practiceContext) {
        await this.initialize();

        const { startDate, endDate, bankAccountId } = params;

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'generateReconciliationSummary',
                practiceId: practiceContext.practiceId
            };

            const query = {
                createdDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };

            if (bankAccountId) {
                query.bankAccountId = bankAccountId;
            }

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const reconciliations = await SecureDataAccess.query('payment_reconciliations',
                query,
                { sort: { createdDate: -1 } },
                context
            );

            // Calculate summary metrics
            const summary = {
                totalReconciliations: reconciliations.length,
                fullyMatched: reconciliations.filter(r => r.status === this.reconciliationStatuses.MATCHED).length,
                withDiscrepancies: reconciliations.filter(r => r.status === this.reconciliationStatuses.UNMATCHED).length,
                totalTransactionsProcessed: reconciliations.reduce((sum, r) => sum + r.totalStatementTransactions, 0),
                totalMatchedTransactions: reconciliations.reduce((sum, r) => sum + r.matchedTransactions, 0),
                totalDiscrepancies: reconciliations.reduce((sum, r) => sum + r.discrepanciesFound, 0),
                totalBalanceDifference: reconciliations.reduce((sum, r) => sum + Math.abs(r.balanceDifference), 0),
                averageMatchRate: reconciliations.length > 0 ? 
                    reconciliations.reduce((sum, r) => 
                        sum + (r.totalStatementTransactions > 0 ? r.matchedTransactions / r.totalStatementTransactions : 0), 0) / reconciliations.length * 100 : 0
            };

            // Get unresolved discrepancies
            const unresolvedDiscrepancies = await SecureDataAccess.query('reconciliation_discrepancies',
                { 
                    status: { $ne: this.reconciliationStatuses.RESOLVED },
                    createdDate: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                },
                {},
                context
            );

            return {
                success: true,
                period: { startDate, endDate },
                summary,
                reconciliations,
                unresolvedDiscrepancies,
                recommendations: this.generateRecommendations(summary, unresolvedDiscrepancies)
            };

        } catch (error) {
            console.error(`Error generating reconciliation summary:`, error);
            throw new Error(`Failed to generate reconciliation summary: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    async performAutomaticMatching(statementTransactions, systemPayments) {
        const matched = [];
        const unmatched = [];
        const usedSystemPayments = new Set();

        // First pass: Exact matching
        for (const stmtTxn of statementTransactions) {
            const exactMatch = systemPayments.find(sysPay => 
                !usedSystemPayments.has(sysPay.paymentId) &&
                Math.abs(sysPay.amount - stmtTxn.amount) < 0.01 &&
                this.areDatesClose(sysPay.paymentDate, stmtTxn.transactionDate, 3)
            );

            if (exactMatch) {
                matched.push({
                    statementTransaction: stmtTxn,
                    systemPayment: exactMatch,
                    matchType: this.matchingMethods.EXACT,
                    confidence: 100
                });
                usedSystemPayments.add(exactMatch.paymentId);
            } else {
                // Second pass: Fuzzy matching
                const fuzzyMatch = this.findFuzzyMatch(stmtTxn, systemPayments, usedSystemPayments);
                if (fuzzyMatch && fuzzyMatch.confidence >= 80) {
                    matched.push({
                        statementTransaction: stmtTxn,
                        systemPayment: fuzzyMatch.payment,
                        matchType: this.matchingMethods.FUZZY,
                        confidence: fuzzyMatch.confidence
                    });
                    usedSystemPayments.add(fuzzyMatch.payment.paymentId);
                } else {
                    unmatched.push({
                        statementTransaction: stmtTxn,
                        reason: 'No matching system payment found'
                    });
                }
            }
        }

        // Add unmatched system payments
        const unmatchedSystemPayments = systemPayments.filter(sysPay => 
            !usedSystemPayments.has(sysPay.paymentId)
        );

        unmatchedSystemPayments.forEach(sysPay => {
            unmatched.push({
                systemPayment: sysPay,
                reason: 'No matching statement transaction found'
            });
        });

        return { matched, unmatched };
    }

    findFuzzyMatch(stmtTxn, systemPayments, usedPayments) {
        let bestMatch = null;
        let bestConfidence = 0;

        for (const sysPay of systemPayments) {
            if (usedPayments.has(sysPay.paymentId)) continue;

            let confidence = 0;

            // Amount similarity (40% weight)
            const amountDiff = Math.abs(sysPay.amount - stmtTxn.amount);
            const amountSimilarity = Math.max(0, 100 - (amountDiff / Math.max(sysPay.amount, stmtTxn.amount)) * 100);
            confidence += amountSimilarity * 0.4;

            // Date proximity (30% weight)
            const daysDiff = Math.abs((new Date(sysPay.paymentDate) - new Date(stmtTxn.transactionDate)) / (1000 * 60 * 60 * 24));
            const dateSimilarity = Math.max(0, 100 - daysDiff * 10);
            confidence += dateSimilarity * 0.3;

            // Reference similarity (30% weight)
            const refSimilarity = this.calculateReferenceSimilarity(
                sysPay.reference || sysPay.paymentId,
                stmtTxn.reference || stmtTxn.description
            );
            confidence += refSimilarity * 0.3;

            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                bestMatch = sysPay;
            }
        }

        return bestMatch && bestConfidence >= 60 ? { payment: bestMatch, confidence: Math.round(bestConfidence) } : null;
    }

    async identifyDiscrepancies(matchingResults, statementTransactions, systemPayments) {
        const discrepancies = [];

        // Check unmatched transactions
        for (const unmatched of matchingResults.unmatched) {
            if (unmatched.statementTransaction) {
                discrepancies.push({
                    type: this.discrepancyTypes.UNKNOWN_PAYMENT,
                    description: `Unmatched statement transaction: ${unmatched.statementTransaction.amount}`,
                    statementTransaction: unmatched.statementTransaction,
                    amount: unmatched.statementTransaction.amount,
                    severity: 'medium'
                });
            }

            if (unmatched.systemPayment) {
                discrepancies.push({
                    type: this.discrepancyTypes.MISSING_PAYMENT,
                    description: `System payment not found in statement: ${unmatched.systemPayment.amount}`,
                    systemPayment: unmatched.systemPayment,
                    amount: unmatched.systemPayment.amount,
                    severity: 'high'
                });
            }
        }

        // Check fuzzy matches for potential issues
        const fuzzyMatches = matchingResults.matched.filter(m => m.matchType === this.matchingMethods.FUZZY);
        for (const fuzzyMatch of fuzzyMatches) {
            if (fuzzyMatch.confidence < 90) {
                const amountDiff = Math.abs(fuzzyMatch.statementTransaction.amount - fuzzyMatch.systemPayment.amount);
                if (amountDiff > 0.01) {
                    discrepancies.push({
                        type: this.discrepancyTypes.AMOUNT_MISMATCH,
                        description: `Amount difference: Statement ${fuzzyMatch.statementTransaction.amount}, System ${fuzzyMatch.systemPayment.amount}`,
                        statementTransaction: fuzzyMatch.statementTransaction,
                        systemPayment: fuzzyMatch.systemPayment,
                        amount: amountDiff,
                        severity: amountDiff > 10 ? 'high' : 'low'
                    });
                }
            }
        }

        return discrepancies;
    }

    generateReconciliationId() {
        return `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    calculateStatementBalance(transactions) {
        return transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
    }

    calculateSystemBalance(payments) {
        return payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
    }

    areDatesClose(date1, date2, maxDays) {
        const diff = Math.abs((new Date(date1) - new Date(date2)) / (1000 * 60 * 60 * 24));
        return diff <= maxDays;
    }

    calculateReferenceSimilarity(ref1, ref2) {
        if (!ref1 || !ref2) return 0;
        
        const str1 = ref1.toLowerCase().replace(/[^a-z0-9]/g, '');
        const str2 = ref2.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (str1 === str2) return 100;
        if (str1.includes(str2) || str2.includes(str1)) return 80;
        
        // Simple character similarity
        const commonChars = str1.split('').filter(char => str2.includes(char)).length;
        const maxLength = Math.max(str1.length, str2.length);
        
        return maxLength > 0 ? (commonChars / maxLength) * 100 : 0;
    }

    async createDiscrepancyRecord(reconciliationId, discrepancy, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'createDiscrepancyRecord',
            practiceId: practiceContext.practiceId
        };

        const discrepancyRecord = {
            discrepancyId: `DISC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
            reconciliationId,
            type: discrepancy.type,
            description: discrepancy.description,
            amount: discrepancy.amount,
            severity: discrepancy.severity,
            status: this.reconciliationStatuses.PENDING,
            statementTransaction: discrepancy.statementTransaction,
            systemPayment: discrepancy.systemPayment,
            createdDate: new Date(),
            createdBy: practiceContext.userId,
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.create('reconciliation_discrepancies', discrepancyRecord, context);
        return discrepancyRecord.discrepancyId;
    }

    /**
     * Validation methods
     */
    validateReconciliationRequest(data) {
        const errors = [];
        const processedData = {};

        if (!data.bankAccountId) {
            errors.push('Bank account ID is required');
        } else {
            processedData.bankAccountId = data.bankAccountId;
        }

        if (!data.statementDate) {
            errors.push('Statement date is required');
        } else {
            processedData.statementDate = data.statementDate;
        }

        if (!data.statementTransactions || !Array.isArray(data.statementTransactions)) {
            errors.push('Statement transactions array is required');
        } else {
            processedData.statementTransactions = data.statementTransactions;
        }

        processedData.reconciliationPeriod = data.reconciliationPeriod || {
            startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
            endDate: new Date()
        };

        return { success: errors.length === 0, errors, processedData };
    }
}

// Create instance
const paymentReconciliation = new PaymentReconciliation();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('paymentReconciliationService', () => paymentReconciliation);
}

module.exports = paymentReconciliation;