/**
 * API Key Management Service - Compliance Security Domain
 * HIPAA-compliant API key lifecycle management with enhanced security features
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');
const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');

export interface ApiKeyMetadata {
  serviceId: string;
  apiKeyHash: string;
  createdAt: Date;
  createdBy: string;
  expiresAt: Date;
  lastUsed?: Date;
  usageCount: number;
  failedAttempts: number;
  isActive: boolean;
  rotationScheduled: Date;
  tags: string[];
  ipRestrictions: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

export interface ApiKeyGeneration {
  apiKey: string;
  expiresAt: Date;
  keyId: string;
}

export interface ApiKeyValidation {
  valid: boolean;
  reason?: string;
}

export interface UsagePattern {
  serviceId: string;
  type: 'USAGE_SPIKE' | 'NEW_IP_ACCESS' | 'HIGH_FAILED_ATTEMPTS';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  details: string;
}

export interface UsageStats {
  totalRequests: number;
  lastHourRequests: number;
  averageHourlyRequests: number;
  failedAttempts: number;
  uniqueIPs: Set<string>;
  newIPs: string[];
  operations: Record<string, number>;
}

@Injectable()
export class ApiKeyManagementService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  private keyRotationDays = 90; // Rotate every 90 days
  private keyExpirationWarningDays = 7; // Warn 7 days before expiration
  private maxFailedAttempts = 5; // Lock after 5 failed attempts
  private keyUsageTracking = new Map<string, UsageStats>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('api-key-management-service');
      
      // Set up monitoring
      this.startKeyRotationMonitor();
      this.startUsageAnalytics();
      
      this.initialized = true;
      
      console.log('✅ API Key Management Service initialized');
      console.log(`   Rotation period: ${this.keyRotationDays} days`);
      console.log(`   Warning period: ${this.keyExpirationWarningDays} days`);
      console.log(`   Max failed attempts: ${this.maxFailedAttempts}`);
    } catch (error) {
      console.error('❌ Failed to initialize API Key Management Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'api-key-management-service',
      operation: 'key_management',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  /**
   * Generate a new API key with proper security
   */
  async generateAPIKey(serviceId: string, createdBy: string, clinicId?: string): Promise<ApiKeyGeneration> {
    // Generate cryptographically secure random key
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    // Hash the key before storing (like passwords!)
    const apiKeyHash = await bcrypt.hash(apiKey, 12);
    
    // Create metadata
    const keyMetadata: ApiKeyMetadata = {
      serviceId,
      apiKeyHash,
      createdAt: new Date(),
      createdBy,
      expiresAt: new Date(Date.now() + (this.keyRotationDays * 24 * 60 * 60 * 1000)),
      lastUsed: undefined,
      usageCount: 0,
      failedAttempts: 0,
      isActive: true,
      rotationScheduled: new Date(Date.now() + ((this.keyRotationDays - this.keyExpirationWarningDays) * 24 * 60 * 60 * 1000)),
      tags: ['auto-generated', 'compliant'],
      ipRestrictions: [], // Can limit to specific IPs
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 5000,
        requestsPerDay: 50000
      }
    };

    // Store in secure database
    await this.storeAPIKey(keyMetadata, clinicId);
    
    // Log the creation (audit trail)
    await this.auditKeyOperation('CREATE', serviceId, createdBy, clinicId);
    
    // Return the key ONLY ONCE - it won't be retrievable again
    return {
      apiKey, // This is the only time the plain key is available
      expiresAt: keyMetadata.expiresAt,
      keyId: serviceId // Using serviceId as keyId for simplicity
    };
  }

  /**
   * Validate an API key
   */
  async validateAPIKey(serviceId: string, apiKey: string, clinicId?: string): Promise<ApiKeyValidation> {
    try {
      // Get key metadata from database
      const keyRecord = await this.getActiveKeyForService(serviceId, clinicId);
      
      if (!keyRecord) {
        await this.auditKeyOperation('VALIDATION_FAILED', serviceId, 'NO_KEY_FOUND', clinicId);
        return { valid: false, reason: 'No active key found' };
      }

      // Check if expired
      if (new Date() > new Date(keyRecord.expiresAt)) {
        await this.auditKeyOperation('VALIDATION_FAILED', serviceId, 'EXPIRED', clinicId);
        return { valid: false, reason: 'API key expired' };
      }

      // Check if locked due to failed attempts
      if (keyRecord.failedAttempts >= this.maxFailedAttempts) {
        await this.auditKeyOperation('VALIDATION_FAILED', serviceId, 'LOCKED', clinicId);
        return { valid: false, reason: 'API key locked due to failed attempts' };
      }

      // Verify the key hash
      const isValid = await bcrypt.compare(apiKey, keyRecord.apiKeyHash);
      
      if (isValid) {
        // Update usage stats
        await this.updateKeyUsage(serviceId, clinicId);
        await this.auditKeyOperation('VALIDATION_SUCCESS', serviceId, undefined, clinicId);
        return { valid: true };
      } else {
        // Increment failed attempts
        await this.incrementFailedAttempts(serviceId, clinicId);
        await this.auditKeyOperation('VALIDATION_FAILED', serviceId, 'INVALID_KEY', clinicId);
        return { valid: false, reason: 'Invalid API key' };
      }
    } catch (error) {
      console.error('API key validation error:', error);
      await this.auditKeyOperation('VALIDATION_ERROR', serviceId, error.message, clinicId);
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * Rotate an API key
   */
  async rotateAPIKey(serviceId: string, rotatedBy: string, clinicId?: string): Promise<ApiKeyGeneration> {
    console.log(`🔄 Rotating API key for service: ${serviceId}`);
    
    // Deactivate old key
    await this.deactivateKey(serviceId, clinicId);
    
    // Generate new key
    const newKey = await this.generateAPIKey(serviceId, rotatedBy, clinicId);
    
    // Notify about rotation
    await this.notifyKeyRotation(serviceId, newKey.expiresAt);
    
    // Audit the rotation
    await this.auditKeyOperation('ROTATE', serviceId, rotatedBy, clinicId);
    
    return newKey;
  }

  /**
   * Store API key metadata securely
   */
  private async storeAPIKey(metadata: ApiKeyMetadata, clinicId?: string) {
    const context = this.getServiceContext(clinicId);
    
    await SecureDataAccess.insert('api_keys', {
      ...metadata,
      clinicId: clinicId || 'global',
      createdAt: new Date(),
      updatedAt: new Date()
    }, context);
  }

  /**
   * Get active key for service
   */
  private async getActiveKeyForService(serviceId: string, clinicId?: string) {
    const context = this.getServiceContext(clinicId);
    
    const keys = await SecureDataAccess.query('api_keys', {
      serviceId,
      isActive: true,
      clinicId: clinicId || 'global'
    }, {
      sort: { createdAt: -1 },
      limit: 1
    }, context);
    
    return keys[0] || null;
  }

  /**
   * Update key usage statistics
   */
  private async updateKeyUsage(serviceId: string, clinicId?: string) {
    const context = this.getServiceContext(clinicId);
    
    await SecureDataAccess.update('api_keys', {
      serviceId,
      isActive: true,
      clinicId: clinicId || 'global'
    }, {
      $inc: { usageCount: 1 },
      $set: { lastUsed: new Date() }
    }, context);
    
    // Track for analytics
    this.trackKeyUsage(serviceId, 'VALIDATION_SUCCESS');
  }

  /**
   * Increment failed attempts
   */
  private async incrementFailedAttempts(serviceId: string, clinicId?: string) {
    const context = this.getServiceContext(clinicId);
    
    await SecureDataAccess.update('api_keys', {
      serviceId,
      isActive: true,
      clinicId: clinicId || 'global'
    }, {
      $inc: { failedAttempts: 1 }
    }, context);
    
    // Track for analytics
    this.trackKeyUsage(serviceId, 'VALIDATION_FAILED');
  }

  /**
   * Deactivate key
   */
  private async deactivateKey(serviceId: string, clinicId?: string) {
    const context = this.getServiceContext(clinicId);
    
    await SecureDataAccess.update('api_keys', {
      serviceId,
      isActive: true,
      clinicId: clinicId || 'global'
    }, {
      $set: { isActive: false, deactivatedAt: new Date() }
    }, context);
  }

  /**
   * Monitor keys for rotation
   */
  private startKeyRotationMonitor() {
    setInterval(async () => {
      try {
        const expiringKeys = await this.getExpiringKeys();
        
        for (const key of expiringKeys) {
          console.warn(`⚠️ API key for ${key.serviceId} expires in ${key.daysUntilExpiration} days`);
          
          // Send notification
          await this.notifyUpcomingExpiration(key.serviceId, key.daysUntilExpiration);
          
          // Auto-rotate if configured
          if (key.autoRotate && key.daysUntilExpiration <= 1) {
            await this.rotateAPIKey(key.serviceId, 'SYSTEM_AUTO_ROTATION');
          }
        }
      } catch (error) {
        console.error('Key rotation monitor error:', error);
      }
    }, 24 * 60 * 60 * 1000); // Check daily
  }

  /**
   * Track and analyze API key usage
   */
  private startUsageAnalytics() {
    setInterval(async () => {
      try {
        // Analyze usage patterns
        const unusualPatterns = await this.detectUnusualUsage();
        
        if (unusualPatterns.length > 0) {
          console.warn('🚨 Unusual API key usage detected:', unusualPatterns);
          
          for (const pattern of unusualPatterns) {
            // Alert security team
            await this.alertSecurityTeam(pattern);
            
            // Auto-lock if critical
            if (pattern.severity === 'CRITICAL') {
              await this.emergencyLockKey(pattern.serviceId);
            }
          }
        }
        
        // Generate usage report
        await this.generateUsageReport();
        
      } catch (error) {
        console.error('Usage analytics error:', error);
      }
    }, 60 * 60 * 1000); // Check hourly
  }

  /**
   * Detect unusual API key usage patterns
   */
  private async detectUnusualUsage(): Promise<UsagePattern[]> {
    const patterns: UsagePattern[] = [];
    
    for (const [serviceId, usage] of this.keyUsageTracking) {
      // Check for spike in usage
      if (usage.lastHourRequests > usage.averageHourlyRequests * 3) {
        patterns.push({
          serviceId,
          type: 'USAGE_SPIKE',
          severity: 'WARNING',
          details: `${usage.lastHourRequests} requests in last hour (avg: ${usage.averageHourlyRequests})`
        });
      }
      
      // Check for usage from new IPs
      if (usage.newIPs.length > 0) {
        patterns.push({
          serviceId,
          type: 'NEW_IP_ACCESS',
          severity: 'INFO',
          details: `New IPs: ${usage.newIPs.join(', ')}`
        });
      }
      
      // Check for failed attempts
      if (usage.failedAttempts > 10) {
        patterns.push({
          serviceId,
          type: 'HIGH_FAILED_ATTEMPTS',
          severity: 'CRITICAL',
          details: `${usage.failedAttempts} failed attempts`
        });
      }
    }
    
    return patterns;
  }

  /**
   * Track key usage for analytics
   */
  private trackKeyUsage(serviceId: string, operation: string) {
    if (!this.keyUsageTracking.has(serviceId)) {
      this.keyUsageTracking.set(serviceId, {
        totalRequests: 0,
        lastHourRequests: 0,
        averageHourlyRequests: 0,
        failedAttempts: 0,
        uniqueIPs: new Set(),
        newIPs: [],
        operations: {}
      });
    }
    
    const usage = this.keyUsageTracking.get(serviceId)!;
    usage.totalRequests++;
    usage.lastHourRequests++;
    
    if (!usage.operations[operation]) {
      usage.operations[operation] = 0;
    }
    usage.operations[operation]++;
    
    if (operation === 'VALIDATION_FAILED') {
      usage.failedAttempts++;
    }
  }

  /**
   * Audit all key operations
   */
  private async auditKeyOperation(operation: string, serviceId: string, details?: string, clinicId?: string) {
    const auditEntry = {
      timestamp: new Date(),
      operation,
      serviceId,
      details,
      source: 'API_KEY_MANAGEMENT',
      complianceFlags: ['HIPAA', 'SOC2', 'ISO27001'],
      clinicId: clinicId || 'global'
    };
    
    const context = this.getServiceContext(clinicId);
    await SecureDataAccess.insert('audit_logs', {
      action: 'API_KEY_OPERATION',
      details: auditEntry,
      timestamp: new Date(),
      serviceId: 'api-key-management-service'
    }, context);
    
    // Also track for analytics
    this.trackKeyUsage(serviceId, operation);
  }

  // Placeholder methods for monitoring and notification
  private async getExpiringKeys(): Promise<any[]> {
    // Implementation would query database for expiring keys
    return [];
  }

  private async notifyUpcomingExpiration(serviceId: string, daysUntilExpiration: number) {
    console.log(`📧 Notifying about upcoming expiration for ${serviceId} in ${daysUntilExpiration} days`);
  }

  private async notifyKeyRotation(serviceId: string, expiresAt: Date) {
    console.log(`📧 Notifying about key rotation for ${serviceId}, new expiry: ${expiresAt}`);
  }

  private async alertSecurityTeam(pattern: UsagePattern) {
    console.log(`🚨 Security alert: ${pattern.type} for ${pattern.serviceId} - ${pattern.details}`);
  }

  private async emergencyLockKey(serviceId: string) {
    console.log(`🔒 Emergency lock activated for ${serviceId}`);
    await this.deactivateKey(serviceId);
  }

  private async generateUsageReport() {
    const report = {
      generatedAt: new Date(),
      totalKeys: this.keyUsageTracking.size,
      totalRequests: Array.from(this.keyUsageTracking.values()).reduce((sum, usage) => sum + usage.totalRequests, 0)
    };
    
    console.log('📊 API Key Usage Report:', report);
  }
}