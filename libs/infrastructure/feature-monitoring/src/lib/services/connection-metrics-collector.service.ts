/**
 * Connection Metrics Collector Service - Infrastructure Domain
 * Collects and analyzes connection metrics for performance monitoring
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface ConnectionMetrics {
  timestamp: Date;
  activeConnections: number;
  totalConnections: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  errorRate: number;
  throughput: number;
  connectionPool: {
    available: number;
    inUse: number;
    max: number;
  };
}

@Injectable()
export class ConnectionMetricsCollectorService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  private collectInterval = 30000; // Collect every 30 seconds
  private collectorTimer: NodeJS.Timeout | null = null;
  private metrics: ConnectionMetrics[] = [];

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('connection-metrics-collector-service');
      this.startMetricsCollection();
      this.initialized = true;
      console.log('✅ Connection Metrics Collector Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Connection Metrics Collector Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'connection-metrics-collector-service',
      operation: 'metrics_collection',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  private startMetricsCollection() {
    this.collectorTimer = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        await this.storeMetrics(metrics);
        this.metrics.push(metrics);
        
        // Keep only last 24 hours of metrics in memory
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
      } catch (error) {
        console.error('Metrics collection error:', error);
      }
    }, this.collectInterval);
  }

  private async collectMetrics(): Promise<ConnectionMetrics> {
    const now = new Date();
    
    // Collect current metrics (simplified implementation)
    const metrics: ConnectionMetrics = {
      timestamp: now,
      activeConnections: Math.floor(Math.random() * 100) + 50, // Placeholder
      totalConnections: Math.floor(Math.random() * 1000) + 500, // Placeholder
      avgResponseTime: Math.floor(Math.random() * 100) + 50,
      maxResponseTime: Math.floor(Math.random() * 500) + 100,
      minResponseTime: Math.floor(Math.random() * 50) + 10,
      errorRate: Math.random() * 5, // 0-5%
      throughput: Math.floor(Math.random() * 1000) + 100,
      connectionPool: {
        available: Math.floor(Math.random() * 50) + 10,
        inUse: Math.floor(Math.random() * 40) + 5,
        max: 100
      }
    };

    return metrics;
  }

  private async storeMetrics(metrics: ConnectionMetrics) {
    const context = this.getServiceContext();
    
    await SecureDataAccess.insert('connection_metrics', {
      ...metrics,
      clinicId: 'global',
      createdAt: new Date()
    }, context);
  }

  async getMetrics(timeRange: number = 3600000): Promise<ConnectionMetrics[]> {
    const context = this.getServiceContext();
    const startTime = new Date(Date.now() - timeRange);
    
    return await SecureDataAccess.query('connection_metrics', {
      timestamp: { $gte: startTime },
      clinicId: 'global'
    }, {
      sort: { timestamp: 1 }
    }, context);
  }

  async getConnectionSummary(): Promise<any> {
    const recentMetrics = this.metrics.slice(-10); // Last 10 data points
    if (recentMetrics.length === 0) return null;

    const avgActiveConnections = recentMetrics.reduce((sum, m) => sum + m.activeConnections, 0) / recentMetrics.length;
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / recentMetrics.length;
    const avgErrorRate = recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length;

    return {
      avgActiveConnections: Math.round(avgActiveConnections),
      avgResponseTime: Math.round(avgResponseTime),
      avgErrorRate: Math.round(avgErrorRate * 100) / 100,
      lastUpdated: recentMetrics[recentMetrics.length - 1].timestamp
    };
  }

  stopCollection() {
    if (this.collectorTimer) {
      clearInterval(this.collectorTimer);
      this.collectorTimer = null;
    }
  }
}