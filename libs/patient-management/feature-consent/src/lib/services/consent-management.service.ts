/**
 * Consent Management Service - Patient Management Domain
 * Manages patient consent for GDPR compliance and healthcare data processing
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface PatientConsent {
  id: string;
  patientId: string;
  consentType: 'data_processing' | 'marketing' | 'research' | 'sharing' | 'ai_analysis';
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  expiresAt?: Date;
  purpose: string;
  dataCategories: string[];
  thirdParties?: string[];
  version: string;
  ipAddress?: string;
  userAgent?: string;
  method: 'electronic' | 'verbal' | 'written';
  witness?: string;
}

export interface ConsentHistory {
  patientId: string;
  changes: Array<{
    timestamp: Date;
    action: 'granted' | 'revoked' | 'updated';
    consentType: string;
    details: any;
  }>;
}

@Injectable()
export class ConsentManagementService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('consent-management-service');
      this.initialized = true;
      console.log('✅ Consent Management Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Consent Management Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'consent-management-service',
      operation: 'consent_management',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  async recordConsent(consent: Omit<PatientConsent, 'id'>, clinicId?: string): Promise<string> {
    const context = this.getServiceContext(clinicId);
    
    const consentRecord: PatientConsent = {
      ...consent,
      id: require('crypto').randomUUID(),
      grantedAt: consent.granted ? new Date() : undefined,
      version: '1.0'
    };

    await SecureDataAccess.insert('patient_consents', {
      ...consentRecord,
      clinicId: clinicId || 'global',
      createdAt: new Date()
    }, context);

    // Log consent action
    await this.logConsentAction(consent.patientId, consent.granted ? 'granted' : 'revoked', consent.consentType, clinicId);

    return consentRecord.id;
  }

  async updateConsent(consentId: string, granted: boolean, clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      const updateData = granted 
        ? { granted: true, grantedAt: new Date(), revokedAt: null }
        : { granted: false, revokedAt: new Date() };

      await SecureDataAccess.update('patient_consents', {
        id: consentId,
        clinicId: clinicId || 'global'
      }, {
        $set: { ...updateData, updatedAt: new Date() }
      }, context);

      // Get patient ID for logging
      const consent = await this.getConsent(consentId, clinicId);
      if (consent) {
        await this.logConsentAction(consent.patientId, granted ? 'granted' : 'revoked', consent.consentType, clinicId);
      }

      return true;
    } catch (error) {
      console.error('Failed to update consent:', error);
      return false;
    }
  }

  async getConsent(consentId: string, clinicId?: string): Promise<PatientConsent | null> {
    const context = this.getServiceContext(clinicId);
    
    const consents = await SecureDataAccess.query('patient_consents', {
      id: consentId,
      clinicId: clinicId || 'global'
    }, {}, context);

    return consents[0] || null;
  }

  async getPatientConsents(patientId: string, clinicId?: string): Promise<PatientConsent[]> {
    const context = this.getServiceContext(clinicId);
    
    return await SecureDataAccess.query('patient_consents', {
      patientId,
      clinicId: clinicId || 'global'
    }, {
      sort: { createdAt: -1 }
    }, context);
  }

  async hasValidConsent(patientId: string, consentType: string, clinicId?: string): Promise<boolean> {
    const consents = await this.getPatientConsents(patientId, clinicId);
    const relevantConsent = consents.find(c => c.consentType === consentType);
    
    if (!relevantConsent || !relevantConsent.granted) {
      return false;
    }

    // Check if consent has expired
    if (relevantConsent.expiresAt && new Date() > relevantConsent.expiresAt) {
      return false;
    }

    return true;
  }

  async revokeConsent(patientId: string, consentType: string, clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      await SecureDataAccess.update('patient_consents', {
        patientId,
        consentType,
        clinicId: clinicId || 'global'
      }, {
        $set: {
          granted: false,
          revokedAt: new Date(),
          updatedAt: new Date()
        }
      }, context);

      await this.logConsentAction(patientId, 'revoked', consentType, clinicId);
      return true;
    } catch (error) {
      console.error('Failed to revoke consent:', error);
      return false;
    }
  }

  async getConsentHistory(patientId: string, clinicId?: string): Promise<ConsentHistory> {
    const context = this.getServiceContext(clinicId);
    
    const auditLogs = await SecureDataAccess.query('audit_logs', {
      action: 'CONSENT_ACTION',
      'details.patientId': patientId,
      clinicId: clinicId || 'global'
    }, {
      sort: { timestamp: -1 }
    }, context);

    const changes = auditLogs.map(log => ({
      timestamp: new Date(log.timestamp),
      action: log.details.action,
      consentType: log.details.consentType,
      details: log.details
    }));

    return {
      patientId,
      changes
    };
  }

  async getExpiringConsents(daysAhead: number = 30, clinicId?: string): Promise<PatientConsent[]> {
    const context = this.getServiceContext(clinicId);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await SecureDataAccess.query('patient_consents', {
      granted: true,
      expiresAt: {
        $lte: futureDate,
        $gte: new Date()
      },
      clinicId: clinicId || 'global'
    }, {
      sort: { expiresAt: 1 }
    }, context);
  }

  async generateConsentReport(clinicId?: string): Promise<any> {
    const context = this.getServiceContext(clinicId);
    
    const allConsents = await SecureDataAccess.query('patient_consents', {
      clinicId: clinicId || 'global'
    }, {}, context);

    const report = {
      totalConsents: allConsents.length,
      grantedConsents: allConsents.filter(c => c.granted).length,
      revokedConsents: allConsents.filter(c => !c.granted).length,
      consentsByType: {} as Record<string, number>,
      expiringConsents: (await this.getExpiringConsents(30, clinicId)).length,
      complianceRate: 0
    };

    // Group by consent type
    for (const consent of allConsents) {
      report.consentsByType[consent.consentType] = (report.consentsByType[consent.consentType] || 0) + 1;
    }

    // Calculate compliance rate
    report.complianceRate = report.totalConsents > 0 ? 
      Math.round((report.grantedConsents / report.totalConsents) * 100) : 0;

    return report;
  }

  private async logConsentAction(patientId: string, action: string, consentType: string, clinicId?: string) {
    const context = this.getServiceContext(clinicId);
    
    await SecureDataAccess.insert('audit_logs', {
      action: 'CONSENT_ACTION',
      details: {
        patientId,
        action,
        consentType
      },
      timestamp: new Date(),
      serviceId: 'consent-management-service'
    }, context);
  }

  async validateDataProcessingConsent(patientId: string, purpose: string, clinicId?: string): Promise<{ valid: boolean; reason?: string }> {
    const consents = await this.getPatientConsents(patientId, clinicId);
    
    // Check for general data processing consent
    const dataProcessingConsent = consents.find(c => c.consentType === 'data_processing' && c.granted);
    
    if (!dataProcessingConsent) {
      return { valid: false, reason: 'No data processing consent found' };
    }

    // Check if consent covers the specific purpose
    if (!dataProcessingConsent.purpose.includes(purpose)) {
      return { valid: false, reason: `Consent does not cover purpose: ${purpose}` };
    }

    // Check expiration
    if (dataProcessingConsent.expiresAt && new Date() > dataProcessingConsent.expiresAt) {
      return { valid: false, reason: 'Consent has expired' };
    }

    return { valid: true };
  }
}