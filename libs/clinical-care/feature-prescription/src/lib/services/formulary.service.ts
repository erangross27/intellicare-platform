/**
 * Formulary Service - Clinical Care Domain
 * Check medication coverage, tiers, copays, and prior authorization requirements
 * 
 * Features:
 * - Insurance formulary coverage checking
 * - Medication tier and copay calculation  
 * - Prior authorization requirement assessment
 * - Alternative medication suggestions
 * - Cash price estimation for non-covered medications
 * - Prior authorization request submission and tracking
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface TierData {
  medications: string[];
  copay: number;
  priorAuth: boolean;
  quantityLimits: Record<string, number>;
}

export interface Formulary {
  tier1: TierData;
  tier2: TierData;
  tier3: TierData;
  tier4: TierData;
  notCovered: string[];
}

export interface CoverageResult {
  status: 'covered' | 'not_covered' | 'not_in_formulary' | 'unknown_plan';
  covered: boolean;
  tier?: number;
  tierName?: string;
  copay?: number;
  priorAuthRequired: boolean;
  quantityLimits?: number;
  alternatives: AlternativeMedication[];
  estimatedCost?: number;
  message: string;
}

export interface AlternativeMedication {
  medication: string;
  tier: number;
  copay: number;
  priorAuthRequired: boolean;
}

export interface PriorAuthCriteria {
  diagnoses: string[];
  requirements: string[];
}

export interface PriorAuthResult {
  required: boolean;
  status: 'required' | 'not_required' | 'not_applicable';
  reason?: string;
  criteria?: PriorAuthCriteria;
  requiredDocumentation?: string[];
  estimatedProcessingTime?: string;
  expeditedAvailable?: boolean;
  message?: string;
}

export interface CopayEstimation {
  covered: boolean;
  copay?: number;
  quantity?: number;
  daysSupply?: number;
  totalCost?: number;
  estimatedCost?: number;
  costType: 'copay' | 'cash_price';
  tier?: number;
  message: string;
}

export interface PriorAuthRequestData {
  patientId: string;
  medication: string;
  diagnosis: string;
  prescriberId: string;
  insurancePlanId: string;
  clinicalJustification: string;
  supportingDocuments?: string[];
  urgent?: boolean;
}

export interface PriorAuthRequest {
  requestId: string;
  patientId: string;
  medication: string;
  diagnosis: string;
  prescriberId: string;
  insurancePlanId: string;
  clinicalJustification: string;
  supportingDocuments: string[];
  urgency: 'standard' | 'expedited';
  submittedAt: Date;
  status: 'pending' | 'approved' | 'denied';
  expectedResponseDate: Date;
}

export interface PriorAuthSubmissionResult {
  success: boolean;
  requestId: string;
  status: string;
  expectedResponseDate: Date;
  trackingNumber: string;
  message: string;
}

export interface ServiceContext {
  userId?: string;
  clinicId?: string;
}

@Injectable()
export class FormularyService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  private formularyCache = new Map<string, Formulary>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;

    try {
      this.serviceToken = await serviceAccountManager.authenticate('formulary-service');
      await this.loadFormularyData();
      this.initialized = true;
      console.log('✅ Formulary Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Formulary Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'formulary-service',
      operation: 'formulary_operations',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  private async loadFormularyData(): Promise<void> {
    // Sample formulary data for common insurance plans (MVP version)
    // In production, this would connect to insurance company APIs
    const formularyData: Record<string, Formulary> = {
      'default': {
        // Tier 1 - Generic medications (lowest copay)
        tier1: {
          medications: ['lisinopril', 'metformin', 'omeprazole', 'amoxicillin', 'sertraline'],
          copay: 10,
          priorAuth: false,
          quantityLimits: {}
        },
        // Tier 2 - Preferred brand medications
        tier2: {
          medications: ['atorvastatin', 'amlodipine', 'gabapentin', 'metoprolol'],
          copay: 25,
          priorAuth: false,
          quantityLimits: {}
        },
        // Tier 3 - Non-preferred brand medications
        tier3: {
          medications: ['crestor', 'lyrica', 'vyvanse', 'eliquis'],
          copay: 50,
          priorAuth: true,
          quantityLimits: { 'vyvanse': 30 }
        },
        // Tier 4 - Specialty medications
        tier4: {
          medications: ['humira', 'enbrel', 'stelara', 'remicade'],
          copay: 100,
          priorAuth: true,
          quantityLimits: {}
        },
        // Not covered medications
        notCovered: ['medical_marijuana', 'experimental_drugs']
      },
      'clalit': {
        // Israeli health fund formulary (kupat holim clalit)
        tier1: {
          medications: ['acamol', 'optalgin', 'moxypen', 'pramin', 'fusid'],
          copay: 18, // NIS
          priorAuth: false,
          quantityLimits: {}
        },
        tier2: {
          medications: ['lipitor', 'crestor', 'nexium', 'cipralex'],
          copay: 37, // NIS
          priorAuth: false,
          quantityLimits: {}
        },
        tier3: {
          medications: ['humira', 'remicade', 'avastin'],
          copay: 100, // NIS
          priorAuth: true,
          quantityLimits: {}
        },
        tier4: {
          medications: [],
          copay: 0,
          priorAuth: false,
          quantityLimits: {}
        },
        notCovered: []
      },
      'maccabi': {
        // Israeli health fund formulary (maccabi)
        tier1: {
          medications: ['acamol', 'optalgin', 'moxypen', 'pramin'],
          copay: 16, // NIS
          priorAuth: false,
          quantityLimits: {}
        },
        tier2: {
          medications: ['simvastatin', 'omeprazole', 'amlodipine'],
          copay: 35, // NIS
          priorAuth: false,
          quantityLimits: {}
        },
        tier3: {
          medications: ['biological_drugs', 'specialty_medications'],
          copay: 150, // NIS
          priorAuth: true,
          quantityLimits: {}
        },
        tier4: {
          medications: [],
          copay: 0,
          priorAuth: false,
          quantityLimits: {}
        },
        notCovered: []
      }
    };

    // Load into cache
    for (const [planId, formulary] of Object.entries(formularyData)) {
      this.formularyCache.set(planId, formulary);
    }
  }

  async checkCoverage(
    medicationIdentifier: string, 
    insurancePlanId: string, 
    context?: ServiceContext
  ): Promise<CoverageResult> {
    try {
      // Get formulary for the insurance plan
      const formulary = this.formularyCache.get(insurancePlanId) || 
                       this.formularyCache.get('default');
      
      if (!formulary) {
        return {
          status: 'unknown_plan',
          covered: false,
          priorAuthRequired: false,
          alternatives: [],
          message: 'Insurance plan not found in system'
        };
      }

      // Normalize medication name
      const medName = this.normalizeMedicationName(medicationIdentifier);
      
      // Check not covered list first
      if (formulary.notCovered && formulary.notCovered.includes(medName)) {
        return {
          status: 'not_covered',
          covered: false,
          tier: undefined,
          copay: undefined,
          priorAuthRequired: false,
          alternatives: await this.getSimilarCoveredMedications(medName, formulary),
          message: 'Medication is not covered by insurance plan'
        };
      }

      // Check each tier
      const tiers = [
        { name: 'tier1', data: formulary.tier1 },
        { name: 'tier2', data: formulary.tier2 },
        { name: 'tier3', data: formulary.tier3 },
        { name: 'tier4', data: formulary.tier4 }
      ];

      for (const tier of tiers) {
        if (tier.data.medications && 
            tier.data.medications.some(med => 
              this.normalizeMedicationName(med) === medName)) {
          
          const tierNumber = this.extractTierNumber(tier.name);
          return {
            status: 'covered',
            covered: true,
            tier: tierNumber,
            tierName: this.getTierDisplayName(tierNumber),
            copay: tier.data.copay,
            priorAuthRequired: tier.data.priorAuth,
            quantityLimits: tier.data.quantityLimits[medName] || undefined,
            alternatives: [],
            estimatedCost: this.calculateEstimatedCost(tier.data.copay, 30), // 30-day supply
            message: `Medication covered at Tier ${tierNumber}`
          };
        }
      }

      // Not found in any tier - check for alternatives
      return {
        status: 'not_in_formulary',
        covered: false,
        tier: undefined,
        copay: undefined,
        priorAuthRequired: false,
        alternatives: await this.getSimilarCoveredMedications(medName, formulary),
        message: 'Medication not found in formulary - alternatives may be available'
      };
      
    } catch (error) {
      console.error('Coverage check failed:', error);
      throw error;
    }
  }

  async checkPriorAuthorization(
    medicationIdentifier: string, 
    insurancePlanId: string, 
    diagnosis?: string, 
    context?: ServiceContext
  ): Promise<PriorAuthResult> {
    try {
      const coverage = await this.checkCoverage(medicationIdentifier, insurancePlanId, context);
      
      if (!coverage.covered) {
        return {
          required: false,
          reason: 'Medication not covered',
          status: 'not_applicable'
        };
      }

      if (!coverage.priorAuthRequired) {
        return {
          required: false,
          status: 'not_required',
          message: 'No prior authorization required for this medication'
        };
      }

      // Check if diagnosis meets criteria for prior auth approval
      const criteria = await this.getPriorAuthCriteria(medicationIdentifier, insurancePlanId);
      
      return {
        required: true,
        status: 'required',
        criteria: criteria,
        requiredDocumentation: [
          'Medical necessity letter',
          'Failed trial documentation for first-line medications',
          'Lab results if applicable',
          'Diagnosis confirmation'
        ],
        estimatedProcessingTime: '3-5 business days',
        expeditedAvailable: true,
        message: 'Prior authorization required - documentation needed'
      };
      
    } catch (error) {
      console.error('Prior auth check failed:', error);
      throw error;
    }
  }

  async getSimilarCoveredMedications(
    medicationName: string, 
    formulary: Formulary
  ): Promise<AlternativeMedication[]> {
    // Map medications to therapeutic classes
    const therapeuticClasses: Record<string, string[]> = {
      'statins': ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin'],
      'ace_inhibitors': ['lisinopril', 'enalapril', 'ramipril', 'captopril'],
      'ppis': ['omeprazole', 'lansoprazole', 'pantoprazole', 'esomeprazole'],
      'ssris': ['sertraline', 'escitalopram', 'fluoxetine', 'paroxetine'],
      'beta_blockers': ['metoprolol', 'atenolol', 'propranolol', 'carvedilol']
    };

    const alternatives: AlternativeMedication[] = [];
    const normalizedMedName = this.normalizeMedicationName(medicationName);

    // Find therapeutic class of the medication
    let medClass: string | null = null;
    for (const [className, meds] of Object.entries(therapeuticClasses)) {
      if (meds.some(med => this.normalizeMedicationName(med) === normalizedMedName)) {
        medClass = className;
        break;
      }
    }

    if (!medClass) return alternatives;

    // Find covered alternatives in the same class
    const classMembers = therapeuticClasses[medClass];
    
    const tiers = [
      { name: 'tier1', data: formulary.tier1 },
      { name: 'tier2', data: formulary.tier2 },
      { name: 'tier3', data: formulary.tier3 },
      { name: 'tier4', data: formulary.tier4 }
    ];

    for (const tier of tiers) {
      if (!tier.data.medications) continue;
      
      for (const altMed of classMembers) {
        if (tier.data.medications.some(med => 
              this.normalizeMedicationName(med) === this.normalizeMedicationName(altMed))) {
          
          alternatives.push({
            medication: altMed,
            tier: this.extractTierNumber(tier.name),
            copay: tier.data.copay,
            priorAuthRequired: tier.data.priorAuth
          });
        }
      }
    }

    // Sort by tier (lower is better)
    alternatives.sort((a, b) => a.tier - b.tier);
    
    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  async getPriorAuthCriteria(medication: string, planId: string): Promise<PriorAuthCriteria> {
    // Simplified prior auth criteria - in production would query insurance APIs
    const criteria: Record<string, PriorAuthCriteria> = {
      'humira': {
        diagnoses: ['rheumatoid_arthritis', 'psoriatic_arthritis', 'crohns_disease'],
        requirements: [
          'Failed trial of at least 2 conventional DMARDs',
          'Documented moderate to severe disease activity',
          'No active infections or malignancy'
        ]
      },
      'vyvanse': {
        diagnoses: ['adhd', 'binge_eating_disorder'],
        requirements: [
          'Documented ADHD diagnosis by specialist',
          'Failed trial of generic stimulant',
          'Age 6 years or older'
        ]
      },
      'eliquis': {
        diagnoses: ['atrial_fibrillation', 'dvt', 'pe'],
        requirements: [
          'Documented diagnosis',
          'CHA2DS2-VASc score ≥ 2 for AFib',
          'No significant bleeding risk'
        ]
      }
    };

    const medName = this.normalizeMedicationName(medication);
    return criteria[medName] || {
      diagnoses: [],
      requirements: ['Medical necessity documentation required']
    };
  }

  async estimateCopay(
    medication: string, 
    insurancePlanId: string, 
    quantity: number, 
    context?: ServiceContext
  ): Promise<CopayEstimation> {
    try {
      const coverage = await this.checkCoverage(medication, insurancePlanId, context);
      
      if (!coverage.covered) {
        // Estimate cash price for non-covered medications
        return {
          covered: false,
          estimatedCost: await this.getCashPrice(medication, quantity),
          costType: 'cash_price',
          message: 'Medication not covered - showing estimated cash price'
        };
      }

      const daysSupply = quantity / 1; // Assuming 1 unit per day
      const monthlySupply = Math.ceil(daysSupply / 30);
      
      return {
        covered: true,
        copay: coverage.copay,
        quantity: quantity,
        daysSupply: daysSupply,
        totalCost: (coverage.copay || 0) * monthlySupply,
        costType: 'copay',
        tier: coverage.tier,
        message: `Estimated copay for ${daysSupply}-day supply`
      };
      
    } catch (error) {
      console.error('Copay estimation failed:', error);
      throw error;
    }
  }

  async getCashPrice(medication: string, quantity: number): Promise<number> {
    // Simplified cash price estimation - in production would use GoodRx or similar API
    const cashPrices: Record<string, number> = {
      'lisinopril': 0.30,  // per pill
      'metformin': 0.20,
      'atorvastatin': 0.50,
      'omeprazole': 0.40,
      'amoxicillin': 0.60,
      'sertraline': 0.35,
      'gabapentin': 0.45
    };

    const medName = this.normalizeMedicationName(medication);
    const pricePerUnit = cashPrices[medName] || 2.00; // Default $2 per unit
    
    return Math.round(pricePerUnit * quantity * 100) / 100;
  }

  async submitPriorAuthRequest(
    requestData: PriorAuthRequestData, 
    context?: ServiceContext
  ): Promise<PriorAuthSubmissionResult> {
    const serviceContext = this.getServiceContext(context?.clinicId);
    
    try {
      const priorAuthRequest: PriorAuthRequest = {
        requestId: `PA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        patientId: requestData.patientId,
        medication: requestData.medication,
        diagnosis: requestData.diagnosis,
        prescriberId: requestData.prescriberId,
        insurancePlanId: requestData.insurancePlanId,
        clinicalJustification: requestData.clinicalJustification,
        supportingDocuments: requestData.supportingDocuments || [],
        urgency: requestData.urgent ? 'expedited' : 'standard',
        submittedAt: new Date(),
        status: 'pending',
        expectedResponseDate: new Date(Date.now() + (requestData.urgent ? 2 : 5) * 24 * 60 * 60 * 1000)
      };

      // Save prior auth request
      await SecureDataAccess.insert(
        'prior_authorizations',
        priorAuthRequest,
        serviceContext
      );

      // Audit log
      await this.logServiceOperation('SUBMIT_PRIOR_AUTH', {
        requestId: priorAuthRequest.requestId,
        medication: requestData.medication,
        urgency: priorAuthRequest.urgency,
        patientId: requestData.patientId
      }, context?.clinicId);

      return {
        success: true,
        requestId: priorAuthRequest.requestId,
        status: 'submitted',
        expectedResponseDate: priorAuthRequest.expectedResponseDate,
        trackingNumber: priorAuthRequest.requestId,
        message: 'Prior authorization request submitted successfully'
      };
      
    } catch (error) {
      console.error('Prior auth submission failed:', error);
      throw error;
    }
  }

  /**
   * Get prior authorization status by request ID
   */
  async getPriorAuthStatus(requestId: string, clinicId?: string): Promise<PriorAuthRequest | null> {
    const context = this.getServiceContext(clinicId);

    try {
      const request = await SecureDataAccess.findOne('prior_authorizations', 
        { requestId }, context);
      return request;
    } catch (error) {
      console.error('Error getting prior auth status:', error);
      return null;
    }
  }

  /**
   * Get all prior authorization requests for a patient
   */
  async getPatientPriorAuths(patientId: string, clinicId?: string): Promise<PriorAuthRequest[]> {
    const context = this.getServiceContext(clinicId);

    try {
      return await SecureDataAccess.query('prior_authorizations', 
        { patientId }, 
        { sort: { submittedAt: -1 } }, 
        context
      );
    } catch (error) {
      console.error('Error getting patient prior auths:', error);
      return [];
    }
  }

  /**
   * Update prior authorization request status (for administrative use)
   */
  async updatePriorAuthStatus(
    requestId: string, 
    status: 'pending' | 'approved' | 'denied', 
    notes?: string,
    clinicId?: string
  ): Promise<boolean> {
    const context = this.getServiceContext(clinicId);

    try {
      await SecureDataAccess.update('prior_authorizations',
        { requestId },
        { 
          $set: { 
            status, 
            updatedAt: new Date(),
            ...(notes && { adminNotes: notes })
          } 
        },
        context
      );

      await this.logServiceOperation('UPDATE_PRIOR_AUTH_STATUS', {
        requestId,
        status,
        notes
      }, clinicId);

      return true;
    } catch (error) {
      console.error('Error updating prior auth status:', error);
      return false;
    }
  }

  // ========== UTILITY METHODS ==========

  private normalizeMedicationName(name: string): string {
    if (!name) return '';
    return name.toString().toLowerCase().trim()
      .replace(/[^a-z0-9]/g, '')
      .replace(/hcl$/, '')
      .replace(/er$/, '')
      .replace(/xr$/, '')
      .replace(/sr$/, '');
  }

  private extractTierNumber(tierName: string): number {
    const match = tierName.match(/tier(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private getTierDisplayName(tierNumber: number): string {
    const tierNames: Record<number, string> = {
      1: 'Generic',
      2: 'Preferred Brand',
      3: 'Non-Preferred Brand',
      4: 'Specialty'
    };
    return tierNames[tierNumber] || `Tier ${tierNumber}`;
  }

  private calculateEstimatedCost(copay: number, daysSupply: number): number {
    const fills = Math.ceil(daysSupply / 30);
    return copay * fills;
  }

  // ========== AUDIT LOGGING ==========

  private async logServiceOperation(operation: string, details: any, clinicId?: string) {
    const context = this.getServiceContext(clinicId);

    try {
      await SecureDataAccess.insert('audit_logs', {
        action: operation,
        resourceType: 'formulary',
        userId: 'system',
        details: details,
        timestamp: new Date()
      }, context);
    } catch (error) {
      console.error('Failed to log service operation:', error);
    }
  }
}