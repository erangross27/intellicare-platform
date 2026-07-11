/**
 * Cost Analysis Module
 * 
 * Handles comprehensive cost analysis, expense tracking, and profitability analysis
 * for healthcare practice financial management.
 * 
 * Features:
 * - Operating cost analysis and categorization
 * - Cost per patient and service analysis
 * - Budget variance analysis
 * - Cost trend analysis and forecasting
 * - ROI analysis for investments
 * - Break-even analysis
 */

// Use lazy loading to resolve circular dependencies
function getServiceProxy() {
  const ServiceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  return ServiceProxyManager;
}

class CostAnalysis {
    constructor() {
        this.serviceName = 'CostAnalysis';
        this.serviceToken = null;
        this.initialized = false;
        this.costCategories = {
            PERSONNEL: 'personnel',
            EQUIPMENT: 'equipment',
            SUPPLIES: 'supplies',
            FACILITIES: 'facilities',
            TECHNOLOGY: 'technology',
            MARKETING: 'marketing',
            INSURANCE: 'insurance',
            UTILITIES: 'utilities',
            PROFESSIONAL_SERVICES: 'professional_services'
        };
        this.costTypes = {
            FIXED: 'fixed',
            VARIABLE: 'variable',
            SEMI_VARIABLE: 'semi_variable'
        };
        this.analysisTypes = {
            TREND_ANALYSIS: 'trend_analysis',
            VARIANCE_ANALYSIS: 'variance_analysis',
            BREAK_EVEN: 'break_even',
            PROFITABILITY: 'profitability',
            ROI_ANALYSIS: 'roi_analysis'
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
     * Analyze operating costs
     */
    async analyzeOperatingCosts(params, practiceContext) {
        await this.initialize();

        const { startDate, endDate, costCategories, analysisType } = params;

        try {
            // Get cost data for the specified period
            const costData = await this.getCostData(startDate, endDate, costCategories, practiceContext);

            // Perform requested analysis
            let analysisResult;
            switch (analysisType) {
                case this.analysisTypes.TREND_ANALYSIS:
                    analysisResult = await this.performTrendAnalysis(costData, practiceContext);
                    break;
                case this.analysisTypes.VARIANCE_ANALYSIS:
                    analysisResult = await this.performVarianceAnalysis(costData, startDate, endDate, practiceContext);
                    break;
                case this.analysisTypes.BREAK_EVEN:
                    analysisResult = await this.performBreakEvenAnalysis(costData, practiceContext);
                    break;
                case this.analysisTypes.PROFITABILITY:
                    analysisResult = await this.performProfitabilityAnalysis(costData, startDate, endDate, practiceContext);
                    break;
                default:
                    analysisResult = await this.performComprehensiveAnalysis(costData, practiceContext);
            }

            // Generate cost insights
            const insights = await this.generateCostInsights(analysisResult, costData, practiceContext);

            // Store analysis results
            await this.storeCostAnalysis(analysisResult, params, practiceContext);

            return {
                success: true,
                totalCosts: costData.totalAmount,
                period: { startDate, endDate },
                analysis: analysisResult,
                insights,
                recommendations: await this.generateCostRecommendations(analysisResult, practiceContext)
            };

        } catch (error) {
            console.error(`Error analyzing operating costs:`, error);
            throw new Error(`Failed to analyze operating costs: ${error.message}`);
        }
    }

    /**
     * Calculate cost per patient
     */
    async calculateCostPerPatient(params, practiceContext) {
        await this.initialize();

        const { startDate, endDate, includeIndirect } = params;

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'calculateCostPerPatient',
                practiceId: practiceContext.practiceId
            };

            // Get total costs for period
            const totalCosts = await this.getTotalCosts(startDate, endDate, includeIndirect, practiceContext);

            // Get patient volume for period
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            
            const patientVolume = await SecureDataAccess.query('appointments',
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

            const uniquePatients = new Set(patientVolume.map(apt => apt.patientId)).size;
            const totalAppointments = patientVolume.length;

            const costPerPatient = uniquePatients > 0 ? totalCosts.total / uniquePatients : 0;
            const costPerVisit = totalAppointments > 0 ? totalCosts.total / totalAppointments : 0;

            // Break down by cost category
            const costBreakdown = {};
            Object.entries(totalCosts.byCategory).forEach(([category, amount]) => {
                costBreakdown[category] = {
                    totalAmount: amount,
                    costPerPatient: uniquePatients > 0 ? amount / uniquePatients : 0,
                    costPerVisit: totalAppointments > 0 ? amount / totalAppointments : 0
                };
            });

            return {
                success: true,
                period: { startDate, endDate },
                metrics: {
                    totalCosts: totalCosts.total,
                    uniquePatients,
                    totalAppointments,
                    costPerPatient: Math.round(costPerPatient * 100) / 100,
                    costPerVisit: Math.round(costPerVisit * 100) / 100
                },
                costBreakdown
            };

        } catch (error) {
            console.error(`Error calculating cost per patient:`, error);
            throw new Error(`Failed to calculate cost per patient: ${error.message}`);
        }
    }

    /**
     * Perform budget variance analysis
     */
    async performBudgetVarianceAnalysis(params, practiceContext) {
        await this.initialize();

        const { budgetPeriod, actualStartDate, actualEndDate } = params;

        try {
            // Get budget data
            const budgetData = await this.getBudgetData(budgetPeriod, practiceContext);
            
            // Get actual costs
            const actualCosts = await this.getCostData(actualStartDate, actualEndDate, null, practiceContext);

            // Calculate variances
            const varianceAnalysis = {};
            
            Object.values(this.costCategories).forEach(category => {
                const budgeted = budgetData[category] || 0;
                const actual = actualCosts.byCategory[category] || 0;
                const variance = actual - budgeted;
                const percentageVariance = budgeted > 0 ? (variance / budgeted) * 100 : 0;

                varianceAnalysis[category] = {
                    budgeted,
                    actual,
                    variance,
                    percentageVariance: Math.round(percentageVariance * 100) / 100,
                    status: this.getVarianceStatus(percentageVariance)
                };
            });

            // Overall variance
            const totalBudgeted = Object.values(budgetData).reduce((sum, amount) => sum + amount, 0);
            const totalActual = actualCosts.totalAmount;
            const totalVariance = totalActual - totalBudgeted;
            const totalPercentageVariance = totalBudgeted > 0 ? (totalVariance / totalBudgeted) * 100 : 0;

            return {
                success: true,
                summary: {
                    totalBudgeted,
                    totalActual,
                    totalVariance,
                    totalPercentageVariance: Math.round(totalPercentageVariance * 100) / 100,
                    overallStatus: this.getVarianceStatus(totalPercentageVariance)
                },
                categoryAnalysis: varianceAnalysis,
                significantVariances: this.identifySignificantVariances(varianceAnalysis)
            };

        } catch (error) {
            console.error(`Error performing budget variance analysis:`, error);
            throw new Error(`Failed to perform budget variance analysis: ${error.message}`);
        }
    }

    /**
     * Calculate ROI for investments
     */
    async calculateROI(params, practiceContext) {
        await this.initialize();

        const { investmentType, initialInvestment, timeHorizon, expectedBenefits } = params;

        try {
            // Calculate investment returns over time
            const roiAnalysis = {
                investmentType,
                initialInvestment: parseFloat(initialInvestment),
                timeHorizon: parseInt(timeHorizon),
                projectedReturns: [],
                cumulativeROI: 0,
                breakEvenPeriod: null,
                netPresentValue: 0
            };

            let cumulativeBenefit = 0;
            let cumulativeCost = roiAnalysis.initialInvestment;

            // Calculate returns for each period
            for (let period = 1; period <= roiAnalysis.timeHorizon; period++) {
                const periodBenefit = this.calculatePeriodBenefit(expectedBenefits, period);
                const periodCost = this.calculatePeriodCost(investmentType, period);
                
                cumulativeBenefit += periodBenefit;
                cumulativeCost += periodCost;
                
                const periodROI = ((cumulativeBenefit - cumulativeCost) / cumulativeCost) * 100;
                
                roiAnalysis.projectedReturns.push({
                    period,
                    periodBenefit,
                    periodCost,
                    cumulativeBenefit,
                    cumulativeCost,
                    roi: Math.round(periodROI * 100) / 100
                });

                // Determine break-even period
                if (!roiAnalysis.breakEvenPeriod && cumulativeBenefit >= cumulativeCost) {
                    roiAnalysis.breakEvenPeriod = period;
                }
            }

            // Final ROI calculation
            roiAnalysis.cumulativeROI = ((cumulativeBenefit - cumulativeCost) / cumulativeCost) * 100;

            // Calculate NPV (simplified)
            const discountRate = 0.1; // 10% discount rate
            roiAnalysis.netPresentValue = this.calculateNPV(
                roiAnalysis.projectedReturns, 
                roiAnalysis.initialInvestment, 
                discountRate
            );

            return {
                success: true,
                roiAnalysis,
                recommendation: this.generateROIRecommendation(roiAnalysis, practiceContext)
            };

        } catch (error) {
            console.error(`Error calculating ROI:`, error);
            throw new Error(`Failed to calculate ROI: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    async getCostData(startDate, endDate, categories, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getCostData',
            practiceId: practiceContext.practiceId
        };

        const query = {
            expenseDate: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };

        if (categories && categories.length > 0) {
            query.category = { $in: categories };
        }

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        
        const expenses = await SecureDataAccess.query('expenses', query, {}, context);

        // Aggregate by category
        const byCategory = {};
        let totalAmount = 0;

        Object.values(this.costCategories).forEach(category => {
            byCategory[category] = 0;
        });

        expenses.forEach(expense => {
            const category = expense.category || this.costCategories.OTHER;
            byCategory[category] = (byCategory[category] || 0) + (expense.amount || 0);
            totalAmount += expense.amount || 0;
        });

        return {
            expenses,
            byCategory,
            totalAmount,
            period: { startDate, endDate }
        };
    }

    async performTrendAnalysis(costData, practiceContext) {
        // Group costs by month for trend analysis
        const monthlyData = {};
        
        costData.expenses.forEach(expense => {
            const monthKey = new Date(expense.expenseDate).toISOString().slice(0, 7); // YYYY-MM
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { total: 0, byCategory: {} };
            }
            monthlyData[monthKey].total += expense.amount || 0;
            
            const category = expense.category || 'other';
            monthlyData[monthKey].byCategory[category] = 
                (monthlyData[monthKey].byCategory[category] || 0) + (expense.amount || 0);
        });

        // Calculate trends
        const months = Object.keys(monthlyData).sort();
        const totalTrend = this.calculateTrend(months.map(m => monthlyData[m].total));

        const categoryTrends = {};
        Object.values(this.costCategories).forEach(category => {
            const categoryValues = months.map(m => monthlyData[m].byCategory[category] || 0);
            categoryTrends[category] = this.calculateTrend(categoryValues);
        });

        return {
            type: this.analysisTypes.TREND_ANALYSIS,
            totalTrend,
            categoryTrends,
            monthlyData: months.map(month => ({
                month,
                ...monthlyData[month]
            }))
        };
    }

    async performBreakEvenAnalysis(costData, practiceContext) {
        // Get revenue data for the same period
        const revenueData = await this.getRevenueData(costData.period, practiceContext);

        // Separate fixed and variable costs
        const fixedCosts = this.calculateFixedCosts(costData);
        const variableCosts = this.calculateVariableCosts(costData);

        // Calculate average revenue per patient
        const averageRevenuePerPatient = revenueData.totalRevenue / (revenueData.patientCount || 1);

        // Calculate variable cost per patient
        const variableCostPerPatient = variableCosts / (revenueData.patientCount || 1);

        // Break-even calculation
        const contributionMarginPerPatient = averageRevenuePerPatient - variableCostPerPatient;
        const breakEvenPatients = contributionMarginPerPatient > 0 ? 
            fixedCosts / contributionMarginPerPatient : null;

        return {
            type: this.analysisTypes.BREAK_EVEN,
            fixedCosts,
            variableCosts,
            totalCosts: fixedCosts + variableCosts,
            averageRevenuePerPatient,
            variableCostPerPatient,
            contributionMarginPerPatient,
            breakEvenPatients: breakEvenPatients ? Math.ceil(breakEvenPatients) : null,
            currentPatients: revenueData.patientCount,
            patientsAboveBreakEven: revenueData.patientCount - (breakEvenPatients || 0)
        };
    }

    calculateTrend(values) {
        if (values.length < 2) return { direction: 'insufficient_data', slope: 0 };

        const n = values.length;
        const xValues = values.map((_, i) => i);
        const yValues = values;

        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
        const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        let direction;
        if (slope > 0.05) direction = 'increasing';
        else if (slope < -0.05) direction = 'decreasing';
        else direction = 'stable';

        return { direction, slope };
    }

    getVarianceStatus(percentageVariance) {
        const absVariance = Math.abs(percentageVariance);
        if (absVariance <= 5) return 'acceptable';
        else if (absVariance <= 15) return 'monitor';
        else return 'investigate';
    }

    identifySignificantVariances(varianceAnalysis) {
        return Object.entries(varianceAnalysis)
            .filter(([_, variance]) => Math.abs(variance.percentageVariance) > 10)
            .map(([category, variance]) => ({
                category,
                ...variance,
                significance: Math.abs(variance.percentageVariance) > 20 ? 'high' : 'medium'
            }));
    }

    calculatePeriodBenefit(expectedBenefits, period) {
        // Simulate benefit calculation based on investment type
        if (expectedBenefits.type === 'linear') {
            return expectedBenefits.amount;
        } else if (expectedBenefits.type === 'growing') {
            return expectedBenefits.amount * Math.pow(1 + (expectedBenefits.growthRate || 0.05), period - 1);
        }
        return expectedBenefits.amount || 0;
    }

    calculatePeriodCost(investmentType, period) {
        // Simulate ongoing costs
        const maintenanceRates = {
            'equipment': 0.02, // 2% of initial investment per period
            'technology': 0.05, // 5% for technology
            'facility': 0.01    // 1% for facility
        };
        
        return maintenanceRates[investmentType] || 0.02;
    }

    calculateNPV(projectedReturns, initialInvestment, discountRate) {
        let npv = -initialInvestment;
        
        projectedReturns.forEach(returnData => {
            const presentValue = returnData.periodBenefit / Math.pow(1 + discountRate, returnData.period);
            npv += presentValue;
        });
        
        return Math.round(npv * 100) / 100;
    }

    generateROIRecommendation(roiAnalysis, practiceContext) {
        const { cumulativeROI, breakEvenPeriod, netPresentValue } = roiAnalysis;
        
        if (cumulativeROI > 20 && breakEvenPeriod <= 12 && netPresentValue > 0) {
            return {
                recommendation: 'highly_recommended',
                reasoning: 'Strong ROI with reasonable payback period and positive NPV',
                riskLevel: 'low'
            };
        } else if (cumulativeROI > 10 && breakEvenPeriod <= 24) {
            return {
                recommendation: 'recommended',
                reasoning: 'Acceptable ROI with manageable payback period',
                riskLevel: 'medium'
            };
        } else {
            return {
                recommendation: 'not_recommended',
                reasoning: 'ROI below target thresholds or extended payback period',
                riskLevel: 'high'
            };
        }
    }

    async generateCostInsights(analysisResult, costData, practiceContext) {
        const insights = [];

        // Analyze cost distribution
        const sortedCategories = Object.entries(costData.byCategory)
            .sort((a, b) => b[1] - a[1]);
        
        const topCategory = sortedCategories[0];
        if (topCategory && topCategory[1] > costData.totalAmount * 0.3) {
            insights.push({
                type: 'warning',
                message: practiceContext.language === 'he' 
                    ? `קטגוריית ${topCategory[0]} מהווה ${((topCategory[1] / costData.totalAmount) * 100).toFixed(1)}% מהעלויות`
                    : `${topCategory[0]} represents ${((topCategory[1] / costData.totalAmount) * 100).toFixed(1)}% of total costs`
            });
        }

        return insights;
    }

    async generateCostRecommendations(analysisResult, practiceContext) {
        return [
            {
                category: 'cost_optimization',
                priority: 'high',
                recommendation: practiceContext.language === 'he' 
                    ? 'בדוק הזדמנויות לחיסכון בעלויות הגבוהות ביותר'
                    : 'Review opportunities for cost savings in highest expense categories'
            }
        ];
    }

    async auditCostAction(action, details) {
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

// Register service with ServiceProxyManager for lazy loading
const proxy = getServiceProxy();
proxy.registerService('costAnalysis', () => new CostAnalysis());

module.exports = CostAnalysis;