# Insurance Formulary Verification System

## Function Details
**Function Name**: verifyFormularyStatus  
**Location**: backend/services/formularyVerificationService.js  
**Status**: Not Implemented  
**Priority**: High (P1)  
**Complexity**: High  
**Estimated Time**: 10-14 hours  

## Problem Description
Comprehensive insurance formulary verification system with real-time coverage checking, tier status determination, prior authorization requirements, step therapy protocols, quantity limits, and alternative medication recommendations.

## Implementation Steps

### 1. Core Service Implementation

```javascript
// backend/services/formularyVerificationService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const pbmIntegration = require('./pbmIntegrationService');
const drugDatabase = require('./drugDatabase');
const coverMyMedsAPI = require('./coverMyMedsAPI');

class FormularyVerificationService {
  constructor() {
    this.serviceToken = null;
    this.formularyCache = new Map();
    this.tierMappings = new Map();
    this.pbmConnections = new Map();
    this.priorAuthRules = new Map();
    this.stepTherapyProtocols = new Map();
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('formulary-verification-service');
    await this.loadTierMappings();
    await this.loadPBMConnections();
    await this.loadPriorAuthRules();
    await this.loadStepTherapyProtocols();
    await this.initializeCacheManager();
  }

  async verifyFormularyStatus(verificationRequest, context) {
    try {
      await this.validateVerificationRequest(verificationRequest, context);
      
      const patientInsurance = await this.getPatientInsurance(
        verificationRequest.patientId,
        context
      );
      
      const medicationDetails = await this.getMedicationDetails(
        verificationRequest.medicationData,
        context
      );
      
      const formularyChecks = await this.performFormularyChecks(
        patientInsurance,
        medicationDetails,
        verificationRequest.options || {},
        context
      );
      
      const coverageAnalysis = await this.analyzeCoverageOptions(
        formularyChecks,
        medicationDetails,
        patientInsurance,
        context
      );
      
      const alternativeRecommendations = await this.generateAlternativeRecommendations(
        coverageAnalysis,
        medicationDetails,
        patientInsurance,
        context
      );
      
      const costEstimates = await this.calculateCostEstimates(
        coverageAnalysis,
        medicationDetails,
        verificationRequest.pharmacyId,
        context
      );
      
      const verificationReport = await this.generateVerificationReport(
        formularyChecks,
        coverageAnalysis,
        alternativeRecommendations,
        costEstimates,
        verificationRequest,
        context
      );
      
      await this.cacheVerificationResult(verificationRequest, verificationReport, context);
      await this.auditFormularyVerification(verificationRequest, verificationReport, context);
      
      return {
        verificationId: verificationReport.id,
        status: 'completed',
        coverage: {
          isFormulary: verificationReport.coverage.isFormulary,
          tier: verificationReport.coverage.tier,
          copayAmount: verificationReport.coverage.copayAmount,
          coinsurancePercent: verificationReport.coverage.coinsurancePercent,
          deductibleApplies: verificationReport.coverage.deductibleApplies
        },
        restrictions: {
          priorAuthRequired: verificationReport.restrictions.priorAuthRequired,
          stepTherapyRequired: verificationReport.restrictions.stepTherapyRequired,
          quantityLimits: verificationReport.restrictions.quantityLimits,
          ageRestrictions: verificationReport.restrictions.ageRestrictions
        },
        alternatives: alternativeRecommendations,
        costEstimate: costEstimates,
        recommendations: verificationReport.recommendations,
        metadata: verificationReport.metadata
      };
      
    } catch (error) {
      await this.handleVerificationError(error, verificationRequest, context);
      throw error;
    }
  }

  async validateVerificationRequest(request, context) {
    if (!request.patientId) {
      throw new Error('Patient ID is required for formulary verification');
    }
    
    if (!request.medicationData) {
      throw new Error('Medication data is required for formulary verification');
    }
    
    if (!request.medicationData.rxcui && !request.medicationData.ndc && !request.medicationData.name) {
      throw new Error('Medication must have RxCUI, NDC, or name for verification');
    }
  }

  async getPatientInsurance(patientId, context) {
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    if (!patient.insurance || patient.insurance.length === 0) {
      throw new Error('No insurance information found for patient');
    }
    
    // Enrich insurance data with current status
    const enrichedInsurance = await Promise.all(
      patient.insurance.map(async (insurance) => {
        const insuranceDetails = await this.getInsuranceDetails(insurance, context);
        return {
          ...insurance,
          planDetails: insuranceDetails,
          isActive: await this.verifyInsuranceStatus(insurance, context),
          pbmProvider: await this.identifyPBMProvider(insurance, context),
          formularyVersion: await this.getFormularyVersion(insurance, context)
        };
      })
    );
    
    return enrichedInsurance.filter(ins => ins.isActive);
  }

  async getMedicationDetails(medicationData, context) {
    let medication = medicationData;
    
    // If only name provided, try to get RxCUI/NDC
    if (!medication.rxcui && !medication.ndc && medication.name) {
      const drugInfo = await drugDatabase.findByName(medication.name);
      if (drugInfo) {
        medication = {
          ...medication,
          rxcui: drugInfo.rxcui,
          ndc: drugInfo.ndc,
          genericName: drugInfo.genericName,
          therapeuticClass: drugInfo.therapeuticClass
        };
      }
    }
    
    // Get comprehensive drug information
    const drugDetails = await drugDatabase.getComprehensiveInfo(
      medication.rxcui || medication.ndc || medication.name
    );
    
    return {
      ...medication,
      drugDetails: drugDetails,
      therapeuticEquivalents: await drugDatabase.getTherapeuticEquivalents(
        medication.rxcui || medication.ndc
      ),
      genericAlternatives: await drugDatabase.getGenericAlternatives(
        medication.rxcui || medication.ndc
      ),
      brandAlternatives: await drugDatabase.getBrandAlternatives(
        medication.rxcui || medication.ndc
      )
    };
  }

  async performFormularyChecks(insuranceList, medicationDetails, options, context) {
    const formularyResults = [];
    
    for (const insurance of insuranceList) {
      try {
        const formularyCheck = await this.checkSingleFormulary(
          insurance,
          medicationDetails,
          options,
          context
        );
        
        formularyResults.push({
          insurance: insurance,
          formularyStatus: formularyCheck,
          checkTimestamp: new Date()
        });
      } catch (error) {
        formularyResults.push({
          insurance: insurance,
          formularyStatus: {
            error: true,
            errorMessage: error.message,
            isFormulary: false
          },
          checkTimestamp: new Date()
        });
      }
    }
    
    return formularyResults;
  }

  async checkSingleFormulary(insurance, medicationDetails, options, context) {
    // Check cache first
    const cacheKey = this.generateCacheKey(insurance, medicationDetails);
    if (this.formularyCache.has(cacheKey)) {
      const cached = this.formularyCache.get(cacheKey);
      if (this.isCacheValid(cached)) {
        return cached.data;
      }
    }
    
    let formularyResult;
    
    // Determine verification method based on PBM provider
    switch (insurance.pbmProvider) {
      case 'express_scripts':
        formularyResult = await this.checkExpressScriptsFormulary(insurance, medicationDetails, options, context);
        break;
      case 'cvs_caremark':
        formularyResult = await this.checkCVSCaremarkFormulary(insurance, medicationDetails, options, context);
        break;
      case 'optum_rx':
        formularyResult = await this.checkOptumRxFormulary(insurance, medicationDetails, options, context);
        break;
      case 'humana_pharmacy':
        formularyResult = await this.checkHumanaFormulary(insurance, medicationDetails, options, context);
        break;
      default:
        // Use generic formulary checking via CoverMyMeds or similar
        formularyResult = await this.checkGenericFormulary(insurance, medicationDetails, options, context);
    }
    
    // Cache the result
    this.formularyCache.set(cacheKey, {
      data: formularyResult,
      timestamp: new Date(),
      ttl: 3600000 // 1 hour
    });
    
    return formularyResult;
  }

  async checkGenericFormulary(insurance, medicationDetails, options, context) {
    try {
      // Use CoverMyMeds API or similar service
      const response = await coverMyMedsAPI.checkFormulary({
        planId: insurance.planId,
        rxBin: insurance.rxBin,
        rxPcn: insurance.rxPcn,
        rxGroup: insurance.rxGroup,
        medication: {
          rxcui: medicationDetails.rxcui,
          ndc: medicationDetails.ndc,
          name: medicationDetails.name
        },
        quantity: options.quantity || 30,
        daysSupply: options.daysSupply || 30
      });
      
      return {
        isFormulary: response.coverage.covered,
        tier: response.coverage.tier,
        copayAmount: response.coverage.copay,
        coinsurancePercent: response.coverage.coinsurance,
        deductibleApplies: response.coverage.deductible_applies,
        priorAuthRequired: response.restrictions.prior_auth_required,
        stepTherapyRequired: response.restrictions.step_therapy_required,
        quantityLimits: response.restrictions.quantity_limits,
        ageRestrictions: response.restrictions.age_restrictions,
        alternatives: response.alternatives || [],
        lastUpdated: new Date(response.last_updated),
        dataSource: 'CoverMyMeds'
      };
    } catch (error) {
      throw new Error(`Generic formulary check failed: ${error.message}`);
    }
  }

  async checkExpressScriptsFormulary(insurance, medicationDetails, options, context) {
    // Express Scripts specific formulary checking
    const esClient = pbmIntegration.getExpressScriptsClient();
    
    const formularyRequest = {
      memberId: insurance.memberId,
      groupNumber: insurance.groupNumber,
      planEffectiveDate: insurance.effectiveDate,
      medication: {
        rxcui: medicationDetails.rxcui,
        ndc: medicationDetails.ndc,
        genericProductIdentifier: medicationDetails.drugDetails?.gpi
      },
      prescriptionDetails: {
        quantity: options.quantity || 30,
        daysSupply: options.daysSupply || 30,
        prescribedDate: options.prescribedDate || new Date()
      }
    };
    
    const response = await esClient.checkFormularyStatus(formularyRequest);
    
    return {
      isFormulary: response.formularyStatus === 'covered',
      tier: response.tier,
      copayAmount: response.memberCostShare?.copay,
      coinsurancePercent: response.memberCostShare?.coinsurance,
      deductibleApplies: response.memberCostShare?.deductibleApplies,
      priorAuthRequired: response.utilityManagement?.priorAuthorizationRequired,
      stepTherapyRequired: response.utilityManagement?.stepTherapyRequired,
      quantityLimits: response.utilityManagement?.quantityLimits,
      ageRestrictions: response.utilityManagement?.ageRestrictions,
      alternatives: await this.mapExpressScriptsAlternatives(response.alternatives),
      lastUpdated: new Date(),
      dataSource: 'Express Scripts'
    };
  }

  async analyzeCoverageOptions(formularyChecks, medicationDetails, patientInsurance, context) {
    const coverageOptions = [];
    
    for (const check of formularyChecks) {
      if (check.formularyStatus.error) {
        continue;
      }
      
      const option = {
        insurance: {
          planName: check.insurance.planName,
          memberId: check.insurance.memberId,
          planId: check.insurance.planId
        },
        coverage: check.formularyStatus,
        patientCost: await this.calculatePatientCost(
          check.formularyStatus,
          medicationDetails,
          check.insurance,
          context
        ),
        recommendations: await this.generateCoverageRecommendations(
          check.formularyStatus,
          medicationDetails,
          context
        )
      };
      
      coverageOptions.push(option);
    }
    
    // Sort by patient cost (lowest first)
    coverageOptions.sort((a, b) => {
      const costA = a.patientCost.estimatedCost || Infinity;
      const costB = b.patientCost.estimatedCost || Infinity;
      return costA - costB;
    });
    
    return {
      originalMedication: medicationDetails,
      coverageOptions: coverageOptions,
      bestOption: coverageOptions.length > 0 ? coverageOptions[0] : null,
      hasFormularyCoverage: coverageOptions.some(opt => opt.coverage.isFormulary),
      requiresIntervention: coverageOptions.some(opt => 
        opt.coverage.priorAuthRequired || opt.coverage.stepTherapyRequired
      )
    };
  }

  async generateAlternativeRecommendations(coverageAnalysis, medicationDetails, patientInsurance, context) {
    const alternatives = [];
    
    // If original medication is not covered or expensive, find alternatives
    if (!coverageAnalysis.hasFormularyCoverage || 
        (coverageAnalysis.bestOption?.patientCost.estimatedCost > 50)) {
      
      // Get therapeutic alternatives
      const therapeuticAlternatives = await this.getTherapeuticAlternatives(
        medicationDetails,
        patientInsurance,
        context
      );
      
      // Get generic alternatives
      const genericAlternatives = await this.getGenericAlternatives(
        medicationDetails,
        patientInsurance,
        context
      );
      
      // Get formulary-preferred alternatives
      const formularyAlternatives = await this.getFormularyPreferredAlternatives(
        medicationDetails,
        patientInsurance,
        context
      );
      
      // Combine and rank alternatives
      const allAlternatives = [
        ...therapeuticAlternatives,
        ...genericAlternatives,
        ...formularyAlternatives
      ];
      
      // Deduplicate and rank by cost and coverage
      const rankedAlternatives = await this.rankAlternatives(
        allAlternatives,
        patientInsurance,
        context
      );
      
      alternatives.push(...rankedAlternatives.slice(0, 10)); // Top 10 alternatives
    }
    
    return alternatives;
  }

  async getTherapeuticAlternatives(medicationDetails, patientInsurance, context) {
    const alternatives = [];
    
    if (medicationDetails.therapeuticEquivalents) {
      for (const equivalent of medicationDetails.therapeuticEquivalents) {
        const formularyStatus = await this.quickFormularyCheck(
          equivalent,
          patientInsurance,
          context
        );
        
        if (formularyStatus.some(status => status.isFormulary)) {
          alternatives.push({
            medication: equivalent,
            alternativeType: 'therapeutic_equivalent',
            formularyStatus: formularyStatus,
            cost: await this.estimateAlternativeCost(equivalent, patientInsurance, context)
          });
        }
      }
    }
    
    return alternatives;
  }

  async calculatePatientCost(formularyStatus, medicationDetails, insurance, context) {
    let estimatedCost = 0;
    let costBreakdown = {};
    
    if (!formularyStatus.isFormulary) {
      // Not covered - patient pays full price
      const retailPrice = await this.getRetailPrice(medicationDetails, context);
      estimatedCost = retailPrice;
      costBreakdown = {
        retailPrice: retailPrice,
        insurancePays: 0,
        patientPays: retailPrice,
        costType: 'not_covered'
      };
    } else {
      // Covered - calculate based on tier and plan details
      if (formularyStatus.copayAmount) {
        // Fixed copay
        estimatedCost = formularyStatus.copayAmount;
        costBreakdown = {
          copay: formularyStatus.copayAmount,
          costType: 'copay'
        };
      } else if (formularyStatus.coinsurancePercent) {
        // Percentage coinsurance
        const retailPrice = await this.getRetailPrice(medicationDetails, context);
        const insurancePays = retailPrice * (1 - formularyStatus.coinsurancePercent / 100);
        const patientPays = retailPrice - insurancePays;
        
        estimatedCost = patientPays;
        costBreakdown = {
          retailPrice: retailPrice,
          coinsurancePercent: formularyStatus.coinsurancePercent,
          insurancePays: insurancePays,
          patientPays: patientPays,
          costType: 'coinsurance'
        };
      }
      
      // Add deductible if applicable
      if (formularyStatus.deductibleApplies) {
        const remainingDeductible = await this.getRemainingDeductible(insurance, context);
        if (remainingDeductible > 0) {
          const additionalDeductible = Math.min(remainingDeductible, estimatedCost);
          costBreakdown.deductibleAmount = additionalDeductible;
          estimatedCost += additionalDeductible;
        }
      }
    }
    
    return {
      estimatedCost: Math.round(estimatedCost * 100) / 100, // Round to cents
      costBreakdown: costBreakdown,
      calculatedAt: new Date(),
      disclaimers: [
        'Costs are estimates and may vary by pharmacy',
        'Actual costs depend on plan benefits and deductible status',
        'Prices subject to change'
      ]
    };
  }

  async generateCoverageRecommendations(formularyStatus, medicationDetails, context) {
    const recommendations = [];
    
    if (!formularyStatus.isFormulary) {
      recommendations.push({
        type: 'not_covered',
        priority: 'high',
        action: 'Consider formulary alternatives',
        description: 'This medication is not covered by the insurance plan. Consider therapeutic alternatives or request prior authorization.',
        nextSteps: [
          'Review therapeutic alternatives',
          'Submit prior authorization if clinically necessary',
          'Consider generic alternatives'
        ]
      });
    }
    
    if (formularyStatus.priorAuthRequired) {
      recommendations.push({
        type: 'prior_authorization',
        priority: 'high',
        action: 'Prior authorization required',
        description: 'Insurance requires prior authorization for this medication.',
        nextSteps: [
          'Submit prior authorization request',
          'Provide clinical documentation',
          'Consider alternatives while waiting for approval'
        ],
        estimatedProcessingTime: '3-5 business days'
      });
    }
    
    if (formularyStatus.stepTherapyRequired) {
      recommendations.push({
        type: 'step_therapy',
        priority: 'medium',
        action: 'Step therapy protocol required',
        description: 'Patient must try preferred alternatives before this medication is covered.',
        nextSteps: [
          'Review step therapy requirements',
          'Try preferred alternatives first',
          'Document failure of preferred alternatives if applicable'
        ]
      });
    }
    
    if (formularyStatus.quantityLimits) {
      recommendations.push({
        type: 'quantity_limits',
        priority: 'medium',
        action: 'Quantity limits apply',
        description: `Insurance limits coverage to ${formularyStatus.quantityLimits.maxQuantity} units per ${formularyStatus.quantityLimits.limitPeriod}.`,
        nextSteps: [
          'Adjust prescription quantity to meet limits',
          'Request override if clinically necessary',
          'Consider alternative dosing regimens'
        ]
      });
    }
    
    return recommendations;
  }

  async quickFormularyCheck(medication, insuranceList, context) {
    const results = [];
    
    for (const insurance of insuranceList.slice(0, 3)) { // Check top 3 insurance plans
      try {
        const result = await this.checkSingleFormulary(
          insurance,
          { ...medication },
          {},
          context
        );
        results.push(result);
      } catch (error) {
        results.push({
          error: true,
          errorMessage: error.message,
          isFormulary: false
        });
      }
    }
    
    return results;
  }

  generateCacheKey(insurance, medicationDetails) {
    const keyComponents = [
      insurance.planId || insurance.memberId,
      medicationDetails.rxcui || medicationDetails.ndc || medicationDetails.name,
      insurance.formularyVersion || 'latest'
    ];
    
    return Buffer.from(keyComponents.join('|')).toString('base64');
  }

  isCacheValid(cachedData) {
    const now = new Date();
    const age = now - cachedData.timestamp;
    return age < cachedData.ttl;
  }

  async auditFormularyVerification(request, report, context) {
    await AuditLog.create({
      action: 'FORMULARY_VERIFICATION',
      entityType: 'formulary_verification',
      entityId: report.id,
      patientId: request.patientId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        medicationRxCUI: request.medicationData.rxcui,
        medicationName: request.medicationData.name,
        insurancePlansChecked: report.coverageOptions.length,
        hasFormularyCoverage: report.coverage.isFormulary,
        tier: report.coverage.tier,
        priorAuthRequired: report.restrictions.priorAuthRequired,
        estimatedCost: report.costEstimate.estimatedCost,
        dataSource: report.metadata.dataSource
      },
      timestamp: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }
}

module.exports = new FormularyVerificationService();
```

### 2. API Endpoints

```javascript
// backend/routes/formulary-verification.js
const express = require('express');
const router = express.Router();
const formularyVerificationService = require('../services/formularyVerificationService');
const authMiddleware = require('../middleware/auth');
const auditMiddleware = require('../middleware/audit');

router.post('/verify',
  authMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const verificationRequest = {
        patientId: req.body.patientId,
        medicationData: req.body.medicationData,
        pharmacyId: req.body.pharmacyId,
        options: req.body.options || {}
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await formularyVerificationService.verifyFormularyStatus(
        verificationRequest,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Formulary verification completed successfully',
          he: 'אימות פורמולרי הושלם בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Formulary verification failed',
          he: 'אימות פורמולרי נכשל'
        }
      });
    }
  }
);

router.post('/batch-verify',
  authMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const batchRequest = {
        patientId: req.body.patientId,
        medications: req.body.medications, // Array of medications
        pharmacyId: req.body.pharmacyId,
        options: req.body.options || {}
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const results = await Promise.all(
        batchRequest.medications.map(medication => 
          formularyVerificationService.verifyFormularyStatus({
            patientId: batchRequest.patientId,
            medicationData: medication,
            pharmacyId: batchRequest.pharmacyId,
            options: batchRequest.options
          }, context)
        )
      );

      res.json({
        success: true,
        data: {
          verifications: results,
          summary: {
            totalMedications: results.length,
            formularyMedications: results.filter(r => r.coverage.isFormulary).length,
            requiresPriorAuth: results.filter(r => r.restrictions.priorAuthRequired).length,
            totalEstimatedCost: results.reduce((sum, r) => sum + (r.costEstimate.estimatedCost || 0), 0)
          }
        },
        message: {
          en: 'Batch formulary verification completed successfully',
          he: 'אימות פורמולרי באצווה הושלם בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Batch formulary verification failed',
          he: 'אימות פורמולרי באצווה נכשל'
        }
      });
    }
  }
);

router.get('/alternatives/:medicationId',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const medicationData = {
        rxcui: req.params.medicationId,
        name: req.query.name
      };

      const patientId = req.query.patientId;
      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: {
            en: 'Patient ID is required',
            he: 'נדרש מזהה מטופל'
          }
        });
      }

      const patientInsurance = await formularyVerificationService.getPatientInsurance(
        patientId,
        context
      );

      const alternatives = await formularyVerificationService.generateAlternativeRecommendations(
        { hasFormularyCoverage: false },
        { ...medicationData },
        patientInsurance,
        context
      );

      res.json({
        success: true,
        data: alternatives,
        message: {
          en: 'Alternative medications retrieved successfully',
          he: 'תרופות חלופיות נשלפו בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve alternative medications',
          he: 'נכשל בשליפת תרופות חלופיות'
        }
      });
    }
  }
);

router.get('/patient/:patientId/formulary-summary',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const patientInsurance = await formularyVerificationService.getPatientInsurance(
        req.params.patientId,
        context
      );

      // Get patient's current medications
      const currentMeds = await SecureDataAccess.query(
        'prescriptions',
        {
          patientId: req.params.patientId,
          status: 'active'
        },
        { populate: ['medication'] },
        context
      );

      const formularyChecks = await Promise.all(
        currentMeds.map(med => 
          formularyVerificationService.verifyFormularyStatus({
            patientId: req.params.patientId,
            medicationData: med.medication
          }, context)
        )
      );

      const summary = {
        patientId: req.params.patientId,
        insurancePlans: patientInsurance.length,
        currentMedications: currentMeds.length,
        formularyMedications: formularyChecks.filter(check => check.coverage.isFormulary).length,
        nonFormularyMedications: formularyChecks.filter(check => !check.coverage.isFormulary).length,
        totalEstimatedCost: formularyChecks.reduce((sum, check) => sum + (check.costEstimate.estimatedCost || 0), 0),
        medicationsRequiringAction: formularyChecks.filter(check => 
          check.restrictions.priorAuthRequired || check.restrictions.stepTherapyRequired
        ).length
      };

      res.json({
        success: true,
        data: summary,
        message: {
          en: 'Formulary summary retrieved successfully',
          he: 'סיכום פורמולרי נשלף בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve formulary summary',
          he: 'נכשל בשליפת סיכום פורמולרי'
        }
      });
    }
  }
);

module.exports = router;
```

### 3. Data Models

```javascript
// backend/models/FormularyVerification.js
const mongoose = require('mongoose');

const FormularyVerificationSchema = new mongoose.Schema({
  verificationId: {
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
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true
  },
  medication: {
    rxcui: String,
    ndc: String,
    name: {
      type: String,
      required: true
    },
    genericName: String,
    strength: String,
    dosageForm: String,
    therapeuticClass: String
  },
  insuranceVerifications: [{
    insurance: {
      planId: String,
      planName: String,
      memberId: String,
      groupNumber: String,
      pbmProvider: String
    },
    formularyStatus: {
      isFormulary: {
        type: Boolean,
        required: true
      },
      tier: {
        type: String,
        enum: ['tier1', 'tier2', 'tier3', 'tier4', 'specialty', 'not_covered']
      },
      copayAmount: Number,
      coinsurancePercent: Number,
      deductibleApplies: Boolean
    },
    restrictions: {
      priorAuthRequired: {
        type: Boolean,
        default: false
      },
      stepTherapyRequired: {
        type: Boolean,
        default: false
      },
      quantityLimits: {
        hasLimits: Boolean,
        maxQuantity: Number,
        limitPeriod: String, // 'day', 'month', 'year'
        refillLimits: Number
      },
      ageRestrictions: {
        hasRestrictions: Boolean,
        minAge: Number,
        maxAge: Number
      }
    },
    costEstimate: {
      estimatedCost: Number,
      costBreakdown: {
        retailPrice: Number,
        copay: Number,
        coinsurance: Number,
        deductibleAmount: Number,
        insurancePays: Number,
        patientPays: Number,
        costType: {
          type: String,
          enum: ['copay', 'coinsurance', 'not_covered', 'deductible']
        }
      },
      calculatedAt: Date
    },
    dataSource: {
      type: String,
      enum: ['express_scripts', 'cvs_caremark', 'optum_rx', 'humana_pharmacy', 'cover_my_meds', 'manual']
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],
  alternatives: [{
    medication: {
      rxcui: String,
      ndc: String,
      name: String,
      genericName: String,
      strength: String,
      dosageForm: String
    },
    alternativeType: {
      type: String,
      enum: ['generic', 'therapeutic_equivalent', 'formulary_preferred', 'lower_tier']
    },
    potentialSavings: Number,
    formularyStatus: {
      isFormulary: Boolean,
      tier: String,
      estimatedCost: Number
    },
    clinicalNotes: String
  }],
  recommendations: [{
    type: {
      type: String,
      enum: ['not_covered', 'prior_authorization', 'step_therapy', 'quantity_limits', 'cost_optimization']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent']
    },
    action: String,
    description: String,
    nextSteps: [String],
    estimatedProcessingTime: String,
    alternativeSuggestions: [String]
  }],
  summary: {
    hasFormularyCoverage: Boolean,
    bestOption: {
      insurancePlan: String,
      tier: String,
      estimatedCost: Number
    },
    requiresIntervention: Boolean,
    totalAlternatives: Number,
    potentialSavings: Number
  },
  verificationOptions: {
    includeAlternatives: {
      type: Boolean,
      default: true
    },
    includeCostEstimates: {
      type: Boolean,
      default: true
    },
    pharmacyId: String,
    quantity: Number,
    daysSupply: Number
  },
  metadata: {
    verifiedAt: {
      type: Date,
      default: Date.now
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    processingTime: Number, // milliseconds
    cacheHit: Boolean,
    apiCallsRequired: Number,
    dataQuality: {
      type: String,
      enum: ['high', 'medium', 'low']
    }
  }
});

// Indexes for performance
FormularyVerificationSchema.index({ patientId: 1, 'metadata.verifiedAt': -1 });
FormularyVerificationSchema.index({ 'medication.rxcui': 1 });
FormularyVerificationSchema.index({ 'insuranceVerifications.insurance.planId': 1 });
FormularyVerificationSchema.index({ practiceId: 1, 'metadata.verifiedAt': -1 });

module.exports = mongoose.model('FormularyVerification', FormularyVerificationSchema);
```

### 4. Frontend Components

```jsx
// frontend-vite/src/components/formulary/FormularyVerification.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  CreditCard,
  Pill,
  TrendingDown
} from 'lucide-react';
import secureApiClient from '@/services/secureApiClient';
import { useTranslation } from '@/hooks/useTranslation';

const FormularyVerification = ({ medicationData, patientId, onVerificationComplete }) => {
  const { t } = useTranslation();
  const [verificationResult, setVerificationResult] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (medicationData && patientId) {
      verifyFormulary();
    }
  }, [medicationData, patientId]);

  const verifyFormulary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await secureApiClient.post('/api/formulary-verification/verify', {
        patientId,
        medicationData,
        options: {
          includeAlternatives: true,
          includeCostEstimates: true
        }
      });

      if (response.data.success) {
        setVerificationResult(response.data.data);
        setAlternatives(response.data.data.alternatives || []);
        
        if (onVerificationComplete) {
          onVerificationComplete(response.data.data);
        }
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Verification failed');
      console.error('Formulary verification error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'tier1': return 'success';
      case 'tier2': return 'default';
      case 'tier3': return 'warning';
      case 'tier4': 
      case 'specialty': return 'destructive';
      case 'not_covered': return 'secondary';
      default: return 'default';
    }
  };

  const getTierLabel = (tier) => {
    const labels = {
      tier1: t({ en: 'Tier 1 (Generic)', he: 'רמה 1 (גנרי)' }),
      tier2: t({ en: 'Tier 2 (Preferred Brand)', he: 'רמה 2 (מותג מועדף)' }),
      tier3: t({ en: 'Tier 3 (Non-Preferred Brand)', he: 'רמה 3 (מותג לא מועדף)' }),
      tier4: t({ en: 'Tier 4 (High-Cost)', he: 'רמה 4 (עלות גבוהה)' }),
      specialty: t({ en: 'Specialty', he: 'מיוחד' }),
      not_covered: t({ en: 'Not Covered', he: 'לא מכוסה' })
    };
    return labels[tier] || tier;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <div className="mt-4">
            {t({ en: 'Verifying formulary status...', he: 'מאמת סטטוס פורמולרי...' })}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error.en || error}
            </AlertDescription>
          </Alert>
          <Button onClick={verifyFormulary} className="mt-4">
            {t({ en: 'Retry Verification', he: 'נסה שוב אימות' })}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!verificationResult) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <div className="text-lg font-semibold">
            {t({ en: 'No Verification Data', he: 'אין נתוני אימות' })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Coverage Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t({ en: 'Formulary Coverage Status', he: 'סטטוס כיסוי פורמולרי' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                verificationResult.coverage.isFormulary ? 'text-green-600' : 'text-red-600'
              }`}>
                {verificationResult.coverage.isFormulary ? 
                  <CheckCircle className="h-8 w-8 mx-auto" /> : 
                  <AlertTriangle className="h-8 w-8 mx-auto" />
                }
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {verificationResult.coverage.isFormulary ? 
                  t({ en: 'Covered', he: 'מכוסה' }) : 
                  t({ en: 'Not Covered', he: 'לא מכוסה' })
                }
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                <Badge variant={getTierColor(verificationResult.coverage.tier)} className="text-lg px-3 py-1">
                  {getTierLabel(verificationResult.coverage.tier)}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {t({ en: 'Coverage Tier', he: 'רמת כיסוי' })}
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(verificationResult.costEstimate.estimatedCost)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {t({ en: 'Estimated Cost', he: 'עלות משוערת' })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Restrictions & Requirements */}
      {(verificationResult.restrictions.priorAuthRequired || 
        verificationResult.restrictions.stepTherapyRequired || 
        verificationResult.restrictions.quantityLimits) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t({ en: 'Coverage Restrictions', he: 'הגבלות כיסוי' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {verificationResult.restrictions.priorAuthRequired && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold">
                    {t({ en: 'Prior Authorization Required', he: 'נדרש אישור מוקדם' })}
                  </div>
                  <div className="text-sm mt-1">
                    {t({ 
                      en: 'Insurance requires prior approval before covering this medication.',
                      he: 'הביטוח דורש אישור מוקדם לפני כיסוי תרופה זו.'
                    })}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {verificationResult.restrictions.stepTherapyRequired && (
              <Alert>
                <TrendingDown className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold">
                    {t({ en: 'Step Therapy Required', he: 'נדרש טיפול מדורג' })}
                  </div>
                  <div className="text-sm mt-1">
                    {t({ 
                      en: 'Patient must try preferred alternatives before this medication is covered.',
                      he: 'המטופל חייב לנסות חלופות מועדפות לפני כיסוי תרופה זו.'
                    })}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {verificationResult.restrictions.quantityLimits && (
              <Alert>
                <Pill className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold">
                    {t({ en: 'Quantity Limits Apply', he: 'חלות הגבלות כמות' })}
                  </div>
                  <div className="text-sm mt-1">
                    {t({ 
                      en: `Limited to ${verificationResult.restrictions.quantityLimits.maxQuantity} units per ${verificationResult.restrictions.quantityLimits.limitPeriod}.`,
                      he: `מוגבל ל-${verificationResult.restrictions.quantityLimits.maxQuantity} יחידות לכל ${verificationResult.restrictions.quantityLimits.limitPeriod}.`
                    })}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cost Breakdown */}
      {verificationResult.costEstimate.costBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {t({ en: 'Cost Breakdown', he: 'פירוט עלויות' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {verificationResult.costEstimate.costBreakdown.retailPrice && (
                <div className="flex justify-between items-center">
                  <span>{t({ en: 'Retail Price:', he: 'מחיר קמעונאי:' })}</span>
                  <span className="font-semibold">
                    {formatCurrency(verificationResult.costEstimate.costBreakdown.retailPrice)}
                  </span>
                </div>
              )}

              {verificationResult.costEstimate.costBreakdown.insurancePays && (
                <div className="flex justify-between items-center">
                  <span>{t({ en: 'Insurance Pays:', he: 'הביטוח משלם:' })}</span>
                  <span className="font-semibold text-green-600">
                    -{formatCurrency(verificationResult.costEstimate.costBreakdown.insurancePays)}
                  </span>
                </div>
              )}

              {verificationResult.costEstimate.costBreakdown.copay && (
                <div className="flex justify-between items-center">
                  <span>{t({ en: 'Your Copay:', he: 'השתתפות עצמית:' })}</span>
                  <span className="font-semibold">
                    {formatCurrency(verificationResult.costEstimate.costBreakdown.copay)}
                  </span>
                </div>
              )}

              {verificationResult.costEstimate.costBreakdown.deductibleAmount && (
                <div className="flex justify-between items-center">
                  <span>{t({ en: 'Deductible:', he: 'השתתפות:' })}</span>
                  <span className="font-semibold">
                    {formatCurrency(verificationResult.costEstimate.costBreakdown.deductibleAmount)}
                  </span>
                </div>
              )}

              <hr />
              <div className="flex justify-between items-center text-lg font-bold">
                <span>{t({ en: 'Total Cost:', he: 'עלות סה"כ:' })}</span>
                <span>{formatCurrency(verificationResult.costEstimate.estimatedCost)}</span>
              </div>
            </div>

            {verificationResult.costEstimate.disclaimers && (
              <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
                <div className="font-semibold mb-1">
                  {t({ en: 'Important Notes:', he: 'הערות חשובות:' })}
                </div>
                {verificationResult.costEstimate.disclaimers.map((disclaimer, index) => (
                  <div key={index}>• {disclaimer}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alternative Medications */}
      {alternatives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5" />
              {t({ en: 'Alternative Medications', he: 'תרופות חלופיות' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alternatives.slice(0, 5).map((alternative, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium">{alternative.medication.name}</h5>
                      {alternative.medication.genericName && (
                        <p className="text-sm text-muted-foreground">
                          {alternative.medication.genericName}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {alternative.alternativeType.replace('_', ' ')}
                        </Badge>
                        {alternative.formularyStatus.isFormulary && (
                          <Badge variant="success" className="text-xs">
                            {t({ en: 'Covered', he: 'מכוסה' })}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatCurrency(alternative.formularyStatus.estimatedCost)}
                      </div>
                      {alternative.potentialSavings > 0 && (
                        <div className="text-sm text-green-600">
                          Save {formatCurrency(alternative.potentialSavings)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {alternatives.length > 5 && (
                <div className="text-center text-sm text-muted-foreground">
                  +{alternatives.length - 5} more alternatives available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {verificationResult.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              {t({ en: 'Recommendations', he: 'המלצות' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {verificationResult.recommendations.map((rec, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={
                    rec.priority === 'high' ? 'destructive' :
                    rec.priority === 'medium' ? 'warning' : 'default'
                  }>
                    {rec.priority}
                  </Badge>
                  <span className="font-medium">{rec.action}</span>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {rec.description}
                </p>
                
                {rec.nextSteps && rec.nextSteps.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">
                      {t({ en: 'Next Steps:', he: 'צעדים הבאים:' })}
                    </span>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {rec.nextSteps.map((step, stepIndex) => (
                        <li key={stepIndex}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {rec.estimatedProcessingTime && (
                  <div className="text-xs text-muted-foreground mt-2">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {t({ en: 'Processing time:', he: 'זמן עיבוד:' })} {rec.estimatedProcessingTime}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FormularyVerification;
```

### 5. Test Cases

```javascript
// backend/tests/formularyVerificationService.test.js
const formularyVerificationService = require('../services/formularyVerificationService');
const SecureDataAccess = require('../services/secureDataAccess');

describe('FormularyVerificationService', () => {
  beforeAll(async () => {
    await formularyVerificationService.initialize();
  });

  describe('verifyFormularyStatus', () => {
    test('should verify formulary status successfully', async () => {
      const mockPatient = {
        _id: 'patient123',
        insurance: [{
          planId: 'PLAN123',
          planName: 'Test Insurance',
          memberId: '123456789',
          rxBin: '123456',
          rxPcn: 'TEST',
          pbmProvider: 'express_scripts',
          isActive: true
        }]
      };

      const mockMedication = {
        rxcui: '308136',
        name: 'Lisinopril 10mg',
        genericName: 'lisinopril',
        therapeuticClass: 'ace_inhibitors'
      };

      jest.spyOn(SecureDataAccess, 'findById')
        .mockResolvedValue(mockPatient);

      jest.spyOn(formularyVerificationService, 'checkSingleFormulary')
        .mockResolvedValue({
          isFormulary: true,
          tier: 'tier1',
          copayAmount: 10,
          priorAuthRequired: false,
          stepTherapyRequired: false,
          quantityLimits: null
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await formularyVerificationService.verifyFormularyStatus({
        patientId: 'patient123',
        medicationData: mockMedication
      }, context);

      expect(result.status).toBe('completed');
      expect(result.coverage.isFormulary).toBe(true);
      expect(result.coverage.tier).toBe('tier1');
      expect(result.coverage.copayAmount).toBe(10);
    });

    test('should handle medication not covered scenario', async () => {
      const mockPatient = {
        _id: 'patient123',
        insurance: [{
          planId: 'PLAN123',
          planName: 'Test Insurance',
          memberId: '123456789',
          pbmProvider: 'express_scripts',
          isActive: true
        }]
      };

      const mockMedication = {
        rxcui: '999999',
        name: 'Expensive Brand Drug',
        genericName: 'expensive_drug'
      };

      jest.spyOn(SecureDataAccess, 'findById')
        .mockResolvedValue(mockPatient);

      jest.spyOn(formularyVerificationService, 'checkSingleFormulary')
        .mockResolvedValue({
          isFormulary: false,
          tier: 'not_covered',
          copayAmount: null,
          priorAuthRequired: false,
          stepTherapyRequired: false
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await formularyVerificationService.verifyFormularyStatus({
        patientId: 'patient123',
        medicationData: mockMedication
      }, context);

      expect(result.coverage.isFormulary).toBe(false);
      expect(result.coverage.tier).toBe('not_covered');
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    test('should handle prior authorization requirements', async () => {
      const mockPatient = {
        _id: 'patient123',
        insurance: [{
          planId: 'PLAN123',
          planName: 'Test Insurance',
          pbmProvider: 'express_scripts',
          isActive: true
        }]
      };

      const mockMedication = {
        rxcui: '567890',
        name: 'Brand Drug Requiring PA'
      };

      jest.spyOn(SecureDataAccess, 'findById')
        .mockResolvedValue(mockPatient);

      jest.spyOn(formularyVerificationService, 'checkSingleFormulary')
        .mockResolvedValue({
          isFormulary: true,
          tier: 'tier3',
          copayAmount: 50,
          priorAuthRequired: true,
          stepTherapyRequired: false
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await formularyVerificationService.verifyFormularyStatus({
        patientId: 'patient123',
        medicationData: mockMedication
      }, context);

      expect(result.restrictions.priorAuthRequired).toBe(true);
      expect(result.recommendations.some(rec => rec.type === 'prior_authorization')).toBe(true);
    });
  });

  describe('generateAlternativeRecommendations', () => {
    test('should generate alternatives for non-formulary medications', async () => {
      const mockCoverageAnalysis = {
        hasFormularyCoverage: false,
        bestOption: null
      };

      const mockMedicationDetails = {
        rxcui: '308136',
        name: 'Lisinopril 10mg',
        therapeuticEquivalents: [
          { rxcui: '308137', name: 'Enalapril 10mg' },
          { rxcui: '308138', name: 'Captopril 25mg' }
        ]
      };

      const mockInsurance = [{
        planId: 'PLAN123',
        planName: 'Test Insurance'
      }];

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      jest.spyOn(formularyVerificationService, 'quickFormularyCheck')
        .mockResolvedValue([{
          isFormulary: true,
          tier: 'tier1',
          copayAmount: 10
        }]);

      const alternatives = await formularyVerificationService.generateAlternativeRecommendations(
        mockCoverageAnalysis,
        mockMedicationDetails,
        mockInsurance,
        context
      );

      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives[0].alternativeType).toBe('therapeutic_equivalent');
    });
  });

  describe('calculatePatientCost', () => {
    test('should calculate patient cost with copay', async () => {
      const mockFormularyStatus = {
        isFormulary: true,
        copayAmount: 15,
        deductibleApplies: false
      };

      const mockMedicationDetails = {
        name: 'Test Medication'
      };

      const mockInsurance = {
        memberId: '123456789'
      };

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const cost = await formularyVerificationService.calculatePatientCost(
        mockFormularyStatus,
        mockMedicationDetails,
        mockInsurance,
        context
      );

      expect(cost.estimatedCost).toBe(15);
      expect(cost.costBreakdown.costType).toBe('copay');
    });

    test('should calculate patient cost for non-covered medication', async () => {
      const mockFormularyStatus = {
        isFormulary: false
      };

      const mockMedicationDetails = {
        name: 'Expensive Drug'
      };

      jest.spyOn(formularyVerificationService, 'getRetailPrice')
        .mockResolvedValue(200);

      const cost = await formularyVerificationService.calculatePatientCost(
        mockFormularyStatus,
        mockMedicationDetails,
        {},
        {}
      );

      expect(cost.estimatedCost).toBe(200);
      expect(cost.costBreakdown.costType).toBe('not_covered');
    });
  });

  describe('utility functions', () => {
    test('should generate consistent cache keys', () => {
      const insurance = { planId: 'PLAN123' };
      const medication = { rxcui: '308136' };

      const key1 = formularyVerificationService.generateCacheKey(insurance, medication);
      const key2 = formularyVerificationService.generateCacheKey(insurance, medication);

      expect(key1).toBe(key2);
      expect(key1).toBeTruthy();
    });

    test('should validate cache expiration', () => {
      const freshCache = {
        timestamp: new Date(),
        ttl: 3600000 // 1 hour
      };

      const expiredCache = {
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
        ttl: 3600000 // 1 hour
      };

      expect(formularyVerificationService.isCacheValid(freshCache)).toBe(true);
      expect(formularyVerificationService.isCacheValid(expiredCache)).toBe(false);
    });
  });
});
```

## Dependencies
- PBM integration services (Express Scripts, CVS Caremark, OptumRx, etc.)
- CoverMyMeds API or similar formulary services
- Drug database with therapeutic equivalents
- Insurance verification systems
- Cost estimation algorithms
- Patient medication history

## Success Criteria
- ✅ Real-time formulary verification across major PBMs
- ✅ Accurate tier and cost determination
- ✅ Prior authorization and step therapy detection
- ✅ Alternative medication recommendations
- ✅ Cost comparison and optimization
- ✅ Comprehensive coverage analysis
- ✅ Integration with prescribing workflow
- ✅ Caching for performance optimization