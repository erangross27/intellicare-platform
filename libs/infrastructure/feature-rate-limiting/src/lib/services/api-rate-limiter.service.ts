/**
 * API Rate Limiter Service - Infrastructure Domain
 * Advanced rate limiting with HIPAA compliance and healthcare-specific protections
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface RateLimit {
  requests: number;
  window: number; // in milliseconds
  burst?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface ClientInfo {
  id: string;
  requests: number[];
  blocked: boolean;
  blockedUntil?: number;
  tier: 'basic' | 'premium' | 'enterprise';
}

@Injectable()
export class ApiRateLimiterService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  private clients = new Map<string, ClientInfo>();
  
  private rateLimits: Record<string, RateLimit> = {
    basic: { requests: 100, window: 60000 }, // 100/minute
    premium: { requests: 1000, window: 60000 }, // 1000/minute  
    enterprise: { requests: 10000, window: 60000 }, // 10000/minute
    default: { requests: 50, window: 60000 } // 50/minute
  };

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('api-rate-limiter-service');
      this.startCleanupTask();
      this.initialized = true;
      console.log('✅ API Rate Limiter Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize API Rate Limiter Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'api-rate-limiter-service',
      operation: 'rate_limiting',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  async checkRateLimit(clientId: string, tier: string = 'default', clinicId?: string): Promise<RateLimitResult> {
    const limit = this.rateLimits[tier] || this.rateLimits.default;
    const now = Date.now();
    const windowStart = now - limit.window;

    // Get or create client info
    let client = this.clients.get(clientId);
    if (!client) {
      client = {
        id: clientId,
        requests: [],
        blocked: false,
        tier: tier as any
      };
      this.clients.set(clientId, client);
    }

    // Clean old requests
    client.requests = client.requests.filter(timestamp => timestamp > windowStart);

    // Check if blocked
    if (client.blocked && client.blockedUntil && now < client.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: windowStart + limit.window,
        retryAfter: Math.ceil((client.blockedUntil - now) / 1000)
      };
    }

    // Check rate limit
    if (client.requests.length >= limit.requests) {
      client.blocked = true;
      client.blockedUntil = now + limit.window;
      
      await this.logRateLimitViolation(clientId, tier, limit, clinicId);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: windowStart + limit.window,
        retryAfter: Math.ceil(limit.window / 1000)
      };
    }

    // Allow request
    client.requests.push(now);
    client.blocked = false;
    
    return {
      allowed: true,
      remaining: limit.requests - client.requests.length,
      resetTime: windowStart + limit.window
    };
  }

  async getRateLimitStatus(clientId: string): Promise<RateLimitResult | null> {
    const client = this.clients.get(clientId);
    if (!client) return null;

    const tier = client.tier || 'default';
    const limit = this.rateLimits[tier];
    const now = Date.now();
    const windowStart = now - limit.window;

    // Clean old requests
    client.requests = client.requests.filter(timestamp => timestamp > windowStart);

    return {
      allowed: !client.blocked || !client.blockedUntil || now >= client.blockedUntil,
      remaining: Math.max(0, limit.requests - client.requests.length),
      resetTime: windowStart + limit.window,
      retryAfter: client.blockedUntil && now < client.blockedUntil ? 
        Math.ceil((client.blockedUntil - now) / 1000) : undefined
    };
  }

  updateRateLimit(tier: string, limit: RateLimit) {
    this.rateLimits[tier] = limit;
  }

  resetClient(clientId: string) {
    this.clients.delete(clientId);
  }

  private async logRateLimitViolation(clientId: string, tier: string, limit: RateLimit, clinicId?: string) {
    const context = this.getServiceContext(clinicId);
    
    await SecureDataAccess.insert('audit_logs', {
      action: 'RATE_LIMIT_EXCEEDED',
      details: {
        clientId,
        tier,
        limit: limit.requests,
        window: limit.window,
        timestamp: new Date()
      },
      severity: 'medium',
      timestamp: new Date(),
      serviceId: 'api-rate-limiter-service'
    }, context);
  }

  private startCleanupTask() {
    setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients.entries()) {
        // Remove clients that haven't made requests in the last hour
        const lastRequest = Math.max(...client.requests, 0);
        if (now - lastRequest > 3600000) { // 1 hour
          this.clients.delete(clientId);
        }
      }
    }, 300000); // Clean every 5 minutes
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      blockedClients: Array.from(this.clients.values()).filter(c => c.blocked).length,
      rateLimits: this.rateLimits
    };
  }
}