/**
 * BAA Management Service - Compliance Security Domain
 * Business Associate Agreement management for HIPAA compliance
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface BAA {
  id: string;
  businessAssociateName: string;
  agreementType: 'standard' | 'custom' | 'cloud_provider';
  signedDate: Date;
  expirationDate: Date;
  status: 'active' | 'expired' | 'terminated' | 'pending';
  services: string[];
  dataTypes: string[];
  safeguards: string[];
  contactInfo: {
    name: string;
    email: string;
    phone?: string;
  };
  renewalRequired: boolean;
}

@Injectable()
export class BaaManagementService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('baa-management-service');
      this.startComplianceMonitoring();
      this.initialized = true;
      console.log('✅ BAA Management Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize BAA Management Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'baa-management-service',
      operation: 'baa_management',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  async createBAA(baa: Omit<BAA, 'id'>, clinicId?: string): Promise<string> {
    const context = this.getServiceContext(clinicId);
    
    const baaRecord = {
      ...baa,
      id: require('crypto').randomUUID(),
      clinicId: clinicId || 'global',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await SecureDataAccess.insert('business_associate_agreements', baaRecord, context);

    // Log BAA creation
    await SecureDataAccess.insert('audit_logs', {
      action: 'BAA_CREATED',
      details: { 
        baaId: baaRecord.id, 
        businessAssociate: baa.businessAssociateName,
        services: baa.services 
      },
      timestamp: new Date(),
      serviceId: 'baa-management-service'
    }, context);

    return baaRecord.id;
  }

  async getBAA(baaId: string, clinicId?: string): Promise<BAA | null> {
    const context = this.getServiceContext(clinicId);
    
    const baas = await SecureDataAccess.query('business_associate_agreements', {
      id: baaId,
      clinicId: clinicId || 'global'
    }, {}, context);

    return baas[0] || null;
  }

  async getAllBAAs(clinicId?: string): Promise<BAA[]> {
    const context = this.getServiceContext(clinicId);
    
    return await SecureDataAccess.query('business_associate_agreements', {
      clinicId: clinicId || 'global'
    }, {
      sort: { signedDate: -1 }
    }, context);
  }

  async getExpiringBAAs(daysAhead: number = 30, clinicId?: string): Promise<BAA[]> {
    const context = this.getServiceContext(clinicId);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await SecureDataAccess.query('business_associate_agreements', {
      clinicId: clinicId || 'global',
      status: 'active',
      expirationDate: {
        $lte: futureDate,
        $gte: new Date()
      }
    }, {
      sort: { expirationDate: 1 }
    }, context);
  }

  async renewBAA(baaId: string, newExpirationDate: Date, clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      await SecureDataAccess.update('business_associate_agreements', {
        id: baaId,
        clinicId: clinicId || 'global'
      }, {
        $set: {
          expirationDate: newExpirationDate,
          renewalRequired: false,
          status: 'active',
          updatedAt: new Date()
        }
      }, context);

      // Log renewal
      await SecureDataAccess.insert('audit_logs', {
        action: 'BAA_RENEWED',
        details: { baaId, newExpirationDate },
        timestamp: new Date(),
        serviceId: 'baa-management-service'
      }, context);

      return true;
    } catch (error) {
      console.error('Failed to renew BAA:', error);
      return false;
    }
  }

  async terminateBAA(baaId: string, reason: string, clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      await SecureDataAccess.update('business_associate_agreements', {
        id: baaId,
        clinicId: clinicId || 'global'
      }, {
        $set: {
          status: 'terminated',
          terminationDate: new Date(),
          terminationReason: reason,
          updatedAt: new Date()
        }
      }, context);

      // Log termination
      await SecureDataAccess.insert('audit_logs', {
        action: 'BAA_TERMINATED',
        details: { baaId, reason },
        timestamp: new Date(),
        serviceId: 'baa-management-service'
      }, context);

      return true;
    } catch (error) {
      console.error('Failed to terminate BAA:', error);
      return false;
    }
  }

  async checkServiceCompliance(serviceName: string, clinicId?: string): Promise<{ compliant: boolean; baaId?: string; reason?: string }> {
    const context = this.getServiceContext(clinicId);
    
    const baas = await SecureDataAccess.query('business_associate_agreements', {
      clinicId: clinicId || 'global',
      status: 'active',
      services: serviceName,
      expirationDate: { $gt: new Date() }
    }, {}, context);

    if (baas.length > 0) {
      return { compliant: true, baaId: baas[0].id };
    }

    return { 
      compliant: false, 
      reason: `No active BAA found covering service: ${serviceName}` 
    };
  }

  private startComplianceMonitoring() {
    setInterval(async () => {
      try {
        const expiringBAAs = await this.getExpiringBAAs(30); // 30 days
        
        for (const baa of expiringBAAs) {
          console.warn(`⚠️ BAA with ${baa.businessAssociateName} expires on ${baa.expirationDate.toISOString().split('T')[0]}`);
          
          // Mark for renewal if within 30 days
          await this.markForRenewal(baa.id);
        }
      } catch (error) {
        console.error('BAA compliance monitoring error:', error);
      }
    }, 24 * 60 * 60 * 1000); // Check daily
  }

  private async markForRenewal(baaId: string) {
    const context = this.getServiceContext();
    
    await SecureDataAccess.update('business_associate_agreements', {
      id: baaId
    }, {
      $set: { renewalRequired: true }
    }, context);
  }

  async getComplianceReport(clinicId?: string): Promise<{
    totalBAAs: number;
    activeBAAs: number;
    expiringBAAs: number;
    expiredBAAs: number;
    servicesCovered: string[];
  }> {
    const allBAAs = await this.getAllBAAs(clinicId);
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const activeBAAs = allBAAs.filter(baa => baa.status === 'active' && baa.expirationDate > now);
    const expiringBAAs = allBAAs.filter(baa => baa.status === 'active' && baa.expirationDate <= thirtyDaysFromNow && baa.expirationDate > now);
    const expiredBAAs = allBAAs.filter(baa => baa.expirationDate <= now);

    const servicesCovered = [...new Set(allBAAs.flatMap(baa => baa.services))];

    return {
      totalBAAs: allBAAs.length,
      activeBAAs: activeBAAs.length,
      expiringBAAs: expiringBAAs.length,
      expiredBAAs: expiredBAAs.length,
      servicesCovered
    };
  }
}