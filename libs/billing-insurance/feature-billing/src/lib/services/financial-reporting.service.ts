/**
 * Financial Reporting Service - Billing Insurance Domain
 * 
 * Comprehensive financial reporting and analysis system providing:
 * - Revenue analytics by service line, provider, and payer
 * - Cost management with detailed breakdown and variance analysis
 * - Profitability analysis across multiple dimensions
 * - Financial forecasting with predictive modeling
 * - ROI analysis and scenario planning capabilities
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface DateRange {
  start: Date;
  end: Date;
}

export interface RevenueCategory {
  name: string;
  serviceLines: string[];
  marginTargets: Record<string, number>;
  seasonality: Record<string, number>;
}

export interface CostCenter {
  name: string;
  category: string;
  budgetTarget: number;
  costDrivers: string[];
}

export interface PayerType {
  code: string;
  name: string;
}

export interface ForecastingModel {
  name: string;
  parameters: Record<string, any>;
  accuracy: number;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionSize: number;
  maxTransaction: number;
  minTransaction: number;
  previousPeriodRevenue: number;
  growthRate: number;
  dailyAverage: number;
}

export interface ServiceLineAnalysis {
  serviceLine: string;
  revenue: number;
  transactionCount: number;
  averageAmount: number;
  percentage: number;
  marginTarget: number;
}

export interface ProviderAnalysis {
  providerId: string;
  providerName: string;
  specialty: string;
  revenue: number;
  uniquePatients: number;
  transactionCount: number;
  revenuePerPatient: number;
  revenuePerTransaction: number;
}

export interface PayerAnalysis {
  payerType: string;
  revenue: number;
  percentage: number;
  claimsCount: number;
  averageReimbursement: number;
  collectionRate: number;
  daysInAR: number;
}

export interface RevenueAnalytics {
  summary: RevenueSummary;
  byServiceLine: ServiceLineAnalysis[];
  byProvider: ProviderAnalysis[];
  byPayer: PayerAnalysis[];
  trends: any;
  profitability: any;
}

export interface CostSummary {
  totalCosts: number;
  totalTransactions: number;
  averageCost: number;
}

export interface CostCenterAnalysis {
  costCenter: string;
  costCenterName: string;
  category: string;
  totalCost: number;
  percentage: number;
  transactionCount: number;
  averageCost: number;
  budgetTarget: number;
}

export interface CostAnalysis {
  summary: CostSummary;
  byCostCenter: CostCenterAnalysis[];
  byCategory: any[];
  budgetVariance: any;
  efficiency: any;
}

export interface ServiceLineProfitability {
  serviceLine: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  marginTarget: number;
  varianceFromTarget: number;
}

export interface ProfitabilityAnalysis {
  summary: {
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
    grossMargin: number;
    revenueGrowth: number;
  };
  serviceLines: ServiceLineProfitability[];
  patients: any[];
  benchmarks: any;
}

export interface HistoricalDataPoint {
  date: Date;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ForecastPoint {
  date: Date;
  revenue: number;
  confidence: number;
}

export interface FinancialForecast {
  model: string;
  forecast: ForecastPoint[];
  accuracy: number;
}

export interface BudgetVariance {
  totalBudget: number;
  actualSpending: number;
  variance: number;
  variancePercentage: number;
}

export interface EfficiencyMetrics {
  costPerPatient: number;
  revenuePerPatient: number;
  profitPerPatient: number;
}

export interface ProfitabilityBenchmarks {
  industryAverage: number;
  topQuartile: number;
  bottomQuartile: number;
}

@Injectable()
export class FinancialReportingService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  
  private revenueCategories = new Map<string, RevenueCategory>();
  private costCenters = new Map<string, CostCenter>();
  private payerTypes = new Map<string, PayerType>();
  private forecastingModels = new Map<string, ForecastingModel>();
  private financialMetrics = new Map<string, any>();
  private reportTemplates = new Map<string, any>();
  private budgetTargets = new Map<string, number>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;

    try {
      this.serviceToken = await serviceAccountManager.authenticate('financial-reporting-service');
      await this.loadRevenueCategories();
      await this.initializeCostCenters();
      await this.loadPayerTypes();
      await this.setupForecastingModels();
      await this.loadBudgetTargets();
      await this.initializeReportTemplates();
      this.initialized = true;
      console.log('✅ Financial Reporting Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Financial Reporting Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'financial-reporting-service',
      operation: 'financial_reporting',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  // ========== REVENUE ANALYTICS ==========

  private async loadRevenueCategories(): Promise<void> {
    const context = this.getServiceContext();
    
    try {
      const categories = await SecureDataAccess.query('revenue_categories',
        { active: true },
        { sort: { priority: -1 } },
        context
      );

      for (const category of categories) {
        this.revenueCategories.set(category.code, {
          name: category.name,
          serviceLines: category.serviceLines || [],
          marginTargets: category.marginTargets || {},
          seasonality: category.seasonality || {}
        });
      }
    } catch (error) {
      console.warn('Could not load revenue categories from database:', error.message);
    }

    // Default healthcare revenue categories
    const defaultCategories = [
      { code: 'CONSULTATION', name: 'Medical Consultations', marginTargets: { gross: 0.65 } },
      { code: 'DIAGNOSTIC', name: 'Diagnostic Services', marginTargets: { gross: 0.45 } },
      { code: 'TREATMENT', name: 'Treatment Procedures', marginTargets: { gross: 0.55 } },
      { code: 'EMERGENCY', name: 'Emergency Services', marginTargets: { gross: 0.35 } },
      { code: 'SURGERY', name: 'Surgical Procedures', marginTargets: { gross: 0.70 } }
    ];

    for (const category of defaultCategories) {
      if (!this.revenueCategories.has(category.code)) {
        this.revenueCategories.set(category.code, {
          name: category.name,
          serviceLines: [],
          marginTargets: category.marginTargets,
          seasonality: {}
        });
      }
    }
  }

  async generateRevenueAnalytics(
    dateRange: DateRange, 
    clinicId: string, 
    dimensions: string[] = []
  ): Promise<RevenueAnalytics> {
    const context = this.getServiceContext(clinicId);

    try {
      const analytics: RevenueAnalytics = {
        summary: await this.calculateRevenueSummary(dateRange, clinicId),
        byServiceLine: await this.analyzeRevenueByServiceLine(dateRange, clinicId),
        byProvider: await this.analyzeRevenueByProvider(dateRange, clinicId),
        byPayer: await this.analyzeRevenueByPayer(dateRange, clinicId),
        trends: await this.analyzeRevenueTrends(dateRange, clinicId),
        profitability: await this.analyzeProfitability(dateRange, clinicId)
      };

      await this.logServiceOperation('REVENUE_ANALYTICS_GENERATED', { 
        dateRange, 
        clinicId, 
        dimensions 
      }, clinicId);

      return analytics;
    } catch (error) {
      console.error('Error generating revenue analytics:', error);
      throw error;
    }
  }

  private async calculateRevenueSummary(dateRange: DateRange, clinicId: string): Promise<RevenueSummary> {
    const context = this.getServiceContext(clinicId);

    const pipeline = [
      {
        $match: {
          clinicId,
          transactionDate: { $gte: dateRange.start, $lte: dateRange.end },
          status: 'completed',
          type: 'revenue'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          averageTransactionSize: { $avg: '$amount' },
          maxTransaction: { $max: '$amount' },
          minTransaction: { $min: '$amount' }
        }
      }
    ];

    const result = await SecureDataAccess.aggregate('financial_transactions', pipeline, context);

    const summary = result[0] || {
      totalRevenue: 0,
      totalTransactions: 0,
      averageTransactionSize: 0,
      maxTransaction: 0,
      minTransaction: 0
    };

    // Calculate previous period for comparison
    const previousDateRange = {
      start: new Date(dateRange.start.getTime() - (dateRange.end.getTime() - dateRange.start.getTime())),
      end: dateRange.start
    };

    const previousPeriod = await SecureDataAccess.aggregate('financial_transactions', [
      {
        $match: {
          clinicId,
          transactionDate: { $gte: previousDateRange.start, $lte: previousDateRange.end },
          status: 'completed',
          type: 'revenue'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' }
        }
      }
    ], context);

    const previousRevenue = previousPeriod[0]?.totalRevenue || 0;
    const growthRate = previousRevenue > 0 ? ((summary.totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    return {
      ...summary,
      previousPeriodRevenue: previousRevenue,
      growthRate,
      dailyAverage: summary.totalRevenue / Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
    };
  }

  private async analyzeRevenueByServiceLine(dateRange: DateRange, clinicId: string): Promise<ServiceLineAnalysis[]> {
    const context = this.getServiceContext(clinicId);

    const pipeline = [
      {
        $match: {
          clinicId,
          transactionDate: { $gte: dateRange.start, $lte: dateRange.end },
          status: 'completed',
          type: 'revenue'
        }
      },
      {
        $group: {
          _id: '$serviceCategory',
          revenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ];

    const results = await SecureDataAccess.aggregate('financial_transactions', pipeline, context);
    const totalRevenue = results.reduce((sum: number, item: any) => sum + item.revenue, 0);

    return results.map((item: any) => ({
      serviceLine: item._id,
      revenue: item.revenue,
      transactionCount: item.transactionCount,
      averageAmount: item.averageAmount,
      percentage: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0,
      marginTarget: this.revenueCategories.get(item._id)?.marginTargets?.gross || 0
    }));
  }

  private async analyzeRevenueByProvider(dateRange: DateRange, clinicId: string): Promise<ProviderAnalysis[]> {
    const context = this.getServiceContext(clinicId);

    const pipeline = [
      {
        $match: {
          clinicId,
          transactionDate: { $gte: dateRange.start, $lte: dateRange.end },
          status: 'completed',
          type: 'revenue'
        }
      },
      {
        $group: {
          _id: '$providerId',
          revenue: { $sum: '$amount' },
          patientCount: { $addToSet: '$patientId' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $addFields: {
          uniquePatients: { $size: '$patientCount' },
          revenuePerPatient: { $divide: ['$revenue', { $size: '$patientCount' }] }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ];

    const results = await SecureDataAccess.aggregate('financial_transactions', pipeline, context);
    const enrichedResults: ProviderAnalysis[] = [];

    for (const result of results) {
      try {
        const provider = await SecureDataAccess.findById('providers', result._id, context);

        enrichedResults.push({
          providerId: result._id,
          providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown',
          specialty: provider?.specialty || 'Unknown',
          revenue: result.revenue,
          uniquePatients: result.uniquePatients,
          transactionCount: result.transactionCount,
          revenuePerPatient: result.revenuePerPatient,
          revenuePerTransaction: result.revenue / result.transactionCount
        });
      } catch (error) {
        console.warn(`Could not enrich provider data for ${result._id}:`, error.message);
        enrichedResults.push({
          providerId: result._id,
          providerName: 'Unknown',
          specialty: 'Unknown',
          revenue: result.revenue,
          uniquePatients: result.uniquePatients,
          transactionCount: result.transactionCount,
          revenuePerPatient: result.revenuePerPatient,
          revenuePerTransaction: result.revenue / result.transactionCount
        });
      }
    }

    return enrichedResults;
  }

  private async analyzeRevenueByPayer(dateRange: DateRange, clinicId: string): Promise<PayerAnalysis[]> {
    const context = this.getServiceContext(clinicId);

    const pipeline = [
      {
        $match: {
          clinicId,
          transactionDate: { $gte: dateRange.start, $lte: dateRange.end },
          status: 'completed',
          type: 'revenue'
        }
      },
      {
        $group: {
          _id: '$payerType',
          revenue: { $sum: '$amount' },
          claimsCount: { $sum: 1 },
          averageReimbursement: { $avg: '$amount' },
          totalBilled: { $sum: '$billedAmount' },
          totalPaid: { $sum: '$paidAmount' }
        }
      },
      {
        $addFields: {
          collectionRate: { 
            $cond: [
              { $gt: ['$totalBilled', 0] },
              { $divide: ['$totalPaid', '$totalBilled'] },
              0
            ]
          }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ];

    const results = await SecureDataAccess.aggregate('financial_transactions', pipeline, context);
    const totalRevenue = results.reduce((sum: number, item: any) => sum + item.revenue, 0);

    const payerAnalyses: PayerAnalysis[] = [];
    for (const item of results) {
      const daysInAR = await this.calculateDaysInAR(item._id, clinicId);
      
      payerAnalyses.push({
        payerType: item._id,
        revenue: item.revenue,
        percentage: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0,
        claimsCount: item.claimsCount,
        averageReimbursement: item.averageReimbursement,
        collectionRate: item.collectionRate * 100,
        daysInAR
      });
    }

    return payerAnalyses;
  }

  // ========== COST MANAGEMENT ==========

  private async initializeCostCenters(): Promise<void> {
    const context = this.getServiceContext();
    
    try {
      const costCenters = await SecureDataAccess.query('cost_centers',
        { active: true },
        {},
        context
      );

      for (const center of costCenters) {
        this.costCenters.set(center.code, {
          name: center.name,
          category: center.category,
          budgetTarget: center.budgetTarget || 0,
          costDrivers: center.costDrivers || []
        });
      }
    } catch (error) {
      console.warn('Could not load cost centers from database:', error.message);
    }

    // Default healthcare cost centers
    const defaultCenters = [
      { code: 'CLINICAL', name: 'Clinical Operations', category: 'Direct' },
      { code: 'ADMIN', name: 'Administration', category: 'Indirect' },
      { code: 'FACILITIES', name: 'Facilities & Equipment', category: 'Fixed' },
      { code: 'IT', name: 'Information Technology', category: 'Overhead' },
      { code: 'MARKETING', name: 'Marketing & Outreach', category: 'Variable' }
    ];

    for (const center of defaultCenters) {
      if (!this.costCenters.has(center.code)) {
        this.costCenters.set(center.code, {
          name: center.name,
          category: center.category,
          budgetTarget: 0,
          costDrivers: []
        });
      }
    }
  }

  async generateCostAnalysis(dateRange: DateRange, clinicId: string): Promise<CostAnalysis> {
    const context = this.getServiceContext(clinicId);

    try {
      const analysis: CostAnalysis = {
        summary: await this.calculateCostSummary(dateRange, clinicId),
        byCostCenter: await this.analyzeCostsByCostCenter(dateRange, clinicId),
        byCategory: await this.analyzeCostsByCategory(dateRange, clinicId),
        budgetVariance: await this.analyzeBudgetVariance(dateRange, clinicId),
        efficiency: await this.calculateEfficiencyMetrics(dateRange, clinicId)
      };

      await this.logServiceOperation('COST_ANALYSIS_GENERATED', { 
        dateRange, 
        clinicId 
      }, clinicId);

      return analysis;
    } catch (error) {
      console.error('Error generating cost analysis:', error);
      throw error;
    }
  }

  private async calculateCostSummary(dateRange: DateRange, clinicId: string): Promise<CostSummary> {
    const context = this.getServiceContext(clinicId);

    const pipeline = [
      {
        $match: {
          clinicId,
          transactionDate: { $gte: dateRange.start, $lte: dateRange.end },
          type: 'expense'
        }
      },
      {
        $group: {
          _id: null,
          totalCosts: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          averageCost: { $avg: '$amount' }
        }
      }
    ];

    const result = await SecureDataAccess.aggregate('financial_transactions', pipeline, context);

    return result[0] || {
      totalCosts: 0,
      totalTransactions: 0,
      averageCost: 0
    };
  }

  private async analyzeCostsByCostCenter(dateRange: DateRange, clinicId: string): Promise<CostCenterAnalysis[]> {
    const context = this.getServiceContext(clinicId);

    const pipeline = [
      {
        $match: {
          clinicId,
          transactionDate: { $gte: dateRange.start, $lte: dateRange.end },
          type: 'expense'
        }
      },
      {
        $group: {
          _id: '$costCenter',
          totalCost: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageCost: { $avg: '$amount' }
        }
      },
      {
        $sort: { totalCost: -1 }
      }
    ];

    const results = await SecureDataAccess.aggregate('financial_transactions', pipeline, context);
    const totalCosts = results.reduce((sum: number, item: any) => sum + item.totalCost, 0);

    return results.map((item: any) => ({
      costCenter: item._id,
      costCenterName: this.costCenters.get(item._id)?.name || item._id,
      category: this.costCenters.get(item._id)?.category || 'Unknown',
      totalCost: item.totalCost,
      percentage: totalCosts > 0 ? (item.totalCost / totalCosts) * 100 : 0,
      transactionCount: item.transactionCount,
      averageCost: item.averageCost,
      budgetTarget: this.costCenters.get(item._id)?.budgetTarget || 0
    }));
  }

  // ========== PROFITABILITY ANALYSIS ==========

  async analyzeProfitability(dateRange: DateRange, clinicId: string): Promise<ProfitabilityAnalysis> {
    const [revenues, costs] = await Promise.all([
      this.calculateRevenueSummary(dateRange, clinicId),
      this.calculateCostSummary(dateRange, clinicId)
    ]);

    const grossProfit = revenues.totalRevenue - costs.totalCosts;
    const grossMargin = revenues.totalRevenue > 0 ? (grossProfit / revenues.totalRevenue) * 100 : 0;

    const serviceLineProfitability = await this.analyzeServiceLineProfitability(dateRange, clinicId);
    const patientProfitability = await this.analyzePatientProfitability(dateRange, clinicId);

    return {
      summary: {
        totalRevenue: revenues.totalRevenue,
        totalCosts: costs.totalCosts,
        grossProfit,
        grossMargin,
        revenueGrowth: revenues.growthRate
      },
      serviceLines: serviceLineProfitability,
      patients: patientProfitability,
      benchmarks: await this.getProfitabilityBenchmarks(clinicId)
    };
  }

  private async analyzeServiceLineProfitability(dateRange: DateRange, clinicId: string): Promise<ServiceLineProfitability[]> {
    const context = this.getServiceContext(clinicId);
    
    const revenuesByService = await this.analyzeRevenueByServiceLine(dateRange, clinicId);
    
    const costsByService = await SecureDataAccess.aggregate('financial_transactions', [
      {
        $match: {
          clinicId,
          transactionDate: { $gte: dateRange.start, $lte: dateRange.end },
          type: 'expense'
        }
      },
      {
        $group: {
          _id: '$serviceCategory',
          totalCost: { $sum: '$amount' }
        }
      }
    ], context);

    const costMap = new Map(costsByService.map((c: any) => [c._id, c.totalCost]));

    return revenuesByService.map(service => {
      const costs = costMap.get(service.serviceLine) || 0;
      const profit = service.revenue - costs;
      const margin = service.revenue > 0 ? (profit / service.revenue) * 100 : 0;

      return {
        serviceLine: service.serviceLine,
        revenue: service.revenue,
        costs,
        profit,
        margin,
        marginTarget: service.marginTarget * 100,
        varianceFromTarget: margin - (service.marginTarget * 100)
      };
    });
  }

  // ========== FINANCIAL FORECASTING ==========

  private async setupForecastingModels(): Promise<void> {
    this.forecastingModels.set('linear_regression', {
      name: 'Linear Regression',
      parameters: { lookbackPeriods: 12 },
      accuracy: 0.85
    });

    this.forecastingModels.set('seasonal_arima', {
      name: 'Seasonal ARIMA',
      parameters: { seasonality: 12, trend: true },
      accuracy: 0.90
    });

    this.forecastingModels.set('moving_average', {
      name: 'Moving Average',
      parameters: { periods: 6 },
      accuracy: 0.75
    });
  }

  async generateFinancialForecast(
    forecastPeriods: number, 
    clinicId: string, 
    modelType = 'linear_regression'
  ): Promise<FinancialForecast> {
    try {
      const historicalData = await this.getHistoricalFinancialData(clinicId, 24);
      const model = this.forecastingModels.get(modelType);
      
      if (!model) {
        throw new Error(`Forecasting model not found: ${modelType}`);
      }

      const forecast = await this.applyForecastingModel(historicalData, forecastPeriods, model);

      await this.logServiceOperation('FINANCIAL_FORECAST_GENERATED', { 
        forecastPeriods, 
        modelType, 
        clinicId 
      }, clinicId);

      return forecast;
    } catch (error) {
      console.error('Error generating financial forecast:', error);
      throw error;
    }
  }

  private async getHistoricalFinancialData(clinicId: string, periods: number): Promise<HistoricalDataPoint[]> {
    const context = this.getServiceContext(clinicId);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periods);

    const pipeline = [
      {
        $match: {
          clinicId,
          transactionDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$transactionDate' },
            month: { $month: '$transactionDate' },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: { year: '$_id.year', month: '$_id.month' },
          revenue: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'revenue'] }, '$total', 0]
            }
          },
          expenses: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0]
            }
          }
        }
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1
            }
          },
          profit: { $subtract: ['$revenue', '$expenses'] }
        }
      },
      {
        $sort: { date: 1 }
      }
    ];

    return await SecureDataAccess.aggregate('financial_transactions', pipeline, context);
  }

  private async applyForecastingModel(
    historicalData: HistoricalDataPoint[], 
    periods: number, 
    model: ForecastingModel
  ): Promise<FinancialForecast> {
    switch (model.name) {
      case 'Linear Regression':
        return await this.applyLinearRegression(historicalData, periods);
      case 'Seasonal ARIMA':
        return await this.applySeasonalArima(historicalData, periods);
      case 'Moving Average':
        return await this.applyMovingAverage(historicalData, periods);
      default:
        throw new Error(`Unknown forecasting model: ${model.name}`);
    }
  }

  private async applyLinearRegression(data: HistoricalDataPoint[], periods: number): Promise<FinancialForecast> {
    const revenues = data.map((d, i) => ({ x: i, y: d.revenue }));
    const n = revenues.length;
    
    const sumX = revenues.reduce((sum, p) => sum + p.x, 0);
    const sumY = revenues.reduce((sum, p) => sum + p.y, 0);
    const sumXY = revenues.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = revenues.reduce((sum, p) => sum + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const forecast: ForecastPoint[] = [];
    const lastDate = new Date(data[data.length - 1].date);

    for (let i = 1; i <= periods; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      
      const predictedRevenue = intercept + slope * (n + i - 1);
      
      forecast.push({
        date: forecastDate,
        revenue: Math.max(0, predictedRevenue),
        confidence: Math.max(0.5, 0.9 - (i * 0.05))
      });
    }

    return {
      model: 'Linear Regression',
      forecast,
      accuracy: 0.85
    };
  }

  // ========== UTILITY METHODS ==========

  private async loadPayerTypes(): Promise<void> {
    const context = this.getServiceContext();
    
    try {
      const payers = await SecureDataAccess.query('payer_types',
        { active: true },
        {},
        context
      );

      for (const payer of payers) {
        this.payerTypes.set(payer.code, payer);
      }
    } catch (error) {
      console.warn('Could not load payer types from database:', error.message);
    }

    // Default payer types
    const defaultPayers = [
      { code: 'INSURANCE', name: 'Insurance' },
      { code: 'SELF_PAY', name: 'Self Pay' },
      { code: 'GOVERNMENT', name: 'Government' },
      { code: 'EMPLOYER', name: 'Employer' }
    ];

    for (const payer of defaultPayers) {
      if (!this.payerTypes.has(payer.code)) {
        this.payerTypes.set(payer.code, payer);
      }
    }
  }

  private async loadBudgetTargets(): Promise<void> {
    const context = this.getServiceContext();
    
    try {
      const budgets = await SecureDataAccess.query('budget_targets',
        { active: true, year: new Date().getFullYear() },
        {},
        context
      );

      for (const budget of budgets) {
        this.budgetTargets.set(`${budget.category}_${budget.period}`, budget.target);
      }
    } catch (error) {
      console.warn('Could not load budget targets from database:', error.message);
    }
  }

  private async initializeReportTemplates(): Promise<void> {
    this.reportTemplates.set('executive_summary', {
      sections: ['revenue_summary', 'cost_summary', 'profitability', 'kpis'],
      format: 'executive'
    });

    this.reportTemplates.set('detailed_financial', {
      sections: ['revenue_analytics', 'cost_analysis', 'profitability', 'forecasting'],
      format: 'detailed'
    });
  }

  private async calculateDaysInAR(payerType: string, clinicId: string): Promise<number> {
    const context = this.getServiceContext(clinicId);

    try {
      const pipeline = [
        {
          $match: {
            clinicId,
            payerType,
            status: 'pending'
          }
        },
        {
          $group: {
            _id: null,
            averageDays: {
              $avg: {
                $divide: [
                  { $subtract: [new Date(), '$billedDate'] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        }
      ];

      const result = await SecureDataAccess.aggregate('claims', pipeline, context);
      return result[0]?.averageDays || 0;
    } catch (error) {
      console.warn('Could not calculate days in AR:', error.message);
      return 0;
    }
  }

  // ========== PLACEHOLDER IMPLEMENTATIONS ==========

  private async analyzeRevenueTrends(dateRange: DateRange, clinicId: string): Promise<any> {
    return {}; // Placeholder
  }

  private async analyzeCostsByCategory(dateRange: DateRange, clinicId: string): Promise<any[]> {
    return []; // Placeholder
  }

  private async analyzeBudgetVariance(dateRange: DateRange, clinicId: string): Promise<BudgetVariance> {
    return {
      totalBudget: 1000000,
      actualSpending: 950000,
      variance: -50000,
      variancePercentage: -5.0
    };
  }

  private async calculateEfficiencyMetrics(dateRange: DateRange, clinicId: string): Promise<EfficiencyMetrics> {
    return {
      costPerPatient: 150,
      revenuePerPatient: 200,
      profitPerPatient: 50
    };
  }

  private async analyzePatientProfitability(dateRange: DateRange, clinicId: string): Promise<any[]> {
    return []; // Placeholder
  }

  private async getProfitabilityBenchmarks(clinicId: string): Promise<ProfitabilityBenchmarks> {
    return {
      industryAverage: 15.2,
      topQuartile: 22.5,
      bottomQuartile: 8.1
    };
  }

  private async applySeasonalArima(data: HistoricalDataPoint[], periods: number): Promise<FinancialForecast> {
    const revenues = data.map(d => d.revenue);
    const seasonalFactor = this.calculateSeasonalFactor(revenues);
    
    const forecast: ForecastPoint[] = [];
    const lastDate = new Date(data[data.length - 1].date);
    const avgRevenue = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;

    for (let i = 1; i <= periods; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      
      const seasonalIndex = (i - 1) % 12;
      const predictedRevenue = avgRevenue * seasonalFactor[seasonalIndex];
      
      forecast.push({
        date: forecastDate,
        revenue: predictedRevenue,
        confidence: 0.9
      });
    }

    return { model: 'Seasonal ARIMA', forecast, accuracy: 0.90 };
  }

  private async applyMovingAverage(data: HistoricalDataPoint[], periods: number): Promise<FinancialForecast> {
    const movingPeriods = 6;
    const revenues = data.slice(-movingPeriods).map(d => d.revenue);
    const average = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;

    const forecast: ForecastPoint[] = [];
    const lastDate = new Date(data[data.length - 1].date);

    for (let i = 1; i <= periods; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      
      forecast.push({
        date: forecastDate,
        revenue: average,
        confidence: 0.75
      });
    }

    return { model: 'Moving Average', forecast, accuracy: 0.75 };
  }

  private calculateSeasonalFactor(revenues: number[]): number[] {
    const monthlyAverages = new Array(12).fill(0);
    const monthlyCounts = new Array(12).fill(0);

    revenues.forEach((revenue, index) => {
      const month = index % 12;
      monthlyAverages[month] += revenue;
      monthlyCounts[month]++;
    });

    const overallAverage = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;
    
    return monthlyAverages.map((sum, i) => {
      const monthAvg = monthlyCounts[i] > 0 ? sum / monthlyCounts[i] : overallAverage;
      return overallAverage > 0 ? monthAvg / overallAverage : 1;
    });
  }

  // ========== AUDIT LOGGING ==========

  private async logServiceOperation(operation: string, details: any, clinicId?: string) {
    const context = this.getServiceContext(clinicId);

    try {
      await SecureDataAccess.insert('audit_logs', {
        action: operation,
        resourceType: 'financial_reporting',
        userId: 'system',
        details: details,
        timestamp: new Date()
      }, context);
    } catch (error) {
      console.error('Failed to log service operation:', error);
    }
  }
}