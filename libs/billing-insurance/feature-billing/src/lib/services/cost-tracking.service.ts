/**
 * Cost Tracking Service - Billing Insurance Domain
 * Comprehensive cost tracking and analysis for healthcare services
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface CostEntry {
  id: string;
  patientId: string;
  serviceCode: string;
  serviceName: string;
  providerId: string;
  cost: number;
  insuranceCovered: number;
  patientResponsibility: number;
  date: Date;
  category: 'consultation' | 'procedure' | 'medication' | 'lab' | 'imaging' | 'other';
  status: 'pending' | 'approved' | 'denied' | 'paid';
}

export interface CostSummary {
  totalCosts: number;
  insuranceCovered: number;
  patientOwed: number;
  pendingApproval: number;
  categoryBreakdown: Record<string, number>;
  monthlyTrends: Array<{ month: string; total: number }>;
}

@Injectable()
export class CostTrackingService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('cost-tracking-service');
      this.initialized = true;
      console.log('✅ Cost Tracking Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Cost Tracking Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'cost-tracking-service',
      operation: 'cost_tracking',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  async addCostEntry(entry: Omit<CostEntry, 'id'>, clinicId?: string): Promise<string> {
    const context = this.getServiceContext(clinicId);
    
    const costEntry: CostEntry = {
      ...entry,
      id: require('crypto').randomUUID()
    };

    await SecureDataAccess.insert('cost_entries', {
      ...costEntry,
      clinicId: clinicId || 'global',
      createdAt: new Date()
    }, context);

    // Log cost entry creation
    await SecureDataAccess.insert('audit_logs', {
      action: 'COST_ENTRY_CREATED',
      details: { 
        costId: costEntry.id, 
        patientId: entry.patientId,
        amount: entry.cost,
        category: entry.category
      },
      timestamp: new Date(),
      serviceId: 'cost-tracking-service'
    }, context);

    return costEntry.id;
  }

  async getPatientCosts(patientId: string, clinicId?: string): Promise<CostEntry[]> {
    const context = this.getServiceContext(clinicId);
    
    return await SecureDataAccess.query('cost_entries', {
      patientId,
      clinicId: clinicId || 'global'
    }, {
      sort: { date: -1 }
    }, context);
  }

  async getCostSummary(patientId?: string, startDate?: Date, endDate?: Date, clinicId?: string): Promise<CostSummary> {
    const context = this.getServiceContext(clinicId);
    const query: any = { clinicId: clinicId || 'global' };
    
    if (patientId) query.patientId = patientId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const costs = await SecureDataAccess.query('cost_entries', query, {}, context);
    
    const summary: CostSummary = {
      totalCosts: costs.reduce((sum, c) => sum + c.cost, 0),
      insuranceCovered: costs.reduce((sum, c) => sum + c.insuranceCovered, 0),
      patientOwed: costs.reduce((sum, c) => sum + c.patientResponsibility, 0),
      pendingApproval: costs.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.cost, 0),
      categoryBreakdown: {},
      monthlyTrends: []
    };

    // Calculate category breakdown
    costs.forEach(cost => {
      summary.categoryBreakdown[cost.category] = (summary.categoryBreakdown[cost.category] || 0) + cost.cost;
    });

    // Calculate monthly trends (last 6 months)
    const monthlyData = new Map<string, number>();
    costs.forEach(cost => {
      const monthKey = new Date(cost.date).toISOString().substring(0, 7); // YYYY-MM
      monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + cost.cost);
    });

    summary.monthlyTrends = Array.from(monthlyData.entries())
      .sort()
      .map(([month, total]) => ({ month, total }));

    return summary;
  }

  async updateCostStatus(costId: string, status: CostEntry['status'], clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      await SecureDataAccess.update('cost_entries', {
        id: costId,
        clinicId: clinicId || 'global'
      }, {
        $set: { status, updatedAt: new Date() }
      }, context);

      return true;
    } catch (error) {
      console.error('Failed to update cost status:', error);
      return false;
    }
  }

  async generateCostReport(timeRange: 'monthly' | 'quarterly' | 'yearly', clinicId?: string): Promise<any> {
    const context = this.getServiceContext(clinicId);
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarterly':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const summary = await this.getCostSummary(undefined, startDate, now, clinicId);
    const costs = await SecureDataAccess.query('cost_entries', {
      date: { $gte: startDate, $lte: now },
      clinicId: clinicId || 'global'
    }, {}, context);

    return {
      timeRange,
      period: `${startDate.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
      summary,
      topServices: this.getTopServices(costs, 10),
      costByProvider: this.getCostByProvider(costs),
      averageCostPerPatient: costs.length > 0 ? summary.totalCosts / new Set(costs.map(c => c.patientId)).size : 0
    };
  }

  private getTopServices(costs: CostEntry[], limit: number = 10): Array<{ service: string; total: number; count: number }> {
    const serviceMap = new Map<string, { total: number; count: number }>();
    
    costs.forEach(cost => {
      const existing = serviceMap.get(cost.serviceName) || { total: 0, count: 0 };
      serviceMap.set(cost.serviceName, {
        total: existing.total + cost.cost,
        count: existing.count + 1
      });
    });

    return Array.from(serviceMap.entries())
      .map(([service, data]) => ({ service, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  private getCostByProvider(costs: CostEntry[]): Array<{ providerId: string; total: number; count: number }> {
    const providerMap = new Map<string, { total: number; count: number }>();
    
    costs.forEach(cost => {
      const existing = providerMap.get(cost.providerId) || { total: 0, count: 0 };
      providerMap.set(cost.providerId, {
        total: existing.total + cost.cost,
        count: existing.count + 1
      });
    });

    return Array.from(providerMap.entries())
      .map(([providerId, data]) => ({ providerId, ...data }))
      .sort((a, b) => b.total - a.total);
  }
}