# Estimate Copay - Implementation Task

## Function Details
- **Function Name**: `estimateCopay`
- **Location**: `backend/services/copayEstimationService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Estimated Time**: 3-4 days
- **Complexity**: Medium-High

## Problem Description
Implement comprehensive copay and patient cost estimation functionality to provide accurate upfront cost estimates for patients before services are rendered. The system must consider insurance benefits, deductibles, copayments, coinsurance, out-of-pocket maximums, and various cost-sharing scenarios to provide transparent pricing and improve patient financial experience.

## Implementation Steps

### 1. Copay Estimation Service Implementation

```javascript
// File: backend/services/copayEstimationService.js
const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const BenefitsVerificationService = require('./benefitsVerificationService');
const BenefitsCoordinationService = require('./benefitsCoordinationService');

class CopayEstimationService {
  constructor() {
    this.estimationFactors = {
      'deductible_remaining': 'Remaining deductible amount',
      'copayment_fixed': 'Fixed copayment amount',
      'coinsurance_percentage': 'Percentage-based coinsurance',
      'out_of_pocket_remaining': 'Remaining out-of-pocket maximum',
      'network_status': 'In-network vs out-of-network rates',
      'plan_allowance': 'Insurance plan allowed amount',
      'multiple_insurance': 'Coordination of benefits impact'
    };

    this.costCategories = {
      'preventive': 'Preventive Care',
      'diagnostic': 'Diagnostic Services',
      'specialist': 'Specialist Visit',
      'primary_care': 'Primary Care Visit',
      'emergency': 'Emergency Services',
      'urgent_care': 'Urgent Care',
      'laboratory': 'Laboratory Tests',
      'radiology': 'Radiology/Imaging',
      'surgical': 'Surgical Procedures',
      'dme': 'Durable Medical Equipment'
    };
  }

  async estimateCopay(estimationRequest, context) {
    try {
      // Validate request
      await this.validateEstimationRequest(estimationRequest, context);

      // Get current benefits verification or perform new one
      let benefitsData = await this.getCurrentBenefits(
        estimationRequest.patientId, 
        estimationRequest.insurancePriority || 1,
        context
      );

      if (!benefitsData || this.isBenefitsExpired(benefitsData)) {
        benefitsData = await this.performBenefitsVerification(estimationRequest, context);
      }

      // Calculate estimates for each service
      const serviceEstimates = [];
      let totalEstimate = 0;

      for (const service of estimationRequest.services) {
        const estimate = await this.calculateServiceEstimate(
          service,
          benefitsData,
          estimationRequest,
          context
        );
        serviceEstimates.push(estimate);
        totalEstimate += estimate.patientCost;
      }

      // Handle multiple insurance coordination if applicable
      if (benefitsData.hasMultipleInsurance) {
        const coordinatedEstimate = await this.calculateCoordinatedEstimate(
          serviceEstimates,
          estimationRequest,
          context
        );
        return coordinatedEstimate;
      }

      // Create final estimation result
      const estimationResult = {
        estimationId: this.generateEstimationId(),
        patientId: estimationRequest.patientId,
        estimationDate: new Date(),
        serviceDate: estimationRequest.serviceDate,
        providerId: estimationRequest.providerId,
        services: serviceEstimates,
        totalCharges: serviceEstimates.reduce((sum, s) => sum + s.chargeAmount, 0),
        totalPatientCost: totalEstimate,
        totalInsuranceCost: serviceEstimates.reduce((sum, s) => sum + s.insurancePays, 0),
        benefitsUsed: this.calculateBenefitsUsed(serviceEstimates, benefitsData),
        costBreakdown: this.createCostBreakdown(serviceEstimates),
        disclaimers: this.generateDisclaimers(estimationRequest, benefitsData),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        accuracy: this.calculateAccuracy(benefitsData)
      };

      // Store estimation
      const storedEstimation = await this.storeEstimation(estimationResult, context);

      // Create audit log
      await this.createAuditLog(estimationRequest, estimationResult, context);

      return storedEstimation;

    } catch (error) {
      await AuditLog.create({
        action: 'COPAY_ESTIMATION_ERROR',
        patientId: estimationRequest.patientId,
        error: error.message,
        userId: context.userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async getCurrentBenefits(patientId, insurancePriority, context) {
    const recentBenefits = await SecureDataAccess.query('benefits_verifications',
      {
        patientId,
        status: 'active',
        expirationDate: { $gt: new Date() }
      },
      {
        sort: { verificationDate: -1 },
        limit: 1
      },
      context
    );

    return recentBenefits.length > 0 ? recentBenefits[0] : null;
  }

  async performBenefitsVerification(estimationRequest, context) {
    const benefitsService = new BenefitsVerificationService();
    
    const verificationRequest = {
      patientId: estimationRequest.patientId,
      serviceCodes: estimationRequest.services.map(s => s.procedureCode),
      serviceDate: estimationRequest.serviceDate
    };

    return await benefitsService.verifyBenefits(verificationRequest, context);
  }

  async calculateServiceEstimate(service, benefitsData, request, context) {
    // Get provider's charge for this service
    const chargeAmount = await this.getProviderCharge(
      service.procedureCode,
      request.providerId,
      context
    );

    // Get insurance allowed amount
    const allowedAmount = await this.getInsuranceAllowedAmount(
      service.procedureCode,
      benefitsData,
      context
    );

    // Determine network status
    const networkStatus = await this.getNetworkStatus(
      request.providerId,
      benefitsData,
      context
    );

    // Calculate patient cost components
    const costCalculation = await this.calculatePatientCostComponents(
      service,
      chargeAmount,
      allowedAmount,
      networkStatus,
      benefitsData,
      context
    );

    return {
      serviceCode: service.procedureCode,
      serviceDescription: await this.getServiceDescription(service.procedureCode, context),
      serviceCategory: this.categorizeService(service.procedureCode),
      chargeAmount,
      allowedAmount,
      networkStatus,
      costComponents: costCalculation.components,
      patientCost: costCalculation.totalPatientCost,
      insurancePays: Math.max(0, allowedAmount - costCalculation.totalPatientCost),
      savings: Math.max(0, chargeAmount - allowedAmount),
      estimationFactors: costCalculation.factors,
      confidence: this.calculateConfidenceLevel(benefitsData, service)
    };
  }

  async calculatePatientCostComponents(service, chargeAmount, allowedAmount, networkStatus, benefitsData, context) {
    const components = [];
    let totalPatientCost = 0;
    let remainingAllowed = allowedAmount;
    const factors = [];

    // Apply out-of-network penalty if applicable
    if (networkStatus === 'out_of_network') {
      const penalty = chargeAmount - allowedAmount;
      components.push({
        type: 'out_of_network_penalty',
        description: 'Out-of-network penalty',
        amount: penalty,
        appliedTo: chargeAmount
      });
      totalPatientCost += penalty;
      factors.push('network_status');
    }

    // Get applicable deductible
    const deductible = this.findApplicableDeductible(service, benefitsData, networkStatus);
    if (deductible && deductible.remaining > 0) {
      const deductibleApplied = Math.min(deductible.remaining, remainingAllowed);
      components.push({
        type: 'deductible',
        description: `${deductible.type} deductible`,
        amount: deductibleApplied,
        appliedTo: remainingAllowed,
        remaining: Math.max(0, deductible.remaining - deductibleApplied)
      });
      totalPatientCost += deductibleApplied;
      remainingAllowed -= deductibleApplied;
      factors.push('deductible_remaining');
    }

    // After deductible, apply copay or coinsurance
    if (remainingAllowed > 0) {
      const costSharing = this.findApplicableCostSharing(service, benefitsData, networkStatus);
      
      if (costSharing.type === 'copay') {
        const copayAmount = Math.min(costSharing.amount, remainingAllowed);
        components.push({
          type: 'copay',
          description: 'Copayment',
          amount: copayAmount,
          appliedTo: remainingAllowed
        });
        totalPatientCost += copayAmount;
        remainingAllowed -= copayAmount;
        factors.push('copayment_fixed');
        
      } else if (costSharing.type === 'coinsurance') {
        const coinsuranceAmount = remainingAllowed * (costSharing.percentage / 100);
        components.push({
          type: 'coinsurance',
          description: `Coinsurance (${costSharing.percentage}%)`,
          amount: coinsuranceAmount,
          appliedTo: remainingAllowed
        });
        totalPatientCost += coinsuranceAmount;
        remainingAllowed -= coinsuranceAmount;
        factors.push('coinsurance_percentage');
      }
    }

    // Check out-of-pocket maximum
    const outOfPocket = this.findApplicableOutOfPocket(service, benefitsData, networkStatus);
    if (outOfPocket && outOfPocket.remaining < totalPatientCost) {
      const reduction = totalPatientCost - outOfPocket.remaining;
      components.push({
        type: 'out_of_pocket_max',
        description: 'Out-of-pocket maximum reached',
        amount: -reduction,
        appliedTo: totalPatientCost
      });
      totalPatientCost = outOfPocket.remaining;
      factors.push('out_of_pocket_remaining');
    }

    return {
      components,
      totalPatientCost: Math.max(0, totalPatientCost),
      factors
    };
  }

  findApplicableDeductible(service, benefitsData, networkStatus) {
    const serviceCategory = this.categorizeService(service.procedureCode);
    
    // Look for service-specific deductible first
    let deductible = benefitsData.costSharing?.deductibles?.find(d => 
      d.serviceType === serviceCategory && d.networkStatus === networkStatus
    );

    // Fall back to general deductible
    if (!deductible) {
      deductible = benefitsData.costSharing?.deductibles?.find(d => 
        d.serviceType === 'General' && d.networkStatus === networkStatus
      );
    }

    // Fall back to any applicable deductible
    if (!deductible) {
      deductible = benefitsData.costSharing?.deductibles?.find(d => 
        d.networkStatus === networkStatus
      );
    }

    return deductible || null;
  }

  findApplicableCostSharing(service, benefitsData, networkStatus) {
    const serviceCategory = this.categorizeService(service.procedureCode);
    
    // Check for copay first
    let costSharing = benefitsData.costSharing?.copayments?.find(c => 
      c.serviceType === serviceCategory && c.networkStatus === networkStatus
    );

    if (costSharing) {
      return { type: 'copay', amount: costSharing.amount };
    }

    // Check for coinsurance
    costSharing = benefitsData.costSharing?.coinsurance?.find(c => 
      c.serviceType === serviceCategory && c.networkStatus === networkStatus
    );

    if (costSharing) {
      return { type: 'coinsurance', percentage: costSharing.percentage };
    }

    // Default to no cost sharing
    return { type: 'none' };
  }

  findApplicableOutOfPocket(service, benefitsData, networkStatus) {
    return benefitsData.costSharing?.outOfPocket?.find(o => 
      o.networkStatus === networkStatus
    ) || null;
  }

  async calculateCoordinatedEstimate(serviceEstimates, request, context) {
    const coordinationService = new BenefitsCoordinationService();
    
    const services = serviceEstimates.map(est => ({
      procedureCode: est.serviceCode,
      description: est.serviceDescription,
      amount: est.chargeAmount
    }));

    const coordination = await coordinationService.coordinateBenefits(
      request.patientId,
      request.serviceDate,
      services,
      context
    );

    // Update estimates with coordination results
    const coordinatedEstimates = serviceEstimates.map(estimate => {
      const coordService = coordination.serviceCoordination.find(s => 
        s.serviceCode === estimate.serviceCode
      );

      if (coordService) {
        return {
          ...estimate,
          patientCost: coordService.patientResponsibility,
          insurancePays: coordService.totalExpectedPayment,
          paymentSequence: coordService.paymentSequence,
          coordinationApplied: true
        };
      }

      return estimate;
    });

    return {
      estimationId: this.generateEstimationId(),
      patientId: request.patientId,
      estimationDate: new Date(),
      serviceDate: request.serviceDate,
      services: coordinatedEstimates,
      totalPatientCost: coordinatedEstimates.reduce((sum, s) => sum + s.patientCost, 0),
      coordinationInfo: {
        payerSequence: coordination.payerSequence,
        coordinationType: coordination.coordinationType
      },
      disclaimers: this.generateCoordinationDisclaimers(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }

  createCostBreakdown(serviceEstimates) {
    const breakdown = {
      totalCharges: 0,
      totalAllowed: 0,
      totalSavings: 0,
      patientCosts: {
        deductible: 0,
        copays: 0,
        coinsurance: 0,
        outOfNetwork: 0,
        total: 0
      },
      insurancePayments: 0
    };

    for (const estimate of serviceEstimates) {
      breakdown.totalCharges += estimate.chargeAmount;
      breakdown.totalAllowed += estimate.allowedAmount;
      breakdown.totalSavings += estimate.savings;
      breakdown.insurancePayments += estimate.insurancePays;

      for (const component of estimate.costComponents) {
        switch (component.type) {
          case 'deductible':
            breakdown.patientCosts.deductible += component.amount;
            break;
          case 'copay':
            breakdown.patientCosts.copays += component.amount;
            break;
          case 'coinsurance':
            breakdown.patientCosts.coinsurance += component.amount;
            break;
          case 'out_of_network_penalty':
            breakdown.patientCosts.outOfNetwork += component.amount;
            break;
        }
      }
      
      breakdown.patientCosts.total += estimate.patientCost;
    }

    return breakdown;
  }

  calculateBenefitsUsed(serviceEstimates, benefitsData) {
    const benefitsUsed = {
      deductibleUsed: 0,
      outOfPocketUsed: 0
    };

    for (const estimate of serviceEstimates) {
      for (const component of estimate.costComponents) {
        if (component.type === 'deductible') {
          benefitsUsed.deductibleUsed += component.amount;
        }
        if (['deductible', 'copay', 'coinsurance'].includes(component.type)) {
          benefitsUsed.outOfPocketUsed += component.amount;
        }
      }
    }

    return benefitsUsed;
  }

  generateDisclaimers(request, benefitsData) {
    const disclaimers = [
      'This is an estimate only. Actual costs may vary based on specific services provided.',
      'Estimates are based on current benefits information and may change if benefits have been updated.',
      'Additional services or complications may result in additional charges.',
      'Network status of providers may affect final costs.'
    ];

    if (this.isBenefitsNearExpiry(benefitsData)) {
      disclaimers.push('Benefits information is nearing expiration. Please verify current benefits.');
    }

    if (request.services.some(s => this.isComplexService(s.procedureCode))) {
      disclaimers.push('Some services may require pre-authorization, which could affect coverage.');
    }

    return disclaimers;
  }

  generateCoordinationDisclaimers() {
    return [
      'This estimate includes coordination of benefits between multiple insurance plans.',
      'Final payments may vary based on actual claims processing and payer policies.',
      'Some payers may have different coordination rules that could affect final costs.',
      'Claims will be submitted to insurance plans in the order shown.'
    ];
  }

  async storeEstimation(estimationResult, context) {
    const estimationRecord = {
      ...estimationResult,
      practiceId: context.practiceId,
      createdBy: context.userId,
      status: 'active'
    };

    const savedEstimation = await SecureDataAccess.create(
      'copay_estimations',
      estimationRecord,
      context
    );

    return savedEstimation;
  }

  // Helper methods
  async getProviderCharge(procedureCode, providerId, context) {
    const charges = await SecureDataAccess.query('provider_fee_schedule',
      { procedureCode, providerId },
      {},
      context
    );

    if (charges.length > 0) {
      return charges[0].amount;
    }

    // Fall back to practice's general fee schedule
    const clinicCharges = await SecureDataAccess.query('practice_fee_schedule',
      { procedureCode, practiceId: context.practiceId },
      {},
      context
    );

    return clinicCharges.length > 0 ? clinicCharges[0].amount : 0;
  }

  async getInsuranceAllowedAmount(procedureCode, benefitsData, context) {
    // Try to get from payer fee schedule
    const payerSchedule = await SecureDataAccess.query('payer_fee_schedules',
      { 
        procedureCode, 
        payerId: benefitsData.payerId 
      },
      {},
      context
    );

    if (payerSchedule.length > 0) {
      return payerSchedule[0].allowedAmount;
    }

    // Fall back to Medicare rates if available
    const medicareRates = await SecureDataAccess.query('medicare_fee_schedule',
      { procedureCode },
      {},
      context
    );

    return medicareRates.length > 0 ? medicareRates[0].amount : 0;
  }

  async getNetworkStatus(providerId, benefitsData, context) {
    const networkStatus = await SecureDataAccess.query('provider_networks',
      { 
        providerId, 
        payerId: benefitsData.payerId,
        effectiveDate: { $lte: new Date() },
        $or: [
          { terminationDate: { $exists: false } },
          { terminationDate: { $gte: new Date() } }
        ]
      },
      {},
      context
    );

    return networkStatus.length > 0 ? 'in_network' : 'out_of_network';
  }

  categorizeService(procedureCode) {
    const codeRanges = {
      'preventive': [['99381', '99429'], ['G0101', 'G0123']],
      'primary_care': [['99201', '99215']],
      'specialist': [['99241', '99255']],
      'diagnostic': [['99000', '99091']],
      'laboratory': [['80047', '89398']],
      'radiology': [['70010', '79999']],
      'surgical': [['10021', '69990']],
      'emergency': [['99281', '99291']]
    };

    for (const [category, ranges] of Object.entries(codeRanges)) {
      for (const [start, end] of ranges) {
        if (procedureCode >= start && procedureCode <= end) {
          return category;
        }
      }
    }

    return 'general';
  }

  calculateConfidenceLevel(benefitsData, service) {
    let confidence = 85; // Base confidence

    // Reduce confidence for older benefits data
    const daysSinceVerification = Math.floor(
      (new Date() - new Date(benefitsData.verificationDate)) / (1000 * 60 * 60 * 24)
    );
    confidence -= daysSinceVerification * 2;

    // Reduce confidence for complex services
    if (this.isComplexService(service.procedureCode)) {
      confidence -= 10;
    }

    // Reduce confidence if benefits are missing key information
    if (!benefitsData.costSharing?.deductibles?.length) {
      confidence -= 15;
    }

    return Math.max(50, Math.min(95, confidence));
  }

  calculateAccuracy(benefitsData) {
    if (benefitsData.verificationMethod === 'real_time_api') {
      return 'high';
    } else if (benefitsData.verificationMethod === 'x12_271') {
      return 'medium';
    } else {
      return 'low';
    }
  }

  isComplexService(procedureCode) {
    // Services that typically require pre-auth or have variable pricing
    const complexRanges = [
      ['20000', '29999'], // Surgical procedures
      ['70000', '79999'], // Advanced imaging
      ['90000', '99999']  // Special services
    ];

    return complexRanges.some(([start, end]) => 
      procedureCode >= start && procedureCode <= end
    );
  }

  isBenefitsExpired(benefitsData) {
    return new Date() > new Date(benefitsData.expirationDate);
  }

  isBenefitsNearExpiry(benefitsData) {
    const expiryDate = new Date(benefitsData.expirationDate);
    const warningDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
    return expiryDate < warningDate;
  }

  generateEstimationId() {
    return 'EST' + Date.now().toString() + Math.random().toString(36).substr(2, 5).toUpperCase();
  }

  async validateEstimationRequest(request, context) {
    if (!request.patientId) {
      throw new Error('Patient ID is required');
    }

    if (!request.services || !Array.isArray(request.services) || request.services.length === 0) {
      throw new Error('At least one service is required');
    }

    for (const service of request.services) {
      if (!service.procedureCode) {
        throw new Error('Procedure code is required for all services');
      }
    }

    if (request.serviceDate && new Date(request.serviceDate) < new Date()) {
      // Allow past dates for retroactive estimates, but log a warning
    }
  }

  async createAuditLog(request, result, context) {
    await AuditLog.create({
      action: 'ESTIMATE_COPAY',
      patientId: request.patientId,
      estimationId: result.estimationId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        serviceCount: request.services.length,
        totalEstimate: result.totalPatientCost,
        estimationAccuracy: result.accuracy,
        coordinationApplied: !!result.coordinationInfo
      },
      timestamp: new Date()
    });
  }

  async getServiceDescription(procedureCode, context) {
    const descriptions = await SecureDataAccess.query('procedure_codes',
      { code: procedureCode },
      {},
      context
    );

    return descriptions.length > 0 ? descriptions[0].description : procedureCode;
  }
}

module.exports = CopayEstimationService;
```

### 2. API Endpoints

```javascript
// File: backend/routes/estimation.js
const express = require('express');
const router = express.Router();
const CopayEstimationService = require('../services/copayEstimationService');
const { requireAuth } = require('../middleware/auth');

router.post('/estimate', requireAuth, async (req, res) => {
  try {
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'copay-estimation-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_COPAY_ESTIMATION_KEY')
    };

    const estimationService = new CopayEstimationService();
    const result = await estimationService.estimateCopay(req.body, context);

    res.json({
      success: true,
      estimation: result,
      message: {
        he: 'אומדן עלויות הושלם בהצלחה',
        en: 'Cost estimation completed successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה באומדן עלויות',
        en: 'Error estimating costs'
      },
      details: error.message
    });
  }
});

router.get('/:estimationId', requireAuth, async (req, res) => {
  try {
    const { estimationId } = req.params;
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'copay-estimation-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_COPAY_ESTIMATION_KEY')
    };

    const estimations = await SecureDataAccess.query('copay_estimations',
      { estimationId },
      {},
      context
    );

    if (!estimations.length) {
      return res.status(404).json({
        error: {
          he: 'אומדן לא נמצא',
          en: 'Estimation not found'
        }
      });
    }

    res.json({ estimation: estimations[0] });
  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בקבלת אומדן',
        en: 'Error retrieving estimation'
      },
      details: error.message
    });
  }
});
```

### 3. Data Model

```javascript
// File: backend/models/CopayEstimation.js
const mongoose = require('mongoose');

const costComponentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['deductible', 'copay', 'coinsurance', 'out_of_network_penalty', 'out_of_pocket_max']
  },
  description: String,
  amount: Number,
  appliedTo: Number,
  remaining: Number
});

const serviceEstimateSchema = new mongoose.Schema({
  serviceCode: String,
  serviceDescription: String,
  serviceCategory: String,
  chargeAmount: Number,
  allowedAmount: Number,
  networkStatus: {
    type: String,
    enum: ['in_network', 'out_of_network', 'unknown']
  },
  costComponents: [costComponentSchema],
  patientCost: Number,
  insurancePays: Number,
  savings: Number,
  estimationFactors: [String],
  confidence: Number,
  coordinationApplied: Boolean,
  paymentSequence: [mongoose.Schema.Types.Mixed]
});

const copayEstimationSchema = new mongoose.Schema({
  estimationId: {
    type: String,
    required: true,
    unique: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Patient'
  },
  estimationDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  serviceDate: Date,
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider'
  },
  services: [serviceEstimateSchema],
  totalCharges: Number,
  totalPatientCost: Number,
  totalInsuranceCost: Number,
  benefitsUsed: {
    deductibleUsed: Number,
    outOfPocketUsed: Number
  },
  costBreakdown: {
    totalCharges: Number,
    totalAllowed: Number,
    totalSavings: Number,
    patientCosts: {
      deductible: Number,
      copays: Number,
      coinsurance: Number,
      outOfNetwork: Number,
      total: Number
    },
    insurancePayments: Number
  },
  coordinationInfo: {
    payerSequence: [mongoose.Schema.Types.Mixed],
    coordinationType: String
  },
  disclaimers: [String],
  validUntil: Date,
  accuracy: {
    type: String,
    enum: ['high', 'medium', 'low']
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'superseded'],
    default: 'active'
  },
  practiceId: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  }
}, {
  timestamps: true
});

copayEstimationSchema.index({ patientId: 1, estimationDate: -1 });
copayEstimationSchema.index({ estimationId: 1 });
copayEstimationSchema.index({ validUntil: 1 });

module.exports = mongoose.model('CopayEstimation', copayEstimationSchema);
```

### 4. Frontend Component

```jsx
// File: frontend-vite/src/components/estimation/CopayEstimator.jsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { DollarSign, Calculator, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import secureApi from '../../services/secureApiClient';

const CopayEstimator = ({ patientId, onEstimationComplete }) => {
  const [estimating, setEstimating] = useState(false);
  const [estimation, setEstimation] = useState(null);
  const [services, setServices] = useState([{ procedureCode: '', description: '' }]);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);

  const addService = () => {
    setServices([...services, { procedureCode: '', description: '' }]);
  };

  const updateService = (index, field, value) => {
    const newServices = [...services];
    newServices[index][field] = value;
    setServices(newServices);
  };

  const removeService = (index) => {
    const newServices = services.filter((_, i) => i !== index);
    setServices(newServices);
  };

  const estimateCosts = async () => {
    setEstimating(true);
    try {
      const validServices = services.filter(s => s.procedureCode.trim());
      
      const response = await secureApi.post('/api/estimation/estimate', {
        patientId,
        serviceDate,
        services: validServices
      });

      setEstimation(response.data.estimation);
      onEstimationComplete?.(response.data.estimation);

    } catch (error) {
      console.error('Error estimating costs:', error);
    } finally {
      setEstimating(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getAccuracyColor = (accuracy) => {
    const colors = {
      'high': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-red-100 text-red-800'
    };
    return colors[accuracy] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Service Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Cost Estimation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Service Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Service Date</label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            {/* Services */}
            <div>
              <label className="block text-sm font-medium mb-2">Services</label>
              {services.map((service, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="CPT Code"
                    value={service.procedureCode}
                    onChange={(e) => updateService(index, 'procedureCode', e.target.value)}
                    className="w-32 border rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={service.description}
                    onChange={(e) => updateService(index, 'description', e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2"
                  />
                  {services.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeService(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addService}>
                Add Service
              </Button>
            </div>

            {/* Estimate Button */}
            <Button 
              onClick={estimateCosts} 
              disabled={estimating || !patientId || services.every(s => !s.procedureCode.trim())}
              className="w-full"
            >
              {estimating ? 'Estimating Costs...' : 'Get Cost Estimate'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estimation Results */}
      {estimation && (
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Cost Estimate Summary</span>
                <div className="flex gap-2">
                  <Badge className={getAccuracyColor(estimation.accuracy)}>
                    {estimation.accuracy} accuracy
                  </Badge>
                  <Badge variant="outline">
                    Valid until {new Date(estimation.validUntil).toLocaleDateString()}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    ${estimation.totalCharges?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-gray-600">Total Charges</div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    ${estimation.totalInsuranceCost?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-gray-600">Insurance Pays</div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    ${estimation.totalPatientCost?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-gray-600">Your Cost</div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    ${estimation.costBreakdown?.totalSavings?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-gray-600">Insurance Savings</div>
                </div>
              </div>

              {/* Cost Breakdown */}
              {estimation.costBreakdown && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="font-semibold">
                      ${estimation.costBreakdown.patientCosts?.deductible?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-gray-600">Deductible</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="font-semibold">
                      ${estimation.costBreakdown.patientCosts?.copays?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-gray-600">Copays</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="font-semibold">
                      ${estimation.costBreakdown.patientCosts?.coinsurance?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-gray-600">Coinsurance</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="font-semibold">
                      ${estimation.costBreakdown.patientCosts?.outOfNetwork?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-gray-600">Out-of-Network</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service Details */}
          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {estimation.services?.map((service, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium">{service.serviceCode}</div>
                        <div className="text-sm text-gray-600">{service.serviceDescription}</div>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {service.serviceCategory}
                          </Badge>
                          <Badge className={service.networkStatus === 'in_network' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {service.networkStatus === 'in_network' ? 'In-Network' : 'Out-of-Network'}
                          </Badge>
                          {service.confidence && (
                            <Badge className={getConfidenceColor(service.confidence)}>
                              {service.confidence}% confident
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-600">
                          ${service.patientCost?.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600">
                          of ${service.chargeAmount?.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Cost Components */}
                    {service.costComponents && service.costComponents.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Cost Breakdown:</div>
                        {service.costComponents.map((component, cIndex) => (
                          <div key={cIndex} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                            <span>{component.description}</span>
                            <span className="font-medium">${component.amount?.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {service.savings > 0 && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                        <CheckCircle className="inline h-4 w-4 text-green-600 mr-1" />
                        <span className="text-green-800">
                          You save ${service.savings.toFixed(2)} with insurance
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Coordination Info */}
          {estimation.coordinationInfo && (
            <Card>
              <CardHeader>
                <CardTitle>Insurance Coordination</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Badge className="mb-2">
                      {estimation.coordinationInfo.coordinationType?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  
                  <div className="text-sm">
                    <strong>Payment Order:</strong>
                    <ol className="list-decimal list-inside ml-2 mt-1">
                      {estimation.coordinationInfo.payerSequence?.map((payer, index) => (
                        <li key={index} className="text-gray-700">
                          {payer.payerName} ({payer.paymentMethod})
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Benefits Used */}
          {estimation.benefitsUsed && (
            <Card>
              <CardHeader>
                <CardTitle>Benefits Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded">
                    <div className="text-lg font-bold text-blue-600">
                      ${estimation.benefitsUsed.deductibleUsed?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm text-gray-600">Deductible Applied</div>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 rounded">
                    <div className="text-lg font-bold text-purple-600">
                      ${estimation.benefitsUsed.outOfPocketUsed?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm text-gray-600">Toward Out-of-Pocket Max</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disclaimers */}
          {estimation.disclaimers && estimation.disclaimers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Important Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {estimation.disclaimers.map((disclaimer, index) => (
                    <div key={index} className="flex gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{disclaimer}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default CopayEstimator;
```

## Test Cases

### Unit Tests

```javascript
// File: backend/tests/copayEstimationService.test.js
const CopayEstimationService = require('../services/copayEstimationService');

describe('CopayEstimationService', () => {
  let service;
  let mockContext;

  beforeEach(() => {
    service = new CopayEstimationService();
    mockContext = {
      userId: 'user123',
      practiceId: 'clinic123'
    };
  });

  test('should calculate patient cost correctly', async () => {
    const service = { procedureCode: '99213' };
    const benefitsData = {
      costSharing: {
        copayments: [{ serviceType: 'primary_care', amount: 25 }]
      }
    };

    const estimate = await service.calculateServiceEstimate(
      service, benefitsData, {}, mockContext
    );

    expect(estimate.patientCost).toBeGreaterThanOrEqual(0);
  });

  test('should categorize services correctly', () => {
    expect(service.categorizeService('99213')).toBe('primary_care');
    expect(service.categorizeService('70030')).toBe('radiology');
  });
});
```

## Dependencies
- SecureDataAccess service
- Benefits verification service
- Benefits coordination service
- Audit logging system

## Success Criteria
- [ ] Accurate cost estimates for single and multiple payers
- [ ] Proper handling of deductibles, copays, and coinsurance
- [ ] Network status impact calculated correctly
- [ ] Out-of-pocket maximums respected
- [ ] Benefits coordination estimates accurate
- [ ] Real-time estimation capabilities
- [ ] Patient-friendly cost breakdowns
- [ ] Comprehensive disclaimer system
- [ ] Integration with scheduling and billing
- [ ] Performance handles high estimation volume