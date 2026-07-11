/**
 * Cost Reporting Functions Service - Billing Insurance Domain
 * Advanced cost reporting and financial analysis functions
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface ReportFilter {
  startDate?: Date;
  endDate?: Date;
  patientIds?: string[];
  providerIds?: string[];
  categories?: string[];
  insuranceProviders?: string[];
}

export interface FinancialMetrics {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  averageRevenuePerPatient: number;
  collectionRate: number;
  outstandingBalance: number;
}

@Injectable()
export class CostReportingFunctionsService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('cost-reporting-functions-service');
      this.initialized = true;
      console.log('✅ Cost Reporting Functions Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Cost Reporting Functions Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'cost-reporting-functions-service',
      operation: 'cost_reporting',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  async generateFinancialReport(filter: ReportFilter, clinicId?: string): Promise<{
    metrics: FinancialMetrics;
    breakdown: any;
    trends: any;
  }> {
    const context = this.getServiceContext(clinicId);
    
    // Build query from filter
    const query: any = { clinicId: clinicId || 'global' };
    if (filter.startDate || filter.endDate) {
      query.date = {};
      if (filter.startDate) query.date.$gte = filter.startDate;
      if (filter.endDate) query.date.$lte = filter.endDate;
    }
    if (filter.patientIds?.length) query.patientId = { $in: filter.patientIds };
    if (filter.providerIds?.length) query.providerId = { $in: filter.providerIds };
    if (filter.categories?.length) query.category = { $in: filter.categories };

    const costs = await SecureDataAccess.query('cost_entries', query, {}, context);
    const payments = await SecureDataAccess.query('payments', query, {}, context);

    const metrics = this.calculateFinancialMetrics(costs, payments);
    const breakdown = this.generateCostBreakdown(costs);
    const trends = this.calculateTrends(costs, payments);

    return { metrics, breakdown, trends };
  }

  private calculateFinancialMetrics(costs: any[], payments: any[]): FinancialMetrics {
    const totalRevenue = costs.reduce((sum, c) => sum + (c.cost || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const outstandingBalance = totalRevenue - totalPaid;
    const uniquePatients = new Set(costs.map(c => c.patientId)).size;

    return {
      totalRevenue,
      totalCosts: totalRevenue * 0.7, // Estimated costs (70% of revenue)
      netProfit: totalRevenue * 0.3,
      profitMargin: 30, // Estimated 30% margin
      averageRevenuePerPatient: uniquePatients > 0 ? totalRevenue / uniquePatients : 0,
      collectionRate: totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0,
      outstandingBalance
    };
  }

  private generateCostBreakdown(costs: any[]): any {
    const breakdown = {
      byCategory: {} as Record<string, number>,
      byProvider: {} as Record<string, number>,
      byMonth: {} as Record<string, number>
    };

    costs.forEach(cost => {
      // By category
      breakdown.byCategory[cost.category] = (breakdown.byCategory[cost.category] || 0) + cost.cost;
      
      // By provider
      breakdown.byProvider[cost.providerId] = (breakdown.byProvider[cost.providerId] || 0) + cost.cost;
      
      // By month
      const monthKey = new Date(cost.date).toISOString().substring(0, 7);
      breakdown.byMonth[monthKey] = (breakdown.byMonth[monthKey] || 0) + cost.cost;
    });

    return breakdown;
  }

  private calculateTrends(costs: any[], payments: any[]): any {
    return {
      revenueGrowth: this.calculateGrowthRate(costs, 'cost'),
      paymentTrends: this.calculateGrowthRate(payments, 'amount'),
      seasonal: this.identifySeasonalPatterns(costs)
    };
  }

  private calculateGrowthRate(data: any[], field: string): number {
    if (data.length < 2) return 0;
    
    const sorted = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    
    const firstTotal = firstHalf.reduce((sum, item) => sum + (item[field] || 0), 0);
    const secondTotal = secondHalf.reduce((sum, item) => sum + (item[field] || 0), 0);
    
    return firstTotal > 0 ? ((secondTotal - firstTotal) / firstTotal) * 100 : 0;
  }

  private identifySeasonalPatterns(costs: any[]): Record<string, number> {
    const monthlyAverages: Record<string, number> = {};
    const monthlyCounts: Record<string, number> = {};
    
    costs.forEach(cost => {
      const month = new Date(cost.date).toLocaleString('default', { month: 'long' });
      monthlyAverages[month] = (monthlyAverages[month] || 0) + cost.cost;
      monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
    });
    
    // Calculate averages
    Object.keys(monthlyAverages).forEach(month => {
      monthlyAverages[month] = monthlyAverages[month] / monthlyCounts[month];
    });
    
    return monthlyAverages;
  }

  async exportReport(reportData: any, format: 'csv' | 'pdf' | 'excel'): Promise<string> {
    // Simplified implementation - would generate actual file
    const exportId = require('crypto').randomUUID();
    const filename = `financial_report_${Date.now()}.${format}`;
    
    // In real implementation, would generate file and store in secure location
    console.log(`Exporting report as ${format}: ${filename}`);
    
    return exportId;
  }
}