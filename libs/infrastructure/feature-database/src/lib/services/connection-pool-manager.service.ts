/**
 * Connection Pool Manager Service - Infrastructure Domain
 * Manages database connection pools for optimal performance and resource usage
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface ConnectionPool {
  name: string;
  maxConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  totalCreated: number;
  totalDestroyed: number;
  averageUsageTime: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface PoolConfiguration {
  maxConnections: number;
  minConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  retryDelay: number;
  maxRetries: number;
}

@Injectable()
export class ConnectionPoolManagerService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  private pools = new Map<string, ConnectionPool>();
  private configurations = new Map<string, PoolConfiguration>();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('connection-pool-manager-service');
      await this.initializePools();
      this.startMonitoring();
      this.initialized = true;
      console.log('✅ Connection Pool Manager Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Connection Pool Manager Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'connection-pool-manager-service',
      operation: 'pool_management',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  private async initializePools() {
    // Initialize default pools
    const defaultPools = [
      { name: 'main', maxConnections: 20 },
      { name: 'analytics', maxConnections: 10 },
      { name: 'audit', maxConnections: 5 },
      { name: 'backup', maxConnections: 3 }
    ];

    for (const poolConfig of defaultPools) {
      this.createPool(poolConfig.name, {
        maxConnections: poolConfig.maxConnections,
        minConnections: 2,
        idleTimeout: 30000,
        connectionTimeout: 5000,
        retryDelay: 1000,
        maxRetries: 3
      });
    }
  }

  createPool(name: string, config: PoolConfiguration): boolean {
    try {
      if (this.pools.has(name)) {
        console.warn(`Pool ${name} already exists`);
        return false;
      }

      const pool: ConnectionPool = {
        name,
        maxConnections: config.maxConnections,
        activeConnections: 0,
        idleConnections: config.minConnections,
        pendingRequests: 0,
        totalCreated: config.minConnections,
        totalDestroyed: 0,
        averageUsageTime: 0,
        status: 'healthy'
      };

      this.pools.set(name, pool);
      this.configurations.set(name, config);
      
      console.log(`✅ Created connection pool: ${name}`);
      return true;
    } catch (error) {
      console.error(`Failed to create pool ${name}:`, error);
      return false;
    }
  }

  getPool(name: string): ConnectionPool | null {
    return this.pools.get(name) || null;
  }

  getAllPools(): ConnectionPool[] {
    return Array.from(this.pools.values());
  }

  async acquireConnection(poolName: string): Promise<string | null> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      console.error(`Pool ${poolName} not found`);
      return null;
    }

    if (pool.activeConnections >= pool.maxConnections) {
      pool.pendingRequests++;
      console.warn(`Pool ${poolName} at capacity, request queued`);
      return null;
    }

    // Simulate connection acquisition
    pool.activeConnections++;
    if (pool.idleConnections > 0) {
      pool.idleConnections--;
    } else {
      pool.totalCreated++;
    }

    this.updatePoolStatus(pool);
    
    // Return mock connection ID
    return `conn_${poolName}_${Date.now()}`;
  }

  async releaseConnection(poolName: string, connectionId: string): Promise<boolean> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      console.error(`Pool ${poolName} not found`);
      return false;
    }

    if (pool.activeConnections > 0) {
      pool.activeConnections--;
      pool.idleConnections++;
      
      // Handle pending requests
      if (pool.pendingRequests > 0) {
        pool.pendingRequests--;
      }

      this.updatePoolStatus(pool);
      return true;
    }

    return false;
  }

  private updatePoolStatus(pool: ConnectionPool) {
    const utilizationRate = pool.activeConnections / pool.maxConnections;
    const pendingRate = pool.pendingRequests / pool.maxConnections;

    if (utilizationRate > 0.9 || pendingRate > 0.5) {
      pool.status = 'critical';
    } else if (utilizationRate > 0.7 || pendingRate > 0.2) {
      pool.status = 'warning';
    } else {
      pool.status = 'healthy';
    }
  }

  async scalePool(poolName: string, newMaxConnections: number): Promise<boolean> {
    const pool = this.pools.get(poolName);
    const config = this.configurations.get(poolName);
    
    if (!pool || !config) {
      console.error(`Pool ${poolName} not found`);
      return false;
    }

    if (newMaxConnections < pool.activeConnections) {
      console.error('Cannot scale down below active connections');
      return false;
    }

    pool.maxConnections = newMaxConnections;
    config.maxConnections = newMaxConnections;
    
    this.updatePoolStatus(pool);
    
    // Log the scaling event
    const context = this.getServiceContext();
    await SecureDataAccess.insert('audit_logs', {
      action: 'POOL_SCALED',
      details: { poolName, newMaxConnections, previousMax: pool.maxConnections },
      timestamp: new Date(),
      serviceId: 'connection-pool-manager-service'
    }, context);

    console.log(`✅ Scaled pool ${poolName} to ${newMaxConnections} connections`);
    return true;
  }

  private startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorPools();
        await this.logPoolMetrics();
      } catch (error) {
        console.error('Pool monitoring error:', error);
      }
    }, 60000); // Monitor every minute
  }

  private async monitorPools() {
    for (const [name, pool] of this.pools.entries()) {
      const config = this.configurations.get(name)!;
      
      // Auto-scale if needed
      if (pool.status === 'critical' && pool.maxConnections < 50) {
        const newMax = Math.min(pool.maxConnections * 1.5, 50);
        await this.scalePool(name, Math.floor(newMax));
      }
      
      // Clean up idle connections if too many
      if (pool.idleConnections > config.maxConnections * 0.5) {
        const toDestroy = Math.floor(pool.idleConnections * 0.2);
        pool.idleConnections -= toDestroy;
        pool.totalDestroyed += toDestroy;
      }
      
      this.updatePoolStatus(pool);
    }
  }

  private async logPoolMetrics() {
    const context = this.getServiceContext();
    
    for (const pool of this.pools.values()) {
      await SecureDataAccess.insert('connection_pool_metrics', {
        poolName: pool.name,
        activeConnections: pool.activeConnections,
        idleConnections: pool.idleConnections,
        pendingRequests: pool.pendingRequests,
        status: pool.status,
        utilizationRate: pool.activeConnections / pool.maxConnections,
        timestamp: new Date(),
        clinicId: 'global'
      }, context);
    }
  }

  getPoolHealth(): { healthy: number; warning: number; critical: number } {
    const health = { healthy: 0, warning: 0, critical: 0 };
    
    for (const pool of this.pools.values()) {
      health[pool.status]++;
    }
    
    return health;
  }

  async getPoolHistory(poolName: string, hours: number = 24): Promise<any[]> {
    const context = this.getServiceContext();
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await SecureDataAccess.query('connection_pool_metrics', {
      poolName,
      timestamp: { $gte: startTime },
      clinicId: 'global'
    }, {
      sort: { timestamp: 1 }
    }, context);
  }

  destroyPool(poolName: string): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return false;
    }

    if (pool.activeConnections > 0) {
      console.error(`Cannot destroy pool ${poolName} with active connections`);
      return false;
    }

    this.pools.delete(poolName);
    this.configurations.delete(poolName);
    
    console.log(`✅ Destroyed connection pool: ${poolName}`);
    return true;
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}