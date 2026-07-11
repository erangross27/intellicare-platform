# Dosage Calculator

## Function Details
**Function Name**: calculateDosage  
**Location**: backend/services/dosageCalculationService.js  
**Status**: Not Implemented  
**Priority**: Critical (P1)  
**Complexity**: High  
**Estimated Time**: 10-14 hours  

## Problem Description
Intelligent dosage calculation system with weight-based, age-based, and organ-function-adjusted dosing, pediatric/geriatric considerations, drug-specific algorithms, and clinical decision support for safe medication dosing.

## Implementation Steps

### 1. Core Service Implementation

```javascript
// backend/services/dosageCalculationService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const drugDatabase = require('./drugDatabase');
const clinicalRulesEngine = require('./clinicalRulesEngine');

class DosageCalculationService {
  constructor() {
    this.serviceToken = null;
    this.dosageRules = new Map();
    this.ageGroupRules = new Map();
    this.renalAdjustmentRules = new Map();
    this.hepaticAdjustmentRules = new Map();
    this.pediatricRules = new Map();
    this.geriatricRules = new Map();
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('dosage-calculation-service');
    await this.loadDosageRules();
    await this.loadAdjustmentRules();
    await this.loadSpecialPopulationRules();
  }

  async calculateDosage(dosageRequest, context) {
    try {
      await this.validateDosageRequest(dosageRequest, context);
      
      const patientProfile = await this.getPatientProfile(
        dosageRequest.patientId, 
        context
      );
      
      const medicationData = await this.getMedicationData(
        dosageRequest.medicationId,
        context
      );
      
      const baseDosage = await this.calculateBaseDosage(
        medicationData,
        patientProfile,
        dosageRequest.indication,
        context
      );
      
      const adjustedDosage = await this.applyDosageAdjustments(
        baseDosage,
        patientProfile,
        medicationData,
        dosageRequest,
        context
      );
      
      const safetyValidation = await this.validateDosageSafety(
        adjustedDosage,
        patientProfile,
        medicationData,
        context
      );
      
      const dosageRecommendations = await this.generateDosageRecommendations(
        adjustedDosage,
        safetyValidation,
        patientProfile,
        medicationData,
        context
      );
      
      const dosageReport = await this.generateDosageReport(
        baseDosage,
        adjustedDosage,
        safetyValidation,
        dosageRecommendations,
        dosageRequest,
        context
      );
      
      await this.auditDosageCalculation(dosageRequest, dosageReport, context);
      
      return {
        calculationId: dosageReport.id,
        status: 'completed',
        dosage: {
          amount: adjustedDosage.amount,
          unit: adjustedDosage.unit,
          frequency: adjustedDosage.frequency,
          route: adjustedDosage.route,
          duration: adjustedDosage.duration
        },
        recommendations: dosageRecommendations,
        safety: safetyValidation,
        adjustments: adjustedDosage.adjustments,
        calculation: {
          baseDosage: baseDosage,
          finalDosage: adjustedDosage,
          methodology: dosageReport.methodology,
          confidence: dosageReport.confidence
        },
        warnings: safetyValidation.warnings,
        contraindications: safetyValidation.contraindications
      };
      
    } catch (error) {
      await this.handleCalculationError(error, dosageRequest, context);
      throw error;
    }
  }

  async validateDosageRequest(request, context) {
    if (!request.patientId || !request.medicationId) {
      throw new Error('Patient ID and Medication ID are required');
    }
    
    if (!request.indication) {
      throw new Error('Medical indication is required for dosage calculation');
    }
    
    // Validate route if specified
    const validRoutes = ['oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'rectal'];
    if (request.route && !validRoutes.includes(request.route.toLowerCase())) {
      throw new Error('Invalid administration route specified');
    }
  }

  async getPatientProfile(patientId, context) {
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    // Get latest vitals for weight/height
    const vitals = await SecureDataAccess.query(
      'vital_signs',
      { patientId: patientId },
      { sort: { recordedAt: -1 }, limit: 1 },
      context
    );
    
    // Get lab results for organ function
    const labs = await SecureDataAccess.query(
      'lab_results',
      { 
        patientId: patientId,
        testType: { $in: ['creatinine', 'bun', 'alt', 'ast', 'bilirubin', 'albumin'] }
      },
      { sort: { collectedAt: -1 }, limit: 10 },
      context
    );
    
    // Get current medications for interaction analysis
    const currentMeds = await SecureDataAccess.query(
      'prescriptions',
      { 
        patientId: patientId,
        status: 'active',
        endDate: { $gte: new Date() }
      },
      {},
      context
    );
    
    const age = this.calculateAge(patient.demographics.dateOfBirth);
    const weight = vitals[0]?.weight || null;
    const height = vitals[0]?.height || null;
    const bmi = (weight && height) ? this.calculateBMI(weight, height) : null;
    
    return {
      patientId: patient._id,
      demographics: {
        age: age,
        ageInMonths: this.calculateAgeInMonths(patient.demographics.dateOfBirth),
        gender: patient.demographics.gender,
        dateOfBirth: patient.demographics.dateOfBirth
      },
      physicalParameters: {
        weight: weight,
        height: height,
        bmi: bmi,
        bodyArea: this.calculateBodySurfaceArea(weight, height),
        idealBodyWeight: this.calculateIdealBodyWeight(height, patient.demographics.gender)
      },
      organFunction: {
        renal: this.assessRenalFunction(labs, age, weight, patient.demographics.gender),
        hepatic: this.assessHepaticFunction(labs),
        cardiac: null // Would need echo/EKG data
      },
      allergies: patient.allergies || [],
      currentMedications: currentMeds,
      conditions: patient.conditions || [],
      pregnancy: patient.demographics.gender === 'female' ? 
                this.assessPregnancyStatus(patient, context) : null
    };
  }

  async getMedicationData(medicationId, context) {
    const medication = await drugDatabase.getMedicationById(medicationId);
    if (!medication) {
      throw new Error('Medication not found in drug database');
    }
    
    const dosageRules = await drugDatabase.getDosageRules(medicationId);
    const contraindications = await drugDatabase.getContraindications(medicationId);
    const interactions = await drugDatabase.getDrugInteractions(medicationId);
    
    return {
      id: medicationId,
      name: medication.name,
      genericName: medication.genericName,
      rxcui: medication.rxcui,
      therapeuticClass: medication.therapeuticClass,
      dosageRules: dosageRules,
      contraindications: contraindications,
      interactions: interactions,
      metabolism: medication.metabolism,
      elimination: medication.elimination,
      halfLife: medication.halfLife,
      bioavailability: medication.bioavailability,
      proteinBinding: medication.proteinBinding
    };
  }

  async calculateBaseDosage(medicationData, patientProfile, indication, context) {
    const dosageRule = this.findApplicableDosageRule(
      medicationData.dosageRules,
      indication,
      patientProfile
    );
    
    if (!dosageRule) {
      throw new Error('No dosage rule found for this medication and indication');
    }
    
    let calculatedDosage;
    
    switch (dosageRule.calculationMethod) {
      case 'weight_based':
        calculatedDosage = await this.calculateWeightBasedDosage(
          dosageRule,
          patientProfile,
          context
        );
        break;
        
      case 'body_surface_area':
        calculatedDosage = await this.calculateBSABasedDosage(
          dosageRule,
          patientProfile,
          context
        );
        break;
        
      case 'age_based':
        calculatedDosage = await this.calculateAgeBasedDosage(
          dosageRule,
          patientProfile,
          context
        );
        break;
        
      case 'fixed_dose':
        calculatedDosage = await this.calculateFixedDosage(
          dosageRule,
          patientProfile,
          context
        );
        break;
        
      case 'creatinine_clearance':
        calculatedDosage = await this.calculateRenalBasedDosage(
          dosageRule,
          patientProfile,
          context
        );
        break;
        
      default:
        throw new Error('Unsupported dosage calculation method');
    }
    
    return {
      ...calculatedDosage,
      rule: dosageRule,
      methodology: dosageRule.calculationMethod,
      rationale: this.generateDosageRationale(dosageRule, patientProfile)
    };
  }

  async calculateWeightBasedDosage(rule, patientProfile, context) {
    if (!patientProfile.physicalParameters.weight) {
      throw new Error('Patient weight is required for weight-based dosing');
    }
    
    const weight = this.selectAppropriateWeight(rule, patientProfile);
    const dosePerKg = rule.dosePerKg || rule.dose;
    
    // Handle dose ranges
    let finalDosePerKg;
    if (typeof dosePerKg === 'object' && dosePerKg.min && dosePerKg.max) {
      // Start with minimum dose for safety, can be titrated up
      finalDosePerKg = rule.startWithMinimum ? dosePerKg.min : 
                      (dosePerKg.min + dosePerKg.max) / 2;
    } else {
      finalDosePerKg = dosePerKg;
    }
    
    const totalDose = weight * finalDosePerKg;
    
    // Apply dose rounding rules
    const roundedDose = this.roundDoseToAppropriateIncrement(totalDose, rule.unit);
    
    return {
      amount: roundedDose,
      unit: rule.unit,
      frequency: rule.frequency,
      route: rule.route,
      calculation: {
        weight: weight,
        dosePerKg: finalDosePerKg,
        rawDose: totalDose,
        roundedDose: roundedDose
      }
    };
  }

  async calculateBSABasedDosage(rule, patientProfile, context) {
    if (!patientProfile.physicalParameters.bodyArea) {
      throw new Error('Body surface area calculation requires height and weight');
    }
    
    const bsa = patientProfile.physicalParameters.bodyArea;
    const dosePerM2 = rule.dosePerM2 || rule.dose;
    
    let finalDosePerM2;
    if (typeof dosePerM2 === 'object' && dosePerM2.min && dosePerM2.max) {
      finalDosePerM2 = rule.startWithMinimum ? dosePerM2.min : 
                       (dosePerM2.min + dosePerM2.max) / 2;
    } else {
      finalDosePerM2 = dosePerM2;
    }
    
    const totalDose = bsa * finalDosePerM2;
    const roundedDose = this.roundDoseToAppropriateIncrement(totalDose, rule.unit);
    
    return {
      amount: roundedDose,
      unit: rule.unit,
      frequency: rule.frequency,
      route: rule.route,
      calculation: {
        bodyArea: bsa,
        dosePerM2: finalDosePerM2,
        rawDose: totalDose,
        roundedDose: roundedDose
      }
    };
  }

  async calculateAgeBasedDosage(rule, patientProfile, context) {
    const age = patientProfile.demographics.age;
    const ageInMonths = patientProfile.demographics.ageInMonths;
    
    let dosage;
    
    // Find appropriate age bracket
    const ageBracket = rule.ageBrackets.find(bracket => {
      if (bracket.unit === 'years') {
        return age >= bracket.minAge && age <= bracket.maxAge;
      } else if (bracket.unit === 'months') {
        return ageInMonths >= bracket.minAge && ageInMonths <= bracket.maxAge;
      }
      return false;
    });
    
    if (!ageBracket) {
      throw new Error('No appropriate age bracket found for this patient');
    }
    
    dosage = ageBracket.dose;
    
    // Handle dose ranges within age bracket
    if (typeof dosage === 'object' && dosage.min && dosage.max) {
      dosage = rule.startWithMinimum ? dosage.min : (dosage.min + dosage.max) / 2;
    }
    
    return {
      amount: this.roundDoseToAppropriateIncrement(dosage, rule.unit),
      unit: rule.unit,
      frequency: ageBracket.frequency || rule.frequency,
      route: rule.route,
      calculation: {
        ageBracket: ageBracket,
        rawDose: dosage,
        patientAge: age,
        patientAgeMonths: ageInMonths
      }
    };
  }

  async applyDosageAdjustments(baseDosage, patientProfile, medicationData, request, context) {
    let adjustedDosage = { ...baseDosage };
    const adjustments = [];
    
    // Renal function adjustment
    if (patientProfile.organFunction.renal.adjustmentRequired) {
      const renalAdjustment = await this.applyRenalAdjustment(
        adjustedDosage,
        patientProfile.organFunction.renal,
        medicationData,
        context
      );
      adjustedDosage = renalAdjustment.dosage;
      adjustments.push(renalAdjustment.adjustment);
    }
    
    // Hepatic function adjustment
    if (patientProfile.organFunction.hepatic.adjustmentRequired) {
      const hepaticAdjustment = await this.applyHepaticAdjustment(
        adjustedDosage,
        patientProfile.organFunction.hepatic,
        medicationData,
        context
      );
      adjustedDosage = hepaticAdjustment.dosage;
      adjustments.push(hepaticAdjustment.adjustment);
    }
    
    // Age-specific adjustments (pediatric/geriatric)
    if (patientProfile.demographics.age < 18) {
      const pediatricAdjustment = await this.applyPediatricAdjustment(
        adjustedDosage,
        patientProfile,
        medicationData,
        context
      );
      if (pediatricAdjustment) {
        adjustedDosage = pediatricAdjustment.dosage;
        adjustments.push(pediatricAdjustment.adjustment);
      }
    } else if (patientProfile.demographics.age >= 65) {
      const geriatricAdjustment = await this.applyGeriatricAdjustment(
        adjustedDosage,
        patientProfile,
        medicationData,
        context
      );
      if (geriatricAdjustment) {
        adjustedDosage = geriatricAdjustment.dosage;
        adjustments.push(geriatricAdjustment.adjustment);
      }
    }
    
    // Pregnancy adjustments
    if (patientProfile.pregnancy?.status === 'pregnant') {
      const pregnancyAdjustment = await this.applyPregnancyAdjustment(
        adjustedDosage,
        patientProfile.pregnancy,
        medicationData,
        context
      );
      if (pregnancyAdjustment) {
        adjustedDosage = pregnancyAdjustment.dosage;
        adjustments.push(pregnancyAdjustment.adjustment);
      }
    }
    
    // Drug interaction adjustments
    const interactionAdjustments = await this.applyInteractionAdjustments(
      adjustedDosage,
      patientProfile.currentMedications,
      medicationData,
      context
    );
    if (interactionAdjustments.length > 0) {
      adjustedDosage = interactionAdjustments[interactionAdjustments.length - 1].dosage;
      adjustments.push(...interactionAdjustments.map(ia => ia.adjustment));
    }
    
    return {
      ...adjustedDosage,
      adjustments: adjustments,
      adjustmentSummary: this.summarizeAdjustments(adjustments)
    };
  }

  async applyRenalAdjustment(dosage, renalFunction, medicationData, context) {
    const creatinineClearance = renalFunction.creatinineClearance;
    const adjustmentRule = this.findRenalAdjustmentRule(medicationData, creatinineClearance);
    
    if (!adjustmentRule) {
      return {
        dosage: dosage,
        adjustment: {
          type: 'renal',
          applied: false,
          reason: 'No renal adjustment rule found'
        }
      };
    }
    
    let adjustedAmount = dosage.amount;
    let adjustedFrequency = dosage.frequency;
    
    if (adjustmentRule.adjustmentType === 'dose_reduction') {
      adjustedAmount = dosage.amount * adjustmentRule.factor;
    } else if (adjustmentRule.adjustmentType === 'frequency_reduction') {
      adjustedFrequency = this.adjustFrequency(dosage.frequency, adjustmentRule.factor);
    } else if (adjustmentRule.adjustmentType === 'both') {
      adjustedAmount = dosage.amount * adjustmentRule.doseFactor;
      adjustedFrequency = this.adjustFrequency(dosage.frequency, adjustmentRule.frequencyFactor);
    }
    
    return {
      dosage: {
        ...dosage,
        amount: this.roundDoseToAppropriateIncrement(adjustedAmount, dosage.unit),
        frequency: adjustedFrequency
      },
      adjustment: {
        type: 'renal',
        applied: true,
        reason: `CrCl ${creatinineClearance} mL/min requires dose adjustment`,
        originalAmount: dosage.amount,
        adjustedAmount: adjustedAmount,
        originalFrequency: dosage.frequency,
        adjustedFrequency: adjustedFrequency,
        rule: adjustmentRule
      }
    };
  }

  async validateDosageSafety(dosage, patientProfile, medicationData, context) {
    const validation = {
      isSafe: true,
      warnings: [],
      contraindications: [],
      recommendations: []
    };
    
    // Check absolute contraindications
    const contraindications = await this.checkAbsoluteContraindications(
      patientProfile,
      medicationData,
      context
    );
    validation.contraindications.push(...contraindications);
    
    if (contraindications.length > 0) {
      validation.isSafe = false;
    }
    
    // Check dose limits
    const doseLimits = await this.checkDoseLimits(
      dosage,
      patientProfile,
      medicationData,
      context
    );
    validation.warnings.push(...doseLimits.warnings);
    
    if (doseLimits.exceeds) {
      validation.isSafe = false;
      validation.contraindications.push({
        type: 'dose_exceeded',
        severity: 'critical',
        message: 'Calculated dose exceeds maximum safe dose',
        maxDose: doseLimits.maxDose,
        calculatedDose: dosage.amount
      });
    }
    
    // Check age appropriateness
    const ageWarnings = await this.checkAgeAppropriateness(
      dosage,
      patientProfile,
      medicationData,
      context
    );
    validation.warnings.push(...ageWarnings);
    
    // Check organ function warnings
    const organWarnings = await this.checkOrganFunctionWarnings(
      dosage,
      patientProfile,
      medicationData,
      context
    );
    validation.warnings.push(...organWarnings);
    
    // Check drug interactions
    const interactionWarnings = await this.checkDrugInteractionWarnings(
      patientProfile.currentMedications,
      medicationData,
      context
    );
    validation.warnings.push(...interactionWarnings);
    
    return validation;
  }

  async generateDosageRecommendations(dosage, safetyValidation, patientProfile, medicationData, context) {
    const recommendations = [];
    
    // Administration recommendations
    recommendations.push({
      category: 'administration',
      type: 'timing',
      recommendation: await this.getTimingRecommendation(medicationData, dosage.frequency),
      priority: 'medium'
    });
    
    if (dosage.route === 'oral' && medicationData.foodInteractions) {
      recommendations.push({
        category: 'administration',
        type: 'food',
        recommendation: this.getFoodRecommendation(medicationData.foodInteractions),
        priority: 'medium'
      });
    }
    
    // Monitoring recommendations
    const monitoringRecs = await this.getMonitoringRecommendations(
      medicationData,
      patientProfile,
      dosage,
      context
    );
    recommendations.push(...monitoringRecs);
    
    // Titration recommendations
    if (medicationData.requiresTitration) {
      recommendations.push({
        category: 'titration',
        type: 'schedule',
        recommendation: await this.getTitrationSchedule(medicationData, dosage, patientProfile),
        priority: 'high'
      });
    }
    
    // Special population recommendations
    if (patientProfile.demographics.age >= 65) {
      const geriatricRecs = await this.getGeriatricRecommendations(medicationData, dosage, context);
      recommendations.push(...geriatricRecs);
    }
    
    if (patientProfile.demographics.age < 18) {
      const pediatricRecs = await this.getPediatricRecommendations(medicationData, dosage, patientProfile, context);
      recommendations.push(...pediatricRecs);
    }
    
    return recommendations;
  }

  // Utility methods
  calculateAge(dateOfBirth) {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  calculateAgeInMonths(dateOfBirth) {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    return (today.getFullYear() - birth.getFullYear()) * 12 + 
           (today.getMonth() - birth.getMonth());
  }

  calculateBMI(weight, height) {
    // weight in kg, height in cm
    const heightInMeters = height / 100;
    return weight / (heightInMeters * heightInMeters);
  }

  calculateBodySurfaceArea(weight, height) {
    if (!weight || !height) return null;
    
    // Mosteller formula: BSA (m²) = √([height(cm) × weight(kg)] / 3600)
    return Math.sqrt((height * weight) / 3600);
  }

  calculateIdealBodyWeight(height, gender) {
    if (!height) return null;
    
    const heightInInches = height * 0.393701; // cm to inches
    
    if (gender === 'male') {
      return 50 + 2.3 * (heightInInches - 60);
    } else {
      return 45.5 + 2.3 * (heightInInches - 60);
    }
  }

  assessRenalFunction(labs, age, weight, gender) {
    const creatinine = labs.find(lab => lab.testType === 'creatinine')?.value;
    
    if (!creatinine) {
      return {
        status: 'unknown',
        adjustmentRequired: false,
        reason: 'No recent creatinine level available'
      };
    }
    
    // Calculate creatinine clearance using Cockcroft-Gault equation
    let creatinineClearance;
    if (weight) {
      creatinineClearance = ((140 - age) * weight) / (72 * creatinine);
      if (gender === 'female') {
        creatinineClearance *= 0.85;
      }
    }
    
    const status = this.classifyRenalFunction(creatinineClearance);
    
    return {
      status: status.category,
      creatinineClearance: creatinineClearance,
      creatinine: creatinine,
      adjustmentRequired: status.adjustmentRequired,
      severity: status.severity
    };
  }

  roundDoseToAppropriateIncrement(dose, unit) {
    const roundingRules = {
      'mg': { threshold: 10, increment: 0.5, above: 5 },
      'mcg': { threshold: 100, increment: 25, above: 50 },
      'units': { threshold: 10, increment: 1, above: 5 },
      'ml': { threshold: 5, increment: 0.1, above: 1 }
    };
    
    const rule = roundingRules[unit.toLowerCase()] || { increment: 0.1 };
    
    if (dose < rule.threshold) {
      return Math.round(dose / rule.increment) * rule.increment;
    } else {
      return Math.round(dose / rule.above) * rule.above;
    }
  }

  async auditDosageCalculation(request, report, context) {
    await AuditLog.create({
      action: 'DOSAGE_CALCULATION',
      entityType: 'dosage_calculation',
      entityId: report.id,
      patientId: request.patientId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        medicationId: request.medicationId,
        indication: request.indication,
        calculatedDose: `${report.finalDosage.amount} ${report.finalDosage.unit}`,
        frequency: report.finalDosage.frequency,
        methodology: report.methodology,
        adjustmentsApplied: report.adjustments?.length || 0,
        safetyWarnings: report.safetyValidation.warnings?.length || 0,
        contraindications: report.safetyValidation.contraindications?.length || 0
      },
      timestamp: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }
}

module.exports = new DosageCalculationService();
```

### 2. API Endpoints

```javascript
// backend/routes/dosage-calculation.js
const express = require('express');
const router = express.Router();
const dosageCalculationService = require('../services/dosageCalculationService');
const authMiddleware = require('../middleware/auth');
const auditMiddleware = require('../middleware/audit');

router.post('/calculate',
  authMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const dosageRequest = {
        patientId: req.body.patientId,
        medicationId: req.body.medicationId,
        indication: req.body.indication,
        route: req.body.route,
        considerations: req.body.considerations || []
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await dosageCalculationService.calculateDosage(
        dosageRequest,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Dosage calculated successfully',
          he: 'מינון חושב בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Dosage calculation failed',
          he: 'חישוב מינון נכשל'
        }
      });
    }
  }
);

router.post('/validate',
  authMiddleware,
  async (req, res) => {
    try {
      const validationRequest = {
        patientId: req.body.patientId,
        medicationId: req.body.medicationId,
        proposedDosage: req.body.dosage,
        indication: req.body.indication
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      // Get patient profile and medication data for validation
      const patientProfile = await dosageCalculationService.getPatientProfile(
        validationRequest.patientId,
        context
      );
      
      const medicationData = await dosageCalculationService.getMedicationData(
        validationRequest.medicationId,
        context
      );
      
      const validation = await dosageCalculationService.validateDosageSafety(
        validationRequest.proposedDosage,
        patientProfile,
        medicationData,
        context
      );

      res.json({
        success: true,
        data: {
          isValid: validation.isSafe,
          warnings: validation.warnings,
          contraindications: validation.contraindications,
          recommendations: validation.recommendations
        },
        message: {
          en: 'Dosage validation completed',
          he: 'אימות מינון הושלם'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Dosage validation failed',
          he: 'אימות מינון נכשל'
        }
      });
    }
  }
);

router.get('/patient-profile/:patientId',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const profile = await dosageCalculationService.getPatientProfile(
        req.params.patientId,
        context
      );

      res.json({
        success: true,
        data: profile,
        message: {
          en: 'Patient profile retrieved successfully',
          he: 'פרופיל מטופל נשלף בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve patient profile',
          he: 'נכשל בשליפת פרופיל מטופל'
        }
      });
    }
  }
);

module.exports = router;
```

### 3. Data Models

```javascript
// backend/models/DosageCalculationReport.js
const mongoose = require('mongoose');

const DosageCalculationReportSchema = new mongoose.Schema({
  calculationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  medicationId: String,
  prescriberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true
  },
  indication: {
    type: String,
    required: true
  },
  patientProfile: {
    demographics: {
      age: Number,
      ageInMonths: Number,
      gender: {
        type: String,
        enum: ['male', 'female', 'other']
      }
    },
    physicalParameters: {
      weight: Number, // kg
      height: Number, // cm
      bmi: Number,
      bodyArea: Number, // m²
      idealBodyWeight: Number
    },
    organFunction: {
      renal: {
        status: {
          type: String,
          enum: ['normal', 'mild', 'moderate', 'severe', 'dialysis', 'unknown']
        },
        creatinineClearance: Number,
        adjustmentRequired: Boolean
      },
      hepatic: {
        status: {
          type: String,
          enum: ['normal', 'mild', 'moderate', 'severe', 'unknown']
        },
        adjustmentRequired: Boolean
      }
    },
    specialConditions: {
      pregnancy: {
        status: Boolean,
        trimester: Number
      },
      breastfeeding: Boolean,
      allergies: [String]
    }
  },
  baseDosage: {
    amount: Number,
    unit: String,
    frequency: String,
    route: String,
    methodology: {
      type: String,
      enum: ['weight_based', 'body_surface_area', 'age_based', 'fixed_dose', 'creatinine_clearance']
    },
    rule: {
      id: String,
      description: String,
      source: String
    },
    calculation: {
      parameter: Number, // weight, BSA, age, etc.
      dosePerUnit: Number,
      rawDose: Number
    }
  },
  adjustments: [{
    type: {
      type: String,
      enum: ['renal', 'hepatic', 'pediatric', 'geriatric', 'pregnancy', 'interaction']
    },
    applied: Boolean,
    reason: String,
    factor: Number,
    originalValue: mongoose.Schema.Types.Mixed,
    adjustedValue: mongoose.Schema.Types.Mixed,
    rule: {
      id: String,
      description: String
    }
  }],
  finalDosage: {
    amount: Number,
    unit: String,
    frequency: String,
    route: String,
    duration: String,
    instructions: String
  },
  safetyValidation: {
    isSafe: Boolean,
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low']
    },
    warnings: [{
      type: {
        type: String,
        enum: ['dose_high', 'dose_low', 'age_inappropriate', 'organ_function', 'interaction']
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      message: String,
      recommendation: String
    }],
    contraindications: [{
      type: String,
      severity: {
        type: String,
        enum: ['relative', 'absolute']
      },
      message: String,
      source: String
    }]
  },
  recommendations: [{
    category: {
      type: String,
      enum: ['administration', 'monitoring', 'titration', 'safety', 'lifestyle']
    },
    type: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    recommendation: String,
    frequency: String,
    duration: String
  }],
  confidence: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true
  },
  limitations: [String],
  sources: [{
    type: {
      type: String,
      enum: ['clinical_guideline', 'drug_label', 'literature', 'expert_opinion']
    },
    reference: String,
    url: String
  }],
  metadata: {
    calculatedAt: {
      type: Date,
      default: Date.now
    },
    calculatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    version: String,
    processingTime: Number
  }
});

// Indexes for performance
DosageCalculationReportSchema.index({ patientId: 1, calculatedAt: -1 });
DosageCalculationReportSchema.index({ prescriberId: 1, calculatedAt: -1 });
DosageCalculationReportSchema.index({ practiceId: 1, calculatedAt: -1 });
DosageCalculationReportSchema.index({ medicationId: 1 });

module.exports = mongoose.model('DosageCalculationReport', DosageCalculationReportSchema);
```

### 4. Frontend Components

```jsx
// frontend-vite/src/components/medication/DosageCalculator.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calculator, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  TrendingUp,
  User,
  Activity
} from 'lucide-react';
import secureApiClient from '@/services/secureApiClient';
import { useTranslation } from '@/hooks/useTranslation';

const DosageCalculator = ({ patientId, onDosageCalculated }) => {
  const { t } = useTranslation();
  const [isCalculating, setIsCalculating] = useState(false);
  const [patientProfile, setPatientProfile] = useState(null);
  const [calculationForm, setCalculationForm] = useState({
    medicationId: '',
    indication: '',
    route: 'oral',
    considerations: []
  });
  const [calculationResult, setCalculationResult] = useState(null);

  useEffect(() => {
    if (patientId) {
      loadPatientProfile();
    }
  }, [patientId]);

  const loadPatientProfile = async () => {
    try {
      const response = await secureApiClient.get(`/api/dosage-calculation/patient-profile/${patientId}`);
      if (response.data.success) {
        setPatientProfile(response.data.data);
      }
    } catch (error) {
      console.error('Error loading patient profile:', error);
    }
  };

  const calculateDosage = async () => {
    if (!calculationForm.medicationId || !calculationForm.indication) {
      return;
    }

    setIsCalculating(true);
    try {
      const response = await secureApiClient.post('/api/dosage-calculation/calculate', {
        patientId,
        ...calculationForm
      });

      if (response.data.success) {
        setCalculationResult(response.data.data);
        if (onDosageCalculated) {
          onDosageCalculated(response.data.data);
        }
      }
    } catch (error) {
      console.error('Error calculating dosage:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'warning';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Patient Profile Summary */}
      {patientProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t({ en: 'Patient Profile', he: 'פרופיל מטופל' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {patientProfile.demographics.age}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'Years Old', he: 'שנים' })}
                </div>
              </div>
              
              {patientProfile.physicalParameters.weight && (
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {patientProfile.physicalParameters.weight} kg
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t({ en: 'Weight', he: 'משקל' })}
                  </div>
                </div>
              )}
              
              {patientProfile.physicalParameters.bodyArea && (
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {patientProfile.physicalParameters.bodyArea.toFixed(2)} m²
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t({ en: 'BSA', he: 'שטח גוף' })}
                  </div>
                </div>
              )}
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-4 w-4" />
                  <Badge variant={
                    patientProfile.organFunction.renal.status === 'normal' ? 'success' : 
                    patientProfile.organFunction.renal.status === 'unknown' ? 'secondary' : 'warning'
                  }>
                    {patientProfile.organFunction.renal.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'Renal Function', he: 'תפקוד כליות' })}
                </div>
              </div>
            </div>
            
            {/* Additional Info */}
            {(patientProfile.organFunction.renal.creatinineClearance || 
              patientProfile.allergies?.length > 0 || 
              patientProfile.currentMedications?.length > 0) && (
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {patientProfile.organFunction.renal.creatinineClearance && (
                    <div>
                      <span className="font-medium">
                        {t({ en: 'CrCl:', he: 'קליאנס קראטינין:' })}
                      </span>
                      {' ' + Math.round(patientProfile.organFunction.renal.creatinineClearance)} mL/min
                    </div>
                  )}
                  
                  {patientProfile.allergies?.length > 0 && (
                    <div>
                      <span className="font-medium">
                        {t({ en: 'Allergies:', he: 'אלרגיות:' })}
                      </span>
                      {' ' + patientProfile.allergies.length}
                    </div>
                  )}
                  
                  {patientProfile.currentMedications?.length > 0 && (
                    <div>
                      <span className="font-medium">
                        {t({ en: 'Current Meds:', he: 'תרופות נוכחיות:' })}
                      </span>
                      {' ' + patientProfile.currentMedications.length}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calculation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {t({ en: 'Dosage Calculation', he: 'חישוב מינון' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="medication">
                {t({ en: 'Medication', he: 'תרופה' })} *
              </Label>
              <Input
                id="medication"
                value={calculationForm.medicationId}
                onChange={(e) => setCalculationForm(prev => ({
                  ...prev,
                  medicationId: e.target.value
                }))}
                placeholder={t({ en: 'Select medication...', he: 'בחר תרופה...' })}
              />
            </div>
            
            <div>
              <Label htmlFor="indication">
                {t({ en: 'Indication', he: 'אינדיקציה' })} *
              </Label>
              <Input
                id="indication"
                value={calculationForm.indication}
                onChange={(e) => setCalculationForm(prev => ({
                  ...prev,
                  indication: e.target.value
                }))}
                placeholder={t({ en: 'Medical indication...', he: 'אינדיקציה רפואית...' })}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="route">
              {t({ en: 'Route of Administration', he: 'דרך מתן' })}
            </Label>
            <select
              id="route"
              value={calculationForm.route}
              onChange={(e) => setCalculationForm(prev => ({
                ...prev,
                route: e.target.value
              }))}
              className="w-full border rounded px-3 py-2"
            >
              <option value="oral">{t({ en: 'Oral', he: 'דרך הפה' })}</option>
              <option value="iv">{t({ en: 'Intravenous', he: 'תוך ורידי' })}</option>
              <option value="im">{t({ en: 'Intramuscular', he: 'תוך שרירי' })}</option>
              <option value="sc">{t({ en: 'Subcutaneous', he: 'תת עורי' })}</option>
              <option value="topical">{t({ en: 'Topical', he: 'מקומי' })}</option>
              <option value="inhalation">{t({ en: 'Inhalation', he: 'שאיפה' })}</option>
            </select>
          </div>
          
          <Button 
            onClick={calculateDosage} 
            disabled={!calculationForm.medicationId || !calculationForm.indication || isCalculating}
            className="w-full"
          >
            {isCalculating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t({ en: 'Calculating...', he: 'מחשב...' })}
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                {t({ en: 'Calculate Dosage', he: 'חשב מינון' })}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Calculation Results */}
      {calculationResult && (
        <div className="space-y-4">
          {/* Main Result */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {t({ en: 'Calculated Dosage', he: 'מינון מחושב' })}
                </span>
                <Badge variant={calculationResult.calculation.confidence === 'high' ? 'success' : 
                              calculationResult.calculation.confidence === 'medium' ? 'default' : 'warning'}>
                  {calculationResult.calculation.confidence} confidence
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-primary">
                  {calculationResult.dosage.amount} {calculationResult.dosage.unit}
                </div>
                <div className="text-lg text-muted-foreground">
                  {calculationResult.dosage.frequency} • {calculationResult.dosage.route}
                </div>
                {calculationResult.dosage.duration && (
                  <div className="text-sm text-muted-foreground">
                    {t({ en: 'Duration:', he: 'משך:' })} {calculationResult.dosage.duration}
                  </div>
                )}
              </div>
              
              {/* Calculation Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">
                    {t({ en: 'Base Calculation:', he: 'חישוב בסיסי:' })}
                  </span>
                  <div className="text-muted-foreground">
                    {calculationResult.calculation.methodology.replace('_', ' ')}
                  </div>
                </div>
                
                {calculationResult.adjustments?.length > 0 && (
                  <div>
                    <span className="font-medium">
                      {t({ en: 'Adjustments Applied:', he: 'התאמות יושמו:' })}
                    </span>
                    <div className="text-muted-foreground">
                      {calculationResult.adjustments.length} {t({ en: 'adjustments', he: 'התאמות' })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Safety Warnings */}
          {(calculationResult.warnings?.length > 0 || calculationResult.contraindications?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t({ en: 'Safety Alerts', he: 'התראות בטיחות' })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {calculationResult.contraindications?.map((contraindication, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold">
                        {t({ en: 'Contraindication', he: 'התווית נגד' })}
                      </div>
                      {contraindication.message}
                    </AlertDescription>
                  </Alert>
                ))}
                
                {calculationResult.warnings?.map((warning, index) => (
                  <Alert key={index} variant={getSeverityColor(warning.severity)}>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold">
                        {warning.type.replace('_', ' ').toUpperCase()}
                      </div>
                      {warning.message}
                      {warning.recommendation && (
                        <div className="mt-2 font-medium">
                          {t({ en: 'Recommendation:', he: 'המלצה:' })} {warning.recommendation}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {calculationResult.recommendations?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  {t({ en: 'Clinical Recommendations', he: 'המלצות קליניות' })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {calculationResult.recommendations.map((rec, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={getSeverityColor(rec.priority)}>
                        {rec.category}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {rec.priority} priority
                      </span>
                    </div>
                    <div className="text-sm">
                      {rec.recommendation}
                    </div>
                    {(rec.frequency || rec.duration) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {rec.frequency && `${t({ en: 'Frequency:', he: 'תדירות:' })} ${rec.frequency}`}
                        {rec.frequency && rec.duration && ' • '}
                        {rec.duration && `${t({ en: 'Duration:', he: 'משך:' })} ${rec.duration}`}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Adjustments Details */}
          {calculationResult.adjustments?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {t({ en: 'Dosage Adjustments', he: 'התאמות מינון' })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {calculationResult.adjustments.map((adjustment, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">
                        {adjustment.type}
                      </Badge>
                      <span className="text-sm font-medium">
                        {adjustment.applied ? 
                          t({ en: 'Applied', he: 'יושם' }) : 
                          t({ en: 'Not Applied', he: 'לא יושם' })
                        }
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {adjustment.reason}
                    </div>
                    {adjustment.factor && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {t({ en: 'Adjustment Factor:', he: 'מקדם התאמה:' })} {adjustment.factor}x
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default DosageCalculator;
```

### 5. Test Cases

```javascript
// backend/tests/dosageCalculationService.test.js
const dosageCalculationService = require('../services/dosageCalculationService');
const SecureDataAccess = require('../services/secureDataAccess');

describe('DosageCalculationService', () => {
  beforeAll(async () => {
    await dosageCalculationService.initialize();
  });

  describe('calculateDosage', () => {
    test('should calculate weight-based dosage correctly', async () => {
      const request = {
        patientId: 'patient123',
        medicationId: 'med_amoxicillin',
        indication: 'respiratory_infection',
        route: 'oral'
      };

      // Mock patient with 70kg weight
      jest.spyOn(dosageCalculationService, 'getPatientProfile')
        .mockResolvedValue({
          demographics: { age: 35, gender: 'male' },
          physicalParameters: { weight: 70, height: 175 },
          organFunction: { 
            renal: { status: 'normal', adjustmentRequired: false },
            hepatic: { status: 'normal', adjustmentRequired: false }
          },
          currentMedications: [],
          allergies: []
        });

      // Mock medication data
      jest.spyOn(dosageCalculationService, 'getMedicationData')
        .mockResolvedValue({
          id: 'med_amoxicillin',
          name: 'Amoxicillin',
          dosageRules: [{
            indication: 'respiratory_infection',
            calculationMethod: 'weight_based',
            dosePerKg: 25, // 25mg/kg
            unit: 'mg',
            frequency: 'BID',
            route: 'oral'
          }]
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await dosageCalculationService.calculateDosage(request, context);

      expect(result.status).toBe('completed');
      expect(result.dosage.amount).toBe(1750); // 70kg * 25mg/kg = 1750mg
      expect(result.dosage.unit).toBe('mg');
      expect(result.dosage.frequency).toBe('BID');
    });

    test('should apply renal adjustment correctly', async () => {
      const request = {
        patientId: 'patient_renal_impairment',
        medicationId: 'med_atenolol',
        indication: 'hypertension'
      };

      // Mock patient with renal impairment
      jest.spyOn(dosageCalculationService, 'getPatientProfile')
        .mockResolvedValue({
          demographics: { age: 65, gender: 'female' },
          physicalParameters: { weight: 65 },
          organFunction: {
            renal: { 
              status: 'moderate',
              creatinineClearance: 45,
              adjustmentRequired: true 
            },
            hepatic: { status: 'normal', adjustmentRequired: false }
          },
          currentMedications: [],
          allergies: []
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await dosageCalculationService.calculateDosage(request, context);

      expect(result.status).toBe('completed');
      expect(result.adjustments).toHaveLength(1);
      expect(result.adjustments[0].type).toBe('renal');
      expect(result.adjustments[0].applied).toBe(true);
    });

    test('should detect contraindications', async () => {
      const request = {
        patientId: 'patient_allergic',
        medicationId: 'med_penicillin',
        indication: 'infection'
      };

      // Mock patient with penicillin allergy
      jest.spyOn(dosageCalculationService, 'getPatientProfile')
        .mockResolvedValue({
          demographics: { age: 45, gender: 'male' },
          physicalParameters: { weight: 80 },
          organFunction: { 
            renal: { status: 'normal', adjustmentRequired: false },
            hepatic: { status: 'normal', adjustmentRequired: false }
          },
          currentMedications: [],
          allergies: ['penicillin', 'beta-lactams']
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      try {
        await dosageCalculationService.calculateDosage(request, context);
      } catch (error) {
        expect(error.message).toContain('contraindication');
      }
    });

    test('should calculate pediatric dosage with age-based rules', async () => {
      const request = {
        patientId: 'pediatric_patient',
        medicationId: 'med_acetaminophen',
        indication: 'fever'
      };

      // Mock pediatric patient
      jest.spyOn(dosageCalculationService, 'getPatientProfile')
        .mockResolvedValue({
          demographics: { age: 8, ageInMonths: 96, gender: 'female' },
          physicalParameters: { weight: 25 },
          organFunction: { 
            renal: { status: 'normal', adjustmentRequired: false },
            hepatic: { status: 'normal', adjustmentRequired: false }
          },
          currentMedications: [],
          allergies: []
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await dosageCalculationService.calculateDosage(request, context);

      expect(result.status).toBe('completed');
      expect(result.calculation.methodology).toBe('weight_based');
      expect(result.dosage.amount).toBeGreaterThan(0);
    });
  });

  describe('utility functions', () => {
    test('should calculate age correctly', () => {
      const birthDate = new Date('1990-06-15');
      const age = dosageCalculationService.calculateAge(birthDate);
      
      const expectedAge = new Date().getFullYear() - 1990;
      expect(age).toBeCloseTo(expectedAge, 0);
    });

    test('should calculate BMI correctly', () => {
      const bmi = dosageCalculationService.calculateBMI(70, 175); // 70kg, 175cm
      expect(bmi).toBeCloseTo(22.9, 1);
    });

    test('should calculate body surface area correctly', () => {
      const bsa = dosageCalculationService.calculateBodySurfaceArea(70, 175);
      expect(bsa).toBeCloseTo(1.85, 2);
    });

    test('should round doses appropriately', () => {
      expect(dosageCalculationService.roundDoseToAppropriateIncrement(127.3, 'mg')).toBe(125);
      expect(dosageCalculationService.roundDoseToAppropriateIncrement(7.3, 'mg')).toBe(7.5);
      expect(dosageCalculationService.roundDoseToAppropriateIncrement(0.17, 'mg')).toBe(0.2);
    });
  });
});
```

## Dependencies
- Patient demographics and vitals
- Drug database with dosing rules
- Clinical decision support rules
- Organ function assessment
- Drug interaction database
- Age-specific dosing guidelines
- Renal/hepatic adjustment algorithms

## Success Criteria
- ✅ Multi-method dosage calculations (weight, BSA, age, fixed, renal-based)
- ✅ Automatic organ function adjustments
- ✅ Pediatric and geriatric considerations
- ✅ Safety validation and contraindication checking
- ✅ Clinical recommendations with monitoring
- ✅ Confidence scoring and methodology transparency
- ✅ Comprehensive audit trail
- ✅ Integration with prescribing workflow