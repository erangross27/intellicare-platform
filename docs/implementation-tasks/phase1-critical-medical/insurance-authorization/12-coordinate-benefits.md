# Coordinate Benefits - Implementation Task

## Function Details
- **Function Name**: `coordinateBenefits`
- **Location**: `backend/services/benefitsCoordinationService.js`
- **Status**: Not Implemented
- **Priority**: High
- **Estimated Time**: 4-5 days
- **Complexity**: High

## Problem Description
Implement comprehensive benefits coordination functionality to handle multiple insurance coverage scenarios, including primary/secondary payer determination, coordination of benefits (COB) rules, claim splitting, and proper sequencing of insurance payments. The system must comply with NAIC (National Association of Insurance Commissioners) guidelines and handle complex scenarios like Medicare coordination, birthday rules, and COBRA continuation coverage.

## Implementation Steps

### 1. Benefits Coordination Service Implementation

```javascript
// File: backend/services/benefitsCoordinationService.js
const SecureDataAccess = require('./secureDataAccess');
const AuditLog = require('../models/AuditLog');
const ClaimSubmissionService = require('./claimSubmissionService');
const NotificationService = require('./notificationService');

class BenefitsCoordinationService {
  constructor() {
    this.coordinationRules = {
      'birthday_rule': {
        description: 'Parent with earlier birthday is primary for dependent children',
        applies: ['dependent_child'],
        priority: 1
      },
      'gender_rule': {
        description: 'Male parent is primary (deprecated in most states)',
        applies: ['dependent_child'],
        priority: 2,
        deprecated: true
      },
      'medicare_secondary': {
        description: 'Medicare is secondary when other coverage exists',
        applies: ['medicare'],
        conditions: ['active_employment', 'spouse_employment', 'cobra'],
        priority: 3
      },
      'active_employee': {
        description: 'Active employee plan is primary over retiree plan',
        applies: ['all'],
        priority: 4
      },
      'cobra_secondary': {
        description: 'COBRA continuation coverage is secondary',
        applies: ['cobra'],
        priority: 5
      },
      'plan_allowance': {
        description: 'Plan that allows coordination pays first',
        applies: ['all'],
        priority: 6
      },
      'longest_continuous': {
        description: 'Longest continuous coverage is primary',
        applies: ['all'],
        priority: 7
      }
    };

    this.paymentMethods = {
      'primary': 'Primary insurance pays first',
      'secondary': 'Secondary insurance pays remaining balance',
      'non_duplication': 'Secondary does not duplicate primary benefits',
      'coordination_reduction': 'Secondary reduces payment to avoid overpayment'
    };
  }

  async coordinateBenefits(patientId, serviceDate, services, context) {
    try {
      // Get all active insurance for patient
      const insurancePlans = await this.getPatientInsurance(patientId, serviceDate, context);

      if (insurancePlans.length === 0) {
        throw new Error('No active insurance coverage found');
      }

      if (insurancePlans.length === 1) {
        // Single payer - no coordination needed
        return await this.handleSinglePayer(insurancePlans[0], services, context);
      }

      // Multiple payers - coordination required
      const coordinationPlan = await this.createCoordinationPlan(
        insurancePlans,
        patientId,
        serviceDate,
        services,
        context
      );

      // Execute coordination plan
      const coordinationResult = await this.executeCoordinationPlan(
        coordinationPlan,
        context
      );

      // Store coordination record
      const coordinationRecord = await this.storeCoordinationRecord(
        coordinationPlan,
        coordinationResult,
        context
      );

      return coordinationRecord;

    } catch (error) {
      await AuditLog.create({
        action: 'BENEFITS_COORDINATION_ERROR',
        patientId,
        error: error.message,
        userId: context.userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async getPatientInsurance(patientId, serviceDate, context) {
    const insurance = await SecureDataAccess.query('patient_insurance',
      {
        patientId,
        status: 'active',
        effectiveDate: { $lte: serviceDate },
        $or: [
          { terminationDate: { $exists: false } },
          { terminationDate: { $gte: serviceDate } }
        ]
      },
      {
        sort: { priority: 1 },
        include: ['payer', 'subscriber', 'planDetails', 'coordinationRules']
      },
      context
    );

    return insurance;
  }

  async createCoordinationPlan(insurancePlans, patientId, serviceDate, services, context) {
    // Get patient demographics for rule application
    const patients = await SecureDataAccess.query('patients',
      { _id: patientId },
      { include: ['demographics', 'employment'] },
      context
    );

    const patient = patients[0];

    // Apply coordination rules to determine payer order
    const orderedPayers = await this.determinePayerOrder(
      insurancePlans,
      patient,
      serviceDate,
      context
    );

    // Create coordination strategy for each service
    const serviceCoordination = [];

    for (const service of services) {
      const coordination = await this.createServiceCoordination(
        service,
        orderedPayers,
        patient,
        context
      );
      serviceCoordination.push(coordination);
    }

    return {
      patientId,
      serviceDate,
      orderedPayers,
      serviceCoordination,
      coordinationType: this.determineCoordinationType(orderedPayers),
      createdAt: new Date()
    };
  }

  async determinePayerOrder(insurancePlans, patient, serviceDate, context) {
    const payerAnalysis = [];

    for (const plan of insurancePlans) {
      const analysis = {
        plan,
        priority: plan.priority || 999,
        rules: [],
        finalPriority: 999
      };

      // Apply birthday rule for dependent children
      if (patient.relationshipToSubscriber === 'child') {
        const birthdayRule = await this.applyBirthdayRule(plan, patient, context);
        if (birthdayRule.applies) {
          analysis.rules.push(birthdayRule);
          analysis.finalPriority = Math.min(analysis.finalPriority, birthdayRule.priority);
        }
      }

      // Apply Medicare coordination rules
      if (plan.planType === 'medicare') {
        const medicareRule = await this.applyMedicareRules(plan, patient, context);
        analysis.rules.push(medicareRule);
        analysis.finalPriority = Math.min(analysis.finalPriority, medicareRule.priority);
      }

      // Apply active employee rules
      if (plan.coverageType === 'employee' && plan.status === 'active') {
        const employeeRule = this.applyActiveEmployeeRule(plan);
        analysis.rules.push(employeeRule);
        analysis.finalPriority = Math.min(analysis.finalPriority, employeeRule.priority);
      }

      // Apply COBRA rules
      if (plan.coverageType === 'cobra') {
        const cobraRule = this.applyCobraRule(plan);
        analysis.rules.push(cobraRule);
        analysis.finalPriority = Math.max(analysis.finalPriority, cobraRule.priority);
      }

      // Apply coordination of benefits clauses
      const cobRule = this.applyCOBClause(plan);
      analysis.rules.push(cobRule);

      payerAnalysis.push(analysis);
    }

    // Sort by final priority (lower number = higher priority)
    payerAnalysis.sort((a, b) => a.finalPriority - b.finalPriority);

    return payerAnalysis.map((analysis, index) => ({
      ...analysis,
      paymentOrder: index + 1,
      paymentMethod: index === 0 ? 'primary' : 'secondary'
    }));
  }

  async applyBirthdayRule(plan, patient, context) {
    if (patient.relationshipToSubscriber !== 'child') {
      return { applies: false };
    }

    // Get both parents' insurance plans
    const parentPlans = await SecureDataAccess.query('patient_insurance',
      {
        patientId: patient._id,
        relationshipToSubscriber: 'child'
      },
      { include: ['subscriber'] },
      context
    );

    if (parentPlans.length < 2) {
      return { applies: false };
    }

    const parent1Birthday = parentPlans[0].subscriber.dateOfBirth;
    const parent2Birthday = parentPlans[1].subscriber.dateOfBirth;

    // Compare month and day only (ignore year)
    const p1MonthDay = `${parent1Birthday.getMonth()}-${parent1Birthday.getDate()}`;
    const p2MonthDay = `${parent2Birthday.getMonth()}-${parent2Birthday.getDate()}`;

    const isPrimary = plan.subscriber.dateOfBirth === parent1Birthday ? 
      p1MonthDay < p2MonthDay : p1MonthDay > p2MonthDay;

    return {
      applies: true,
      rule: 'birthday_rule',
      description: this.coordinationRules.birthday_rule.description,
      priority: isPrimary ? 1 : 2,
      isPrimary
    };
  }

  async applyMedicareRules(plan, patient, context) {
    const medicareRules = {
      applies: true,
      rule: 'medicare_coordination',
      conditions: []
    };

    // Check for active employment (Medicare secondary)
    if (patient.employment?.status === 'active' && patient.age < 65) {
      medicareRules.conditions.push('active_employment');
      medicareRules.priority = 2; // Secondary
      medicareRules.description = 'Medicare secondary due to active employment';
    }
    // Check for spouse employment
    else if (patient.spouse?.employment?.status === 'active') {
      medicareRules.conditions.push('spouse_employment');
      medicareRules.priority = 2; // Secondary
      medicareRules.description = 'Medicare secondary due to spouse employment';
    }
    // Medicare as primary
    else {
      medicareRules.priority = 1; // Primary
      medicareRules.description = 'Medicare primary - no other qualifying coverage';
    }

    return medicareRules;
  }

  applyActiveEmployeeRule(plan) {
    return {
      applies: true,
      rule: 'active_employee',
      description: 'Active employee plan takes priority over retiree plans',
      priority: 1
    };
  }

  applyCobraRule(plan) {
    return {
      applies: true,
      rule: 'cobra_secondary',
      description: 'COBRA continuation coverage is typically secondary',
      priority: 5
    };
  }

  applyCOBClause(plan) {
    const cobClause = plan.coordinationOfBenefits;
    
    if (!cobClause) {
      return {
        applies: false,
        allowsCoordination: false
      };
    }

    return {
      applies: true,
      rule: 'cob_clause',
      allowsCoordination: cobClause.allowsCoordination,
      coordinationMethod: cobClause.method, // 'non_duplication' or 'coordination_of_benefits'
      description: `Plan ${cobClause.allowsCoordination ? 'allows' : 'does not allow'} coordination`
    };
  }

  async createServiceCoordination(service, orderedPayers, patient, context) {
    const coordination = {
      serviceCode: service.procedureCode,
      serviceDescription: service.description,
      chargeAmount: service.amount,
      paymentSequence: [],
      totalExpectedPayment: 0,
      patientResponsibility: 0
    };

    let remainingBalance = service.amount;
    let totalPaid = 0;

    for (const payer of orderedPayers) {
      if (remainingBalance <= 0) break;

      const paymentCalc = await this.calculatePayerPayment(
        service,
        payer,
        remainingBalance,
        totalPaid,
        context
      );

      if (paymentCalc.paymentAmount > 0) {
        coordination.paymentSequence.push({
          payerOrder: payer.paymentOrder,
          payerId: payer.plan.payer.id,
          payerName: payer.plan.payer.name,
          paymentMethod: payer.paymentMethod,
          eligibleAmount: paymentCalc.eligibleAmount,
          paymentAmount: paymentCalc.paymentAmount,
          adjustments: paymentCalc.adjustments,
          patientCost: paymentCalc.patientCost
        });

        remainingBalance -= paymentCalc.paymentAmount;
        totalPaid += paymentCalc.paymentAmount;
      }
    }

    coordination.totalExpectedPayment = totalPaid;
    coordination.patientResponsibility = Math.max(0, service.amount - totalPaid);

    return coordination;
  }

  async calculatePayerPayment(service, payer, remainingBalance, totalPreviousPaid, context) {
    const plan = payer.plan;
    const paymentMethod = payer.paymentMethod;

    // Get payer's fee schedule/allowed amount
    const allowedAmount = await this.getPayerAllowedAmount(
      service.procedureCode,
      plan.payer.id,
      context
    );

    let eligibleAmount = Math.min(allowedAmount, service.amount);
    let paymentAmount = 0;
    let adjustments = [];
    let patientCost = 0;

    if (paymentMethod === 'primary') {
      // Primary payer calculation
      const primaryCalc = await this.calculatePrimaryPayment(
        service,
        plan,
        eligibleAmount,
        context
      );
      
      paymentAmount = primaryCalc.paymentAmount;
      adjustments = primaryCalc.adjustments;
      patientCost = primaryCalc.patientCost;

    } else if (paymentMethod === 'secondary') {
      // Secondary payer calculation
      const secondaryCalc = await this.calculateSecondaryPayment(
        service,
        plan,
        eligibleAmount,
        remainingBalance,
        totalPreviousPaid,
        context
      );

      paymentAmount = secondaryCalc.paymentAmount;
      adjustments = secondaryCalc.adjustments;
      patientCost = secondaryCalc.patientCost;
    }

    return {
      eligibleAmount,
      paymentAmount: Math.min(paymentAmount, remainingBalance),
      adjustments,
      patientCost
    };
  }

  async calculatePrimaryPayment(service, plan, allowedAmount, context) {
    // Standard primary insurance calculation
    let paymentAmount = allowedAmount;
    let patientCost = 0;
    let adjustments = [];

    // Apply deductible
    const deductible = await this.getApplicableDeductible(service, plan, context);
    if (deductible.remaining > 0) {
      const deductibleApplied = Math.min(deductible.remaining, paymentAmount);
      patientCost += deductibleApplied;
      paymentAmount -= deductibleApplied;
      
      adjustments.push({
        type: 'deductible',
        amount: deductibleApplied,
        description: 'Patient deductible'
      });
    }

    // Apply copayment or coinsurance
    const costSharing = await this.getApplicableCostSharing(service, plan, context);
    
    if (costSharing.type === 'copay') {
      patientCost += costSharing.amount;
      paymentAmount -= costSharing.amount;
      
      adjustments.push({
        type: 'copay',
        amount: costSharing.amount,
        description: 'Patient copayment'
      });
    } else if (costSharing.type === 'coinsurance') {
      const coinsuranceAmount = paymentAmount * (costSharing.percentage / 100);
      patientCost += coinsuranceAmount;
      paymentAmount -= coinsuranceAmount;
      
      adjustments.push({
        type: 'coinsurance',
        amount: coinsuranceAmount,
        description: `Patient coinsurance (${costSharing.percentage}%)`
      });
    }

    return {
      paymentAmount: Math.max(0, paymentAmount),
      patientCost,
      adjustments
    };
  }

  async calculateSecondaryPayment(service, plan, allowedAmount, remainingBalance, totalPreviousPaid, context) {
    const coordinationMethod = plan.coordinationOfBenefits?.method || 'coordination_of_benefits';
    
    let paymentAmount = 0;
    let patientCost = 0;
    let adjustments = [];

    if (coordinationMethod === 'non_duplication') {
      // Non-duplication: Pay up to what plan would pay as primary, minus what primary paid
      const primaryCalc = await this.calculatePrimaryPayment(service, plan, allowedAmount, context);
      paymentAmount = Math.max(0, primaryCalc.paymentAmount - totalPreviousPaid);
      
      adjustments.push({
        type: 'non_duplication',
        amount: totalPreviousPaid,
        description: 'Non-duplication of benefits'
      });

    } else {
      // Coordination of benefits: Pay remaining balance up to plan allowance
      const primaryCalc = await this.calculatePrimaryPayment(service, plan, allowedAmount, context);
      paymentAmount = Math.min(primaryCalc.paymentAmount, remainingBalance);
      
      adjustments.push({
        type: 'coordination_reduction',
        amount: Math.max(0, primaryCalc.paymentAmount - paymentAmount),
        description: 'Coordination of benefits reduction'
      });
    }

    return {
      paymentAmount: Math.max(0, paymentAmount),
      patientCost,
      adjustments
    };
  }

  determineCoordinationType(orderedPayers) {
    const payerTypes = orderedPayers.map(p => p.plan.planType);
    
    if (payerTypes.includes('medicare')) {
      return 'medicare_coordination';
    } else if (payerTypes.includes('cobra')) {
      return 'cobra_coordination';
    } else if (payerTypes.length === 2) {
      return 'dual_coverage';
    } else {
      return 'multiple_coverage';
    }
  }

  async executeCoordinationPlan(coordinationPlan, context) {
    const results = {
      coordinationId: null,
      claimsSubmitted: [],
      totalPaid: 0,
      patientResponsibility: 0,
      status: 'completed'
    };

    try {
      const claimService = new ClaimSubmissionService();

      for (const serviceCoord of coordinationPlan.serviceCoordination) {
        for (const payment of serviceCoord.paymentSequence) {
          // Submit claim to payer in sequence
          const claimData = {
            patientId: coordinationPlan.patientId,
            payerId: payment.payerId,
            serviceDate: coordinationPlan.serviceDate,
            services: [{
              procedureCode: serviceCoord.serviceCode,
              amount: serviceCoord.chargeAmount,
              expectedPayment: payment.paymentAmount
            }],
            coordinationInfo: {
              paymentOrder: payment.payerOrder,
              paymentMethod: payment.paymentMethod,
              otherInsurance: coordinationPlan.orderedPayers.filter(p => 
                p.paymentOrder !== payment.payerOrder
              ).map(p => ({
                payerId: p.plan.payer.id,
                payerName: p.plan.payer.name,
                paymentOrder: p.paymentOrder
              }))
            }
          };

          const claimResult = await claimService.submitClaim(claimData, context);
          results.claimsSubmitted.push(claimResult);
        }

        results.totalPaid += serviceCoord.totalExpectedPayment;
        results.patientResponsibility += serviceCoord.patientResponsibility;
      }

    } catch (error) {
      results.status = 'failed';
      results.error = error.message;
    }

    return results;
  }

  async storeCoordinationRecord(coordinationPlan, coordinationResult, context) {
    const coordinationRecord = {
      patientId: coordinationPlan.patientId,
      serviceDate: coordinationPlan.serviceDate,
      coordinationType: coordinationPlan.coordinationType,
      payerSequence: coordinationPlan.orderedPayers.map(p => ({
        paymentOrder: p.paymentOrder,
        payerId: p.plan.payer.id,
        payerName: p.plan.payer.name,
        paymentMethod: p.paymentMethod,
        rulesApplied: p.rules
      })),
      serviceCoordination: coordinationPlan.serviceCoordination,
      executionResults: coordinationResult,
      totalExpectedPayment: coordinationResult.totalPaid,
      patientResponsibility: coordinationResult.patientResponsibility,
      status: coordinationResult.status,
      createdBy: context.userId,
      createdAt: new Date()
    };

    const savedRecord = await SecureDataAccess.create(
      'benefits_coordination',
      coordinationRecord,
      context
    );

    // Create audit log
    await AuditLog.create({
      action: 'COORDINATE_BENEFITS',
      patientId: coordinationPlan.patientId,
      coordinationId: savedRecord._id,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        payerCount: coordinationPlan.orderedPayers.length,
        coordinationType: coordinationPlan.coordinationType,
        totalAmount: coordinationResult.totalPaid,
        claimsSubmitted: coordinationResult.claimsSubmitted.length
      },
      timestamp: new Date()
    });

    return savedRecord;
  }

  async handleSinglePayer(insurancePlan, services, context) {
    // No coordination needed - process as single payer
    const singlePayerPlan = {
      patientId: insurancePlan.patientId,
      serviceDate: new Date(),
      coordinationType: 'single_payer',
      payerSequence: [{
        paymentOrder: 1,
        payerId: insurancePlan.payer.id,
        payerName: insurancePlan.payer.name,
        paymentMethod: 'primary'
      }],
      serviceCoordination: await Promise.all(
        services.map(service => this.createServiceCoordination(
          service,
          [{
            plan: insurancePlan,
            paymentOrder: 1,
            paymentMethod: 'primary'
          }],
          null,
          context
        ))
      )
    };

    const result = await this.executeCoordinationPlan(singlePayerPlan, context);
    return await this.storeCoordinationRecord(singlePayerPlan, result, context);
  }

  // Helper methods
  async getPayerAllowedAmount(procedureCode, payerId, context) {
    const feeSchedule = await SecureDataAccess.query('payer_fee_schedules',
      { procedureCode, payerId },
      {},
      context
    );

    return feeSchedule.length > 0 ? feeSchedule[0].allowedAmount : 0;
  }

  async getApplicableDeductible(service, plan, context) {
    // Implementation for getting deductible information
    return { remaining: 0 }; // Simplified
  }

  async getApplicableCostSharing(service, plan, context) {
    // Implementation for getting cost sharing information
    return { type: 'none', amount: 0 }; // Simplified
  }
}

module.exports = BenefitsCoordinationService;
```

### 2. API Endpoints

```javascript
// File: backend/routes/coordination.js
const express = require('express');
const router = express.Router();
const BenefitsCoordinationService = require('../services/benefitsCoordinationService');
const { requireAuth } = require('../middleware/auth');

router.post('/coordinate', requireAuth, async (req, res) => {
  try {
    const { patientId, serviceDate, services } = req.body;
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'benefits-coordination-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_BENEFITS_COORDINATION_KEY')
    };

    const coordinationService = new BenefitsCoordinationService();
    const result = await coordinationService.coordinateBenefits(
      patientId,
      new Date(serviceDate),
      services,
      context
    );

    res.json({
      success: true,
      coordination: result,
      message: {
        he: 'תיאום הטבות הושלם בהצלחה',
        en: 'Benefits coordination completed successfully'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בתיאום הטבות',
        en: 'Error coordinating benefits'
      },
      details: error.message
    });
  }
});

router.get('/patient/:patientId/history', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const context = {
      userId: req.user.id,
      practiceId: req.practice.id,
      serviceId: 'benefits-coordination-service',
      apiKey: await productionKMS.getInternalKey('SERVICE_BENEFITS_COORDINATION_KEY')
    };

    const coordinations = await SecureDataAccess.query('benefits_coordination',
      { patientId },
      { 
        sort: { createdAt: -1 },
        limit: 20
      },
      context
    );

    res.json({ coordinations });
  } catch (error) {
    res.status(500).json({
      error: {
        he: 'שגיאה בקבלת היסטוריית תיאום',
        en: 'Error retrieving coordination history'
      },
      details: error.message
    });
  }
});
```

### 3. Data Model

```javascript
// File: backend/models/BenefitsCoordination.js
const mongoose = require('mongoose');

const payerSequenceSchema = new mongoose.Schema({
  paymentOrder: {
    type: Number,
    required: true
  },
  payerId: {
    type: String,
    required: true
  },
  payerName: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['primary', 'secondary'],
    required: true
  },
  rulesApplied: [{
    rule: String,
    description: String,
    priority: Number,
    applies: Boolean
  }]
});

const adjustmentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['deductible', 'copay', 'coinsurance', 'non_duplication', 'coordination_reduction']
  },
  amount: Number,
  description: String
});

const paymentSequenceSchema = new mongoose.Schema({
  payerOrder: Number,
  payerId: String,
  payerName: String,
  paymentMethod: String,
  eligibleAmount: Number,
  paymentAmount: Number,
  adjustments: [adjustmentSchema],
  patientCost: Number
});

const serviceCoordinationSchema = new mongoose.Schema({
  serviceCode: String,
  serviceDescription: String,
  chargeAmount: Number,
  paymentSequence: [paymentSequenceSchema],
  totalExpectedPayment: Number,
  patientResponsibility: Number
});

const benefitsCoordinationSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Patient'
  },
  serviceDate: {
    type: Date,
    required: true
  },
  coordinationType: {
    type: String,
    enum: [
      'single_payer', 'dual_coverage', 'multiple_coverage', 
      'medicare_coordination', 'cobra_coordination'
    ],
    required: true
  },
  payerSequence: [payerSequenceSchema],
  serviceCoordination: [serviceCoordinationSchema],
  executionResults: {
    coordinationId: String,
    claimsSubmitted: [mongoose.Schema.Types.Mixed],
    totalPaid: Number,
    patientResponsibility: Number,
    status: String,
    error: String
  },
  totalExpectedPayment: Number,
  patientResponsibility: Number,
  status: {
    type: String,
    enum: ['completed', 'failed', 'pending'],
    default: 'pending'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  }
}, {
  timestamps: true
});

benefitsCoordinationSchema.index({ patientId: 1, serviceDate: -1 });
benefitsCoordinationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BenefitsCoordination', benefitsCoordinationSchema);
```

### 4. Frontend Component

```jsx
// File: frontend-vite/src/components/coordination/BenefitsCoordinator.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Shuffle, Users, DollarSign, FileText } from 'lucide-react';
import secureApi from '../../services/secureApiClient';

const BenefitsCoordinator = ({ patientId, services, onCoordinationComplete }) => {
  const [coordinating, setCoordinating] = useState(false);
  const [coordination, setCoordination] = useState(null);
  const [insurancePlans, setInsurancePlans] = useState([]);

  useEffect(() => {
    if (patientId) {
      fetchInsurancePlans();
    }
  }, [patientId]);

  const fetchInsurancePlans = async () => {
    try {
      const response = await secureApi.get(`/api/patients/${patientId}/insurance`);
      setInsurancePlans(response.data.insurance || []);
    } catch (error) {
      console.error('Error fetching insurance plans:', error);
    }
  };

  const coordinateBenefits = async () => {
    setCoordinating(true);
    try {
      const response = await secureApi.post('/api/coordination/coordinate', {
        patientId,
        serviceDate: new Date().toISOString(),
        services
      });

      setCoordination(response.data.coordination);
      onCoordinationComplete?.(response.data.coordination);

    } catch (error) {
      console.error('Error coordinating benefits:', error);
    } finally {
      setCoordinating(false);
    }
  };

  const getCoordinationTypeColor = (type) => {
    const colors = {
      'single_payer': 'bg-blue-100 text-blue-800',
      'dual_coverage': 'bg-green-100 text-green-800',
      'multiple_coverage': 'bg-purple-100 text-purple-800',
      'medicare_coordination': 'bg-orange-100 text-orange-800',
      'cobra_coordination': 'bg-red-100 text-red-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatCoordinationType = (type) => {
    return type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Insurance Plans Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Insurance Plans ({insurancePlans.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {insurancePlans.length === 0 ? (
            <p className="text-gray-600">No active insurance plans found</p>
          ) : (
            <div className="space-y-3">
              {insurancePlans.map((plan, index) => (
                <div key={plan._id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{plan.payerName}</div>
                    <div className="text-sm text-gray-600">
                      Priority: {plan.priority} • Member ID: {plan.memberId}
                    </div>
                  </div>
                  <Badge variant={index === 0 ? 'default' : 'secondary'}>
                    {index === 0 ? 'Primary' : 'Secondary'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coordination Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5" />
            Benefits Coordination
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services && services.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Services to Coordinate:</h4>
                <div className="space-y-2">
                  {services.map((service, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{service.procedureCode}</span>
                        <span className="ml-2 text-gray-600">{service.description}</span>
                      </div>
                      <span className="font-medium">${service.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={coordinateBenefits} 
              disabled={coordinating || insurancePlans.length === 0 || !services?.length}
              className="w-full"
            >
              {coordinating ? 'Coordinating Benefits...' : 'Coordinate Benefits'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coordination Results */}
      {coordination && (
        <div className="space-y-6">
          {/* Coordination Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Coordination Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    ${coordination.totalExpectedPayment?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-gray-600">Insurance Payments</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    ${coordination.patientResponsibility?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-sm text-gray-600">Patient Responsibility</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {coordination.payerSequence?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Payers Involved</div>
                </div>
                
                <div className="text-center">
                  <Badge className={getCoordinationTypeColor(coordination.coordinationType)}>
                    {formatCoordinationType(coordination.coordinationType)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payer Sequence */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Sequence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {coordination.payerSequence?.map((payer, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-800">
                          {payer.paymentOrder}
                        </div>
                        <div>
                          <div className="font-medium">{payer.payerName}</div>
                          <Badge variant={payer.paymentMethod === 'primary' ? 'default' : 'secondary'}>
                            {payer.paymentMethod}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    {payer.rulesApplied && payer.rulesApplied.length > 0 && (
                      <div className="text-sm space-y-1">
                        <strong>Rules Applied:</strong>
                        {payer.rulesApplied.map((rule, rIndex) => (
                          <div key={rIndex} className="text-gray-600 ml-2">
                            • {rule.description}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Service Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Service Payment Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {coordination.serviceCoordination?.map((service, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <div className="font-medium">{service.serviceCode}</div>
                        <div className="text-sm text-gray-600">{service.serviceDescription}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${service.chargeAmount?.toFixed(2)}</div>
                        <div className="text-sm text-gray-600">Charge Amount</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {service.paymentSequence?.map((payment, pIndex) => (
                        <div key={pIndex} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {payment.paymentMethod}
                            </Badge>
                            <span className="text-sm">{payment.payerName}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${payment.paymentAmount?.toFixed(2)}</div>
                            {payment.patientCost > 0 && (
                              <div className="text-xs text-red-600">
                                Patient: ${payment.patientCost.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      <div className="border-t pt-2 flex justify-between font-medium">
                        <span>Patient Responsibility:</span>
                        <span className="text-red-600">
                          ${service.patientResponsibility?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Execution Status */}
          {coordination.executionResults && (
            <Card>
              <CardHeader>
                <CardTitle>Execution Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={
                    coordination.executionResults.status === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : coordination.executionResults.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }>
                    {coordination.executionResults.status}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {coordination.executionResults.claimsSubmitted?.length || 0} claims submitted
                  </span>
                </div>

                {coordination.executionResults.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {coordination.executionResults.error}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default BenefitsCoordinator;
```

## Test Cases

### Unit Tests

```javascript
// File: backend/tests/benefitsCoordinationService.test.js
const BenefitsCoordinationService = require('../services/benefitsCoordinationService');

describe('BenefitsCoordinationService', () => {
  let service;
  let mockContext;

  beforeEach(() => {
    service = new BenefitsCoordinationService();
    mockContext = {
      userId: 'user123',
      practiceId: 'clinic123'
    };
  });

  test('should apply birthday rule correctly', async () => {
    const mockPlan = { subscriber: { dateOfBirth: new Date('1990-03-15') } };
    const mockPatient = { relationshipToSubscriber: 'child' };

    const rule = await service.applyBirthdayRule(mockPlan, mockPatient, mockContext);
    expect(rule.applies).toBe(true);
  });

  test('should determine payer order correctly', async () => {
    const mockPlans = [
      { priority: 2, planType: 'commercial' },
      { priority: 1, planType: 'medicare' }
    ];

    const result = await service.determinePayerOrder(mockPlans, {}, new Date(), mockContext);
    expect(result[0].paymentOrder).toBe(1);
  });
});
```

## Dependencies
- SecureDataAccess service
- Claim submission service
- Benefits verification service
- Audit logging system
- Notification service

## Success Criteria
- [ ] Multiple payer scenarios handled correctly
- [ ] Coordination rules applied accurately (birthday, Medicare, etc.)
- [ ] Claims submitted in proper sequence
- [ ] Payment calculations accurate for primary/secondary
- [ ] COB clauses respected
- [ ] Comprehensive audit trail maintained
- [ ] Real-time coordination capabilities
- [ ] Integration with claim management
- [ ] Performance handles complex coordination scenarios
- [ ] Compliance with NAIC guidelines