# Controlled Substances Management System

## Function Details
**Function Name**: manageControlledSubstances  
**Location**: backend/services/controlledSubstancesService.js  
**Status**: Not Implemented  
**Priority**: Critical (P1)  
**Complexity**: Very High  
**Estimated Time**: 16-20 hours  

## Problem Description
Comprehensive controlled substances management system with DEA compliance, PDMP integration, prescription monitoring, controlled substance tracking, regulatory reporting, and automated compliance checks for safe and legal controlled substance prescribing.

## Implementation Steps

### 1. Core Service Implementation

```javascript
// backend/services/controlledSubstancesService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const pdmpIntegration = require('./pdmpIntegrationService');
const deaValidation = require('./deaValidationService');
const controlledSubstanceDatabase = require('./controlledSubstanceDatabase');
const regulatoryReporting = require('./regulatoryReportingService');

class ControlledSubstancesService {
  constructor() {
    this.serviceToken = null;
    this.deaVerificationCache = new Map();
    this.pdmpCache = new Map();
    this.controlledSubstanceRules = new Map();
    this.prescriptionLimits = new Map();
    this.complianceChecks = new Map();
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('controlled-substances-service');
    await this.loadControlledSubstanceRules();
    await this.loadPrescriptionLimits();
    await this.loadComplianceChecks();
    await this.initializePDMPConnections();
    await this.loadDEADatabase();
  }

  async manageControlledSubstances(managementRequest, context) {
    try {
      await this.validateManagementRequest(managementRequest, context);
      
      let result;
      
      switch (managementRequest.action) {
        case 'prescribe':
          result = await this.prescribeControlledSubstance(
            managementRequest.prescriptionData,
            context
          );
          break;
          
        case 'check_pdmp':
          result = await this.checkPDMPHistory(
            managementRequest.patientId,
            managementRequest.options,
            context
          );
          break;
          
        case 'verify_prescriber':
          result = await this.verifyPrescriberDEA(
            managementRequest.prescriberId,
            managementRequest.substance,
            context
          );
          break;
          
        case 'track_prescription':
          result = await this.trackControlledPrescription(
            managementRequest.prescriptionId,
            managementRequest.trackingData,
            context
          );
          break;
          
        case 'generate_report':
          result = await this.generateComplianceReport(
            managementRequest.reportType,
            managementRequest.reportParameters,
            context
          );
          break;
          
        case 'inventory_check':
          result = await this.checkInventoryCompliance(
            managementRequest.inventoryData,
            context
          );
          break;
          
        default:
          throw new Error('Invalid controlled substances management action');
      }
      
      await this.auditControlledSubstanceAction(managementRequest, result, context);
      
      return result;
      
    } catch (error) {
      await this.handleControlledSubstanceError(error, managementRequest, context);
      throw error;
    }
  }

  async validateManagementRequest(request, context) {
    if (!request.action) {
      throw new Error('Action is required for controlled substances management');
    }
    
    const validActions = [
      'prescribe', 'check_pdmp', 'verify_prescriber', 
      'track_prescription', 'generate_report', 'inventory_check'
    ];
    
    if (!validActions.includes(request.action)) {
      throw new Error('Invalid controlled substances management action');
    }
    
    // Validate specific action requirements
    if (request.action === 'prescribe' && !request.prescriptionData) {
      throw new Error('Prescription data is required for controlled substance prescribing');
    }
    
    if (request.action === 'check_pdmp' && !request.patientId) {
      throw new Error('Patient ID is required for PDMP checking');
    }
  }

  async prescribeControlledSubstance(prescriptionData, context) {
    // Step 1: Validate controlled substance
    const substanceInfo = await this.validateControlledSubstance(
      prescriptionData.medication,
      context
    );
    
    // Step 2: Verify prescriber DEA registration
    const prescriberVerification = await this.verifyPrescriberDEA(
      prescriptionData.prescriberId,
      substanceInfo,
      context
    );
    
    if (!prescriberVerification.authorized) {
      throw new Error(`Prescriber not authorized to prescribe ${substanceInfo.schedule} controlled substances`);
    }
    
    // Step 3: Check patient PDMP history
    const pdmpCheck = await this.checkPDMPHistory(
      prescriptionData.patientId,
      {
        lookbackDays: 365,
        includeAllStates: true,
        substance: substanceInfo.drugName
      },
      context
    );
    
    // Step 4: Perform compliance checks
    const complianceChecks = await this.performComplianceChecks(
      prescriptionData,
      substanceInfo,
      pdmpCheck,
      prescriberVerification,
      context
    );
    
    // Step 5: Check prescription limits
    const limitChecks = await this.checkPrescriptionLimits(
      prescriptionData,
      substanceInfo,
      pdmpCheck,
      context
    );
    
    // Step 6: Generate alerts if needed
    const alerts = await this.generateComplianceAlerts(
      complianceChecks,
      limitChecks,
      pdmpCheck,
      context
    );
    
    // Step 7: Create controlled substance prescription record
    const controlledPrescription = await this.createControlledPrescriptionRecord(
      prescriptionData,
      substanceInfo,
      complianceChecks,
      alerts,
      context
    );
    
    // Step 8: Submit to regulatory systems
    await this.submitToRegulatoryReporting(
      controlledPrescription,
      substanceInfo,
      context
    );
    
    return {
      prescriptionId: controlledPrescription._id,
      status: complianceChecks.canPrescribe ? 'approved' : 'requires_review',
      substance: {
        name: substanceInfo.drugName,
        schedule: substanceInfo.schedule,
        dea_code: substanceInfo.deaCode
      },
      compliance: complianceChecks,
      pdmpSummary: pdmpCheck.summary,
      alerts: alerts,
      recommendations: complianceChecks.recommendations,
      regulatory: {
        reportingRequired: true,
        submittedAt: new Date(),
        confirmationNumber: controlledPrescription.regulatorySubmission?.confirmationNumber
      }
    };
  }

  async validateControlledSubstance(medication, context) {
    const substanceInfo = await controlledSubstanceDatabase.lookup({
      rxcui: medication.rxcui,
      ndc: medication.ndc,
      name: medication.name
    });
    
    if (!substanceInfo) {
      throw new Error('Medication is not a recognized controlled substance');
    }
    
    if (!substanceInfo.schedule) {
      throw new Error('Controlled substance schedule information not available');
    }
    
    // Validate schedule (CI, CII, CIII, CIV, CV)
    const validSchedules = ['CI', 'CII', 'CIII', 'CIV', 'CV'];
    if (!validSchedules.includes(substanceInfo.schedule)) {
      throw new Error('Invalid controlled substance schedule');
    }
    
    return {
      rxcui: substanceInfo.rxcui,
      ndc: substanceInfo.ndc,
      drugName: substanceInfo.drugName,
      genericName: substanceInfo.genericName,
      schedule: substanceInfo.schedule,
      deaCode: substanceInfo.deaCode,
      restrictions: substanceInfo.restrictions || {},
      maxDaysSupply: substanceInfo.maxDaysSupply || this.getDefaultMaxDaysSupply(substanceInfo.schedule),
      requiresSpecialHandling: substanceInfo.requiresSpecialHandling || false
    };
  }

  async verifyPrescriberDEA(prescriberId, substanceInfo, context) {
    // Check cache first
    const cacheKey = `${prescriberId}_${substanceInfo.schedule}`;
    if (this.deaVerificationCache.has(cacheKey)) {
      const cached = this.deaVerificationCache.get(cacheKey);
      if (this.isCacheValid(cached, 24 * 60 * 60 * 1000)) { // 24 hours
        return cached.data;
      }
    }
    
    const prescriber = await SecureDataAccess.findById('users', prescriberId, context);
    if (!prescriber) {
      throw new Error('Prescriber not found');
    }
    
    if (!prescriber.deaNumber) {
      throw new Error('Prescriber DEA registration number not found');
    }
    
    // Validate DEA number format
    if (!this.validateDEANumberFormat(prescriber.deaNumber)) {
      throw new Error('Invalid DEA registration number format');
    }
    
    // Check DEA number against federal database
    const deaVerification = await deaValidation.verifyDEARegistration({
      deaNumber: prescriber.deaNumber,
      prescriberName: `${prescriber.profile.firstName} ${prescriber.profile.lastName}`,
      clinicAddress: prescriber.practice.address,
      controlledSubstanceSchedule: substanceInfo.schedule
    });
    
    const verification = {
      deaNumber: prescriber.deaNumber,
      deaStatus: deaVerification.status,
      authorized: deaVerification.authorized,
      authorizedSchedules: deaVerification.authorizedSchedules || [],
      expirationDate: deaVerification.expirationDate,
      restrictions: deaVerification.restrictions || [],
      verifiedAt: new Date()
    };
    
    // Cache the result
    this.deaVerificationCache.set(cacheKey, {
      data: verification,
      timestamp: new Date()
    });
    
    return verification;
  }

  async checkPDMPHistory(patientId, options = {}, context) {
    const defaultOptions = {
      lookbackDays: 365,
      includeAllStates: true,
      includeBenzodiazepines: true,
      includeOpioids: true,
      includeStimulants: true
    };
    
    const checkOptions = { ...defaultOptions, ...options };
    
    // Check cache first
    const cacheKey = `${patientId}_${JSON.stringify(checkOptions)}`;
    if (this.pdmpCache.has(cacheKey)) {
      const cached = this.pdmpCache.get(cacheKey);
      if (this.isCacheValid(cached, 60 * 60 * 1000)) { // 1 hour
        return cached.data;
      }
    }
    
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    // Get patient identifiers for PDMP lookup
    const patientIdentifiers = {
      firstName: patient.demographics.firstName,
      lastName: patient.demographics.lastName,
      dateOfBirth: patient.demographics.dateOfBirth,
      address: patient.demographics.address,
      ssn: patient.demographics.ssn // If available and permitted
    };
    
    // Query PDMP databases
    const pdmpResults = await pdmpIntegration.queryPDMP({
      patient: patientIdentifiers,
      lookbackPeriod: checkOptions.lookbackDays,
      includeStates: checkOptions.includeAllStates ? 'all' : [patient.demographics.address.state],
      substanceTypes: this.buildSubstanceTypeFilter(checkOptions)
    });
    
    // Process and analyze PDMP results
    const processedResults = await this.processPDMPResults(pdmpResults, checkOptions, context);
    
    // Generate risk assessment
    const riskAssessment = await this.generatePDMPRiskAssessment(processedResults, patient, context);
    
    const pdmpReport = {
      patientId: patientId,
      queryDate: new Date(),
      lookbackPeriod: checkOptions.lookbackDays,
      statesQueried: pdmpResults.statesQueried || [],
      totalPrescriptions: processedResults.totalPrescriptions,
      controlledSubstancePrescriptions: processedResults.controlledSubstancePrescriptions,
      uniquePrescribers: processedResults.uniquePrescribers.length,
      uniquePharmacies: processedResults.uniquePharmacies.length,
      
      summary: {
        opioidPrescriptions: processedResults.opioidPrescriptions.length,
        benzodiazepinePrescriptions: processedResults.benzodiazepinePrescriptions.length,
        stimulantPrescriptions: processedResults.stimulantPrescriptions.length,
        totalMME: processedResults.totalMME || 0, // Morphine Milligram Equivalents
        concurrentPrescriptions: processedResults.concurrentPrescriptions.length,
        multiplePrescriberEpisodes: processedResults.multiplePrescriberEpisodes.length
      },
      
      riskFactors: riskAssessment.riskFactors,
      riskScore: riskAssessment.overallScore,
      riskLevel: riskAssessment.level, // 'low', 'moderate', 'high', 'very_high'
      
      prescriptions: processedResults.prescriptions,
      alerts: riskAssessment.alerts,
      recommendations: riskAssessment.recommendations
    };
    
    // Cache the result
    this.pdmpCache.set(cacheKey, {
      data: pdmpReport,
      timestamp: new Date()
    });
    
    return pdmpReport;
  }

  async performComplianceChecks(prescriptionData, substanceInfo, pdmpCheck, prescriberVerification, context) {
    const checks = {
      canPrescribe: true,
      violations: [],
      warnings: [],
      recommendations: [],
      riskScore: 0
    };
    
    // Check 1: DEA Authorization
    if (!prescriberVerification.authorized) {
      checks.canPrescribe = false;
      checks.violations.push({
        type: 'dea_unauthorized',
        severity: 'critical',
        message: 'Prescriber not authorized for this controlled substance schedule',
        code: 'DEA_AUTH_001'
      });
    }
    
    // Check 2: Schedule-specific limits
    const scheduleChecks = await this.checkScheduleSpecificLimits(
      prescriptionData,
      substanceInfo,
      context
    );
    if (!scheduleChecks.compliant) {
      checks.canPrescribe = false;
      checks.violations.push(...scheduleChecks.violations);
    }
    
    // Check 3: Days supply limits
    if (prescriptionData.daysSupply > substanceInfo.maxDaysSupply) {
      checks.canPrescribe = false;
      checks.violations.push({
        type: 'days_supply_exceeded',
        severity: 'critical',
        message: `Days supply (${prescriptionData.daysSupply}) exceeds maximum allowed (${substanceInfo.maxDaysSupply}) for ${substanceInfo.schedule}`,
        code: 'DAYS_SUPPLY_001'
      });
    }
    
    // Check 4: PDMP Risk Assessment
    if (pdmpCheck.riskLevel === 'high' || pdmpCheck.riskLevel === 'very_high') {
      checks.riskScore += 25;
      checks.warnings.push({
        type: 'pdmp_high_risk',
        severity: 'high',
        message: `Patient has high-risk PDMP profile (${pdmpCheck.riskScore}/100)`,
        code: 'PDMP_RISK_001'
      });
    }
    
    // Check 5: Multiple prescriber episodes
    if (pdmpCheck.summary.multiplePrescriberEpisodes > 3) {
      checks.riskScore += 15;
      checks.warnings.push({
        type: 'multiple_prescribers',
        severity: 'medium',
        message: `Patient has received controlled substances from ${pdmpCheck.summary.multiplePrescriberEpisodes} different prescribers`,
        code: 'MULTI_PRESC_001'
      });
    }
    
    // Check 6: Concurrent controlled substances
    if (pdmpCheck.summary.concurrentPrescriptions > 0) {
      checks.riskScore += 10;
      checks.warnings.push({
        type: 'concurrent_controlled_substances',
        severity: 'medium',
        message: `Patient has ${pdmpCheck.summary.concurrentPrescriptions} concurrent controlled substance prescriptions`,
        code: 'CONCURRENT_001'
      });
    }
    
    // Check 7: Early refill patterns
    const earlyRefillCheck = await this.checkEarlyRefillPatterns(prescriptionData.patientId, substanceInfo, context);
    if (earlyRefillCheck.hasPattern) {
      checks.riskScore += 10;
      checks.warnings.push({
        type: 'early_refill_pattern',
        severity: 'medium',
        message: 'Patient has pattern of early refills for controlled substances',
        code: 'EARLY_REFILL_001'
      });
    }
    
    // Check 8: State-specific regulations
    const stateChecks = await this.checkStateSpecificRegulations(
      prescriptionData,
      substanceInfo,
      context
    );
    checks.warnings.push(...stateChecks.warnings);
    checks.violations.push(...stateChecks.violations);
    
    // Generate recommendations based on findings
    checks.recommendations = await this.generateComplianceRecommendations(checks, pdmpCheck, context);
    
    // Final determination
    if (checks.violations.length > 0) {
      checks.canPrescribe = false;
    } else if (checks.riskScore > 50) {
      checks.canPrescribe = false;
      checks.violations.push({
        type: 'high_risk_score',
        severity: 'high',
        message: `Combined risk score (${checks.riskScore}) exceeds safety threshold`,
        code: 'RISK_SCORE_001'
      });
    }
    
    return checks;
  }

  async checkScheduleSpecificLimits(prescriptionData, substanceInfo, context) {
    const checks = {
      compliant: true,
      violations: [],
      warnings: []
    };
    
    switch (substanceInfo.schedule) {
      case 'CII':
        // Schedule II: No refills, special prescription requirements
        if (prescriptionData.refills > 0) {
          checks.compliant = false;
          checks.violations.push({
            type: 'schedule_ii_refills',
            severity: 'critical',
            message: 'Schedule II controlled substances cannot have refills',
            code: 'CII_REFILL_001'
          });
        }
        
        // Max 30-day supply for most CII substances
        if (prescriptionData.daysSupply > 30 && !prescriptionData.chronicPainException) {
          checks.compliant = false;
          checks.violations.push({
            type: 'schedule_ii_days_supply',
            severity: 'critical',
            message: 'Schedule II controlled substances limited to 30-day supply without chronic pain exception',
            code: 'CII_DAYS_001'
          });
        }
        break;
        
      case 'CIII':
      case 'CIV':
        // Schedule III/IV: Max 5 refills or 6 months
        if (prescriptionData.refills > 5) {
          checks.compliant = false;
          checks.violations.push({
            type: 'schedule_iii_iv_refills',
            severity: 'critical',
            message: 'Schedule III/IV controlled substances limited to 5 refills',
            code: 'CIII_CIV_REFILL_001'
          });
        }
        break;
        
      case 'CV':
        // Schedule V: Generally more lenient, but still controlled
        if (prescriptionData.refills > 11) {
          checks.warnings.push({
            type: 'schedule_v_refills',
            severity: 'low',
            message: 'Schedule V controlled substance with high number of refills',
            code: 'CV_REFILL_001'
          });
        }
        break;
    }
    
    return checks;
  }

  async generateComplianceAlerts(complianceChecks, limitChecks, pdmpCheck, context) {
    const alerts = [];
    
    // Critical violations
    complianceChecks.violations.forEach(violation => {
      if (violation.severity === 'critical') {
        alerts.push({
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'compliance_violation',
          severity: 'critical',
          title: 'Controlled Substance Compliance Violation',
          message: violation.message,
          code: violation.code,
          action: 'Prescription cannot be dispensed without resolution',
          timestamp: new Date(),
          acknowledgmentRequired: true
        });
      }
    });
    
    // High-risk PDMP findings
    if (pdmpCheck.riskLevel === 'very_high') {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'pdmp_risk',
        severity: 'high',
        title: 'Very High Risk PDMP Profile',
        message: `Patient PDMP history indicates very high risk (${pdmpCheck.riskScore}/100)`,
        action: 'Consider alternative treatment or enhanced monitoring',
        pdmpSummary: pdmpCheck.summary,
        timestamp: new Date(),
        acknowledgmentRequired: true
      });
    }
    
    // Multiple prescriber warnings
    if (pdmpCheck.summary.multiplePrescriberEpisodes >= 5) {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'multiple_prescribers',
        severity: 'medium',
        title: 'Multiple Prescriber Episodes',
        message: `Patient has received controlled substances from ${pdmpCheck.summary.multiplePrescriberEpisodes} different prescribers`,
        action: 'Review patient care coordination',
        timestamp: new Date(),
        acknowledgmentRequired: false
      });
    }
    
    return alerts;
  }

  async createControlledPrescriptionRecord(prescriptionData, substanceInfo, complianceChecks, alerts, context) {
    const controlledPrescription = await SecureDataAccess.create(
      'controlled_substance_prescriptions',
      {
        prescriptionId: prescriptionData.prescriptionId,
        patientId: prescriptionData.patientId,
        prescriberId: prescriptionData.prescriberId,
        practiceId: context.practiceId,
        
        substance: {
          rxcui: substanceInfo.rxcui,
          ndc: substanceInfo.ndc,
          name: substanceInfo.drugName,
          genericName: substanceInfo.genericName,
          schedule: substanceInfo.schedule,
          deaCode: substanceInfo.deaCode
        },
        
        prescription: {
          dosage: prescriptionData.dosage,
          frequency: prescriptionData.frequency,
          quantity: prescriptionData.quantity,
          daysSupply: prescriptionData.daysSupply,
          refills: prescriptionData.refills,
          sig: prescriptionData.sig
        },
        
        compliance: {
          complianceChecks: complianceChecks,
          canPrescribe: complianceChecks.canPrescribe,
          riskScore: complianceChecks.riskScore,
          violationsCount: complianceChecks.violations.length,
          warningsCount: complianceChecks.warnings.length
        },
        
        alerts: alerts,
        
        prescribedDate: new Date(),
        status: complianceChecks.canPrescribe ? 'approved' : 'pending_review',
        
        regulatorySubmission: {
          required: true,
          submitted: false,
          submissionDate: null,
          confirmationNumber: null
        },
        
        metadata: {
          createdAt: new Date(),
          createdBy: context.userId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        }
      },
      context
    );
    
    return controlledPrescription;
  }

  async trackControlledPrescription(prescriptionId, trackingData, context) {
    const prescription = await SecureDataAccess.findById(
      'controlled_substance_prescriptions',
      prescriptionId,
      context
    );
    
    if (!prescription) {
      throw new Error('Controlled substance prescription not found');
    }
    
    // Update tracking information
    const updateData = {
      'tracking.dispensedDate': trackingData.dispensedDate,
      'tracking.pharmacyId': trackingData.pharmacyId,
      'tracking.pharmacistId': trackingData.pharmacistId,
      'tracking.dispensedQuantity': trackingData.dispensedQuantity,
      'tracking.lotNumber': trackingData.lotNumber,
      'tracking.ndcDispensed': trackingData.ndcDispensed,
      'tracking.lastUpdated': new Date()
    };
    
    // Add to tracking history
    if (!prescription.tracking) {
      updateData.tracking = { history: [] };
    }
    
    updateData.$push = {
      'tracking.history': {
        action: trackingData.action,
        date: new Date(),
        details: trackingData.details,
        performedBy: context.userId
      }
    };
    
    const updatedPrescription = await SecureDataAccess.update(
      'controlled_substance_prescriptions',
      prescriptionId,
      updateData,
      context
    );
    
    // Submit tracking data to regulatory systems
    await regulatoryReporting.submitTrackingUpdate({
      prescriptionId: prescriptionId,
      trackingData: trackingData,
      prescription: updatedPrescription
    });
    
    return {
      prescriptionId: prescriptionId,
      trackingStatus: 'updated',
      lastTrackedAction: trackingData.action,
      timestamp: new Date()
    };
  }

  async generateComplianceReport(reportType, parameters, context) {
    let report;
    
    switch (reportType) {
      case 'prescriber_summary':
        report = await this.generatePrescriberSummaryReport(parameters, context);
        break;
      case 'patient_monitoring':
        report = await this.generatePatientMonitoringReport(parameters, context);
        break;
      case 'regulatory_submission':
        report = await this.generateRegulatorySubmissionReport(parameters, context);
        break;
      case 'dea_audit':
        report = await this.generateDEAAuditReport(parameters, context);
        break;
      default:
        throw new Error('Invalid report type');
    }
    
    // Store report for audit trail
    const reportRecord = await SecureDataAccess.create(
      'controlled_substance_reports',
      {
        reportType: reportType,
        parameters: parameters,
        report: report,
        generatedAt: new Date(),
        generatedBy: context.userId,
        practiceId: context.practiceId
      },
      context
    );
    
    return {
      reportId: reportRecord._id,
      reportType: reportType,
      report: report,
      generatedAt: new Date()
    };
  }

  // Utility methods
  validateDEANumberFormat(deaNumber) {
    // DEA number format: 2 letters + 7 digits
    const deaRegex = /^[A-Z]{2}\d{7}$/;
    
    if (!deaRegex.test(deaNumber)) {
      return false;
    }
    
    // Validate checksum
    const digits = deaNumber.substring(2);
    const sum1 = parseInt(digits[0]) + parseInt(digits[2]) + parseInt(digits[4]);
    const sum2 = parseInt(digits[1]) + parseInt(digits[3]) + parseInt(digits[5]);
    const total = sum1 + (sum2 * 2);
    const checkDigit = total % 10;
    
    return checkDigit === parseInt(digits[6]);
  }

  getDefaultMaxDaysSupply(schedule) {
    const limits = {
      'CI': 0, // No prescriptions allowed
      'CII': 30,
      'CIII': 90,
      'CIV': 90,
      'CV': 90
    };
    
    return limits[schedule] || 30;
  }

  buildSubstanceTypeFilter(options) {
    const filters = [];
    
    if (options.includeOpioids) filters.push('opioids');
    if (options.includeBenzodiazepines) filters.push('benzodiazepines');
    if (options.includeStimulants) filters.push('stimulants');
    
    return filters.length > 0 ? filters : ['all'];
  }

  isCacheValid(cached, ttl) {
    return (new Date() - cached.timestamp) < ttl;
  }

  async auditControlledSubstanceAction(request, result, context) {
    await AuditLog.create({
      action: 'CONTROLLED_SUBSTANCE_MANAGEMENT',
      subAction: request.action.toUpperCase(),
      entityType: 'controlled_substance',
      entityId: result.prescriptionId || result.reportId,
      patientId: request.prescriptionData?.patientId || request.patientId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        action: request.action,
        substance: result.substance?.name,
        schedule: result.substance?.schedule,
        canPrescribe: result.compliance?.canPrescribe,
        riskScore: result.pdmpSummary?.riskScore || result.riskScore,
        alertsGenerated: result.alerts?.length || 0,
        violationsCount: result.compliance?.violationsCount || 0
      },
      timestamp: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }
}

module.exports = new ControlledSubstancesService();
```

### 2. API Endpoints

```javascript
// backend/routes/controlled-substances.js
const express = require('express');
const router = express.Router();
const controlledSubstancesService = require('../services/controlledSubstancesService');
const authMiddleware = require('../middleware/auth');
const auditMiddleware = require('../middleware/audit');
const deaAuthMiddleware = require('../middleware/deaAuth'); // Special DEA authorization check

router.post('/manage',
  authMiddleware,
  deaAuthMiddleware, // Additional DEA verification
  auditMiddleware,
  async (req, res) => {
    try {
      const managementRequest = {
        action: req.body.action,
        prescriptionData: req.body.prescriptionData,
        patientId: req.body.patientId,
        prescriberId: req.body.prescriberId || req.user.id,
        prescriptionId: req.body.prescriptionId,
        trackingData: req.body.trackingData,
        reportType: req.body.reportType,
        reportParameters: req.body.reportParameters,
        inventoryData: req.body.inventoryData,
        options: req.body.options || {}
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await controlledSubstancesService.manageControlledSubstances(
        managementRequest,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Controlled substance action completed successfully',
          he: 'פעולת חומר מבוקר הושלמה בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Controlled substance action failed',
          he: 'פעולת חומר מבוקר נכשלה'
        }
      });
    }
  }
);

router.post('/prescribe',
  authMiddleware,
  deaAuthMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await controlledSubstancesService.prescribeControlledSubstance(
        req.body.prescriptionData,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Controlled substance prescription processed successfully',
          he: 'מרשם לחומר מבוקר עובד בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Controlled substance prescription failed',
          he: 'מרשם לחומר מבוקר נכשל'
        }
      });
    }
  }
);

router.get('/pdmp/:patientId',
  authMiddleware,
  deaAuthMiddleware,
  async (req, res) => {
    try {
      const options = {
        lookbackDays: parseInt(req.query.lookbackDays) || 365,
        includeAllStates: req.query.includeAllStates === 'true',
        includeBenzodiazepines: req.query.includeBenzodiazepines !== 'false',
        includeOpioids: req.query.includeOpioids !== 'false',
        includeStimulants: req.query.includeStimulants !== 'false'
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const result = await controlledSubstancesService.checkPDMPHistory(
        req.params.patientId,
        options,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'PDMP history retrieved successfully',
          he: 'היסטוריית PDMP נשלפה בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve PDMP history',
          he: 'נכשל בשליפת היסטוריית PDMP'
        }
      });
    }
  }
);

router.get('/verify-dea/:prescriberId',
  authMiddleware,
  async (req, res) => {
    try {
      const substance = {
        schedule: req.query.schedule || 'CII',
        name: req.query.substance
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const result = await controlledSubstancesService.verifyPrescriberDEA(
        req.params.prescriberId,
        substance,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'DEA verification completed successfully',
          he: 'אימות DEA הושלם בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'DEA verification failed',
          he: 'אימות DEA נכשל'
        }
      });
    }
  }
);

router.post('/track',
  authMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await controlledSubstancesService.trackControlledPrescription(
        req.body.prescriptionId,
        req.body.trackingData,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Prescription tracking updated successfully',
          he: 'מעקב מרשם עודכן בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Prescription tracking update failed',
          he: 'עדכון מעקב מרשם נכשל'
        }
      });
    }
  }
);

module.exports = router;
```

### 3. Data Models

```javascript
// backend/models/ControlledSubstancePrescription.js
const mongoose = require('mongoose');

const ControlledSubstancePrescriptionSchema = new mongoose.Schema({
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  prescriberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true
  },
  substance: {
    rxcui: String,
    ndc: String,
    name: {
      type: String,
      required: true
    },
    genericName: String,
    schedule: {
      type: String,
      enum: ['CI', 'CII', 'CIII', 'CIV', 'CV'],
      required: true,
      index: true
    },
    deaCode: String
  },
  prescription: {
    dosage: String,
    frequency: String,
    quantity: {
      type: Number,
      required: true
    },
    daysSupply: {
      type: Number,
      required: true
    },
    refills: {
      type: Number,
      default: 0
    },
    sig: String
  },
  prescribedDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected', 'dispensed', 'cancelled'],
    default: 'pending_review',
    index: true
  },
  deaVerification: {
    deaNumber: String,
    deaStatus: String,
    authorized: Boolean,
    verifiedAt: Date,
    expirationDate: Date
  },
  pdmpCheck: {
    queryDate: Date,
    riskScore: Number,
    riskLevel: {
      type: String,
      enum: ['low', 'moderate', 'high', 'very_high']
    },
    totalPrescriptions: Number,
    uniquePrescribers: Number,
    concurrentPrescriptions: Number,
    riskFactors: [String]
  },
  compliance: {
    complianceChecks: mongoose.Schema.Types.Mixed,
    canPrescribe: {
      type: Boolean,
      required: true
    },
    riskScore: Number,
    violationsCount: Number,
    warningsCount: Number,
    reviewRequired: Boolean,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    reviewNotes: String
  },
  alerts: [{
    id: String,
    type: {
      type: String,
      enum: ['compliance_violation', 'pdmp_risk', 'multiple_prescribers', 'early_refill']
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    title: String,
    message: String,
    code: String,
    action: String,
    timestamp: Date,
    acknowledgmentRequired: Boolean,
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acknowledgedAt: Date
  }],
  tracking: {
    dispensedDate: Date,
    pharmacyId: String,
    pharmacistId: String,
    dispensedQuantity: Number,
    lotNumber: String,
    ndcDispensed: String,
    lastUpdated: Date,
    history: [{
      action: String,
      date: Date,
      details: String,
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }]
  },
  regulatorySubmission: {
    required: {
      type: Boolean,
      default: true
    },
    submitted: {
      type: Boolean,
      default: false
    },
    submissionDate: Date,
    confirmationNumber: String,
    reportingAgency: String,
    submissionResponse: mongoose.Schema.Types.Mixed
  },
  metadata: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastModified: {
      type: Date,
      default: Date.now
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    ipAddress: String,
    userAgent: String
  }
});

// Indexes for performance and compliance reporting
ControlledSubstancePrescriptionSchema.index({ 'substance.schedule': 1, prescribedDate: -1 });
ControlledSubstancePrescriptionSchema.index({ prescriberId: 1, prescribedDate: -1 });
ControlledSubstancePrescriptionSchema.index({ 'compliance.canPrescribe': 1 });
ControlledSubstancePrescriptionSchema.index({ 'regulatorySubmission.submitted': 1 });

module.exports = mongoose.model('ControlledSubstancePrescription', ControlledSubstancePrescriptionSchema);
```

### 4. Frontend Components

```jsx
// frontend-vite/src/components/controlled-substances/ControlledSubstancesPrescribing.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  FileText,
  Eye,
  Lock,
  Activity
} from 'lucide-react';
import secureApiClient from '@/services/secureApiClient';
import { useTranslation } from '@/hooks/useTranslation';

const ControlledSubstancesPrescribing = ({ prescriptionData, onPrescriptionResult }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [deaVerification, setDeaVerification] = useState(null);
  const [pdmpData, setPdmpData] = useState(null);
  const [complianceResult, setComplianceResult] = useState(null);
  const [showPDMP, setShowPDMP] = useState(false);

  useEffect(() => {
    if (prescriptionData?.medication && prescriptionData?.patientId) {
      checkControlledSubstanceCompliance();
    }
  }, [prescriptionData]);

  const checkControlledSubstanceCompliance = async () => {
    setLoading(true);
    try {
      // Step 1: Prescribe controlled substance with full compliance checking
      const response = await secureApiClient.post('/api/controlled-substances/prescribe', {
        prescriptionData: prescriptionData
      });

      if (response.data.success) {
        setComplianceResult(response.data.data);
        
        // Step 2: Get detailed PDMP data
        const pdmpResponse = await secureApiClient.get(
          `/api/controlled-substances/pdmp/${prescriptionData.patientId}?lookbackDays=365&includeAllStates=true`
        );
        
        if (pdmpResponse.data.success) {
          setPdmpData(pdmpResponse.data.data);
        }
        
        if (onPrescriptionResult) {
          onPrescriptionResult(response.data.data);
        }
      }
    } catch (error) {
      console.error('Controlled substance compliance check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScheduleColor = (schedule) => {
    switch (schedule) {
      case 'CI': return 'destructive';
      case 'CII': return 'destructive';
      case 'CIII': return 'warning';
      case 'CIV': return 'default';
      case 'CV': return 'secondary';
      default: return 'secondary';
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'very_high': return 'text-red-600';
      case 'high': return 'text-red-500';
      case 'moderate': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'requires_review':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'rejected':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <div className="mt-4">
            {t({ en: 'Checking controlled substance compliance...', he: 'בודק ציות לחומרים מבוקרים...' })}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!complianceResult) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <div className="text-lg font-semibold">
            {t({ en: 'No Compliance Data', he: 'אין נתוני ציות' })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t({ en: 'Controlled Substance Compliance', he: 'ציות לחומרים מבוקרים' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                {getStatusIcon(complianceResult.status)}
              </div>
              <div className="font-semibold">
                {complianceResult.status === 'approved' ? 
                  t({ en: 'Approved', he: 'מאושר' }) :
                  complianceResult.status === 'requires_review' ?
                  t({ en: 'Requires Review', he: 'דורש בדיקה' }) :
                  t({ en: 'Status Unknown', he: 'סטטוס לא ידוע' })
                }
              </div>
              <div className="text-sm text-muted-foreground">
                {t({ en: 'Prescription Status', he: 'סטטוס מרשם' })}
              </div>
            </div>

            <div className="text-center">
              <div className="mb-2">
                <Badge variant={getScheduleColor(complianceResult.substance.schedule)} className="text-lg px-3 py-1">
                  {complianceResult.substance.schedule}
                </Badge>
              </div>
              <div className="font-semibold">{complianceResult.substance.name}</div>
              <div className="text-sm text-muted-foreground">
                {t({ en: 'Controlled Substance', he: 'חומר מבוקר' })}
              </div>
            </div>

            {pdmpData && (
              <div className="text-center">
                <div className={`text-2xl font-bold ${getRiskColor(pdmpData.riskLevel)}`}>
                  {pdmpData.riskScore}/100
                </div>
                <div className="font-semibold capitalize">{pdmpData.riskLevel}</div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'PDMP Risk Score', he: 'ציון סיכון PDMP' })}
                </div>
              </div>
            )}

            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {complianceResult.alerts?.length || 0}
              </div>
              <div className="font-semibold">
                {t({ en: 'Active Alerts', he: 'התראות פעילות' })}
              </div>
              <div className="text-sm text-muted-foreground">
                {t({ en: 'Compliance Issues', he: 'בעיות ציות' })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Alerts */}
      {complianceResult.alerts && complianceResult.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t({ en: 'Compliance Alerts', he: 'התראות ציות' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {complianceResult.alerts.map((alert, index) => (
              <Alert key={index} variant={alert.severity === 'critical' ? 'destructive' : 'warning'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold">{alert.title}</div>
                  <div className="text-sm mt-1">{alert.message}</div>
                  {alert.action && (
                    <div className="text-sm mt-2 font-medium">
                      {t({ en: 'Action Required:', he: 'נדרשת פעולה:' })} {alert.action}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* PDMP Summary */}
      {pdmpData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {t({ en: 'PDMP History Summary', he: 'סיכום היסטוריית PDMP' })}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowPDMP(!showPDMP)}
              >
                {showPDMP ? t({ en: 'Hide Details', he: 'הסתר פרטים' }) : t({ en: 'Show Details', he: 'הצג פרטים' })}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{pdmpData.totalPrescriptions}</div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'Total Prescriptions', he: 'סך מרשמים' })}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {pdmpData.summary.opioidPrescriptions}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'Opioid Prescriptions', he: 'מרשמי אופיואידים' })}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold">{pdmpData.uniquePrescribers}</div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'Unique Prescribers', he: 'רופאים מרשמים' })}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {pdmpData.summary.concurrentPrescriptions}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'Concurrent Rx', he: 'מרשמים בו זמניים' })}
                </div>
              </div>
            </div>

            {pdmpData.riskFactors && pdmpData.riskFactors.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium mb-2">
                  {t({ en: 'Risk Factors:', he: 'גורמי סיכון:' })}
                </h5>
                <div className="flex flex-wrap gap-2">
                  {pdmpData.riskFactors.map((factor, index) => (
                    <Badge key={index} variant="secondary">
                      {factor.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed PDMP Data */}
            {showPDMP && pdmpData.prescriptions && (
              <div className="mt-6 border-t pt-4">
                <h5 className="font-medium mb-3">
                  {t({ en: 'Recent Prescriptions:', he: 'מרשמים אחרונים:' })}
                </h5>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pdmpData.prescriptions.slice(0, 10).map((rx, index) => (
                    <div key={index} className="text-sm border rounded p-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{rx.drugName}</div>
                          <div className="text-muted-foreground">
                            {rx.prescriber} • {rx.pharmacy}
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <div>{new Date(rx.fillDate).toLocaleDateString()}</div>
                          <div>{rx.quantity} units • {rx.daysSupply} days</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pdmpData.prescriptions.length > 10 && (
                    <div className="text-sm text-muted-foreground text-center">
                      +{pdmpData.prescriptions.length - 10} more prescriptions
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compliance Recommendations */}
      {complianceResult.recommendations && complianceResult.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t({ en: 'Clinical Recommendations', he: 'המלצות קליניות' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {complianceResult.recommendations.map((rec, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'warning' : 'default'}>
                    {rec.priority}
                  </Badge>
                  <span className="font-medium">{rec.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {rec.description}
                </p>
                {rec.actions && rec.actions.length > 0 && (
                  <div className="mt-2">
                    <span className="text-sm font-medium">
                      {t({ en: 'Recommended Actions:', he: 'פעולות מומלצות:' })}
                    </span>
                    <ul className="text-sm mt-1 space-y-1">
                      {rec.actions.map((action, actionIndex) => (
                        <li key={actionIndex} className="flex items-start gap-2">
                          <span>•</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Regulatory Information */}
      {complianceResult.regulatory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t({ en: 'Regulatory Compliance', he: 'ציות רגולטורי' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium">
                    {t({ en: 'Reporting Required', he: 'נדרש דיווח' })}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t({ 
                    en: 'This prescription will be automatically reported to regulatory agencies.',
                    he: 'מרשם זה ידווח אוטומטית לרשויות הרגולטוריות.'
                  })}
                </div>
              </div>
              
              {complianceResult.regulatory.confirmationNumber && (
                <div>
                  <div className="font-medium mb-1">
                    {t({ en: 'Confirmation Number:', he: 'מספר אישור:' })}
                  </div>
                  <div className="text-sm font-mono bg-gray-100 p-2 rounded">
                    {complianceResult.regulatory.confirmationNumber}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 text-xs text-muted-foreground">
              {t({
                en: 'Submitted at: ',
                he: 'הוגש ב: '
              })}
              {new Date(complianceResult.regulatory.submittedAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ControlledSubstancesPrescribing;
```

### 5. Test Cases

```javascript
// backend/tests/controlledSubstancesService.test.js
const controlledSubstancesService = require('../services/controlledSubstancesService');
const SecureDataAccess = require('../services/secureDataAccess');

describe('ControlledSubstancesService', () => {
  beforeAll(async () => {
    await controlledSubstancesService.initialize();
  });

  describe('prescribeControlledSubstance', () => {
    test('should approve Schedule IV prescription with valid DEA', async () => {
      const mockPrescriptionData = {
        prescriptionId: 'rx123',
        patientId: 'patient123',
        prescriberId: 'doctor123',
        medication: {
          rxcui: '2670',
          name: 'Alprazolam 0.5mg',
          schedule: 'CIV'
        },
        quantity: 30,
        daysSupply: 30,
        refills: 2
      };

      // Mock DEA verification
      jest.spyOn(controlledSubstancesService, 'verifyPrescriberDEA')
        .mockResolvedValue({
          deaNumber: 'BA1234563',
          authorized: true,
          authorizedSchedules: ['CII', 'CIII', 'CIV', 'CV']
        });

      // Mock PDMP check
      jest.spyOn(controlledSubstancesService, 'checkPDMPHistory')
        .mockResolvedValue({
          riskLevel: 'low',
          riskScore: 25,
          summary: {
            opioidPrescriptions: 0,
            concurrentPrescriptions: 0,
            multiplePrescriberEpisodes: 1
          }
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await controlledSubstancesService.prescribeControlledSubstance(
        mockPrescriptionData,
        context
      );

      expect(result.status).toBe('approved');
      expect(result.substance.schedule).toBe('CIV');
      expect(result.compliance.canPrescribe).toBe(true);
    });

    test('should reject Schedule II prescription exceeding days supply limit', async () => {
      const mockPrescriptionData = {
        prescriptionId: 'rx456',
        patientId: 'patient123',
        prescriberId: 'doctor123',
        medication: {
          rxcui: '5640',
          name: 'Oxycodone 5mg',
          schedule: 'CII'
        },
        quantity: 90,
        daysSupply: 45, // Exceeds 30-day limit
        refills: 0
      };

      jest.spyOn(controlledSubstancesService, 'verifyPrescriberDEA')
        .mockResolvedValue({
          deaNumber: 'BA1234563',
          authorized: true,
          authorizedSchedules: ['CII', 'CIII', 'CIV', 'CV']
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      await expect(
        controlledSubstancesService.prescribeControlledSubstance(mockPrescriptionData, context)
      ).rejects.toThrow();
    });

    test('should require review for high PDMP risk patient', async () => {
      const mockPrescriptionData = {
        prescriptionId: 'rx789',
        patientId: 'high_risk_patient',
        prescriberId: 'doctor123',
        medication: {
          rxcui: '5640',
          name: 'Oxycodone 5mg',
          schedule: 'CII'
        },
        quantity: 30,
        daysSupply: 30,
        refills: 0
      };

      jest.spyOn(controlledSubstancesService, 'verifyPrescriberDEA')
        .mockResolvedValue({
          authorized: true,
          authorizedSchedules: ['CII', 'CIII', 'CIV', 'CV']
        });

      jest.spyOn(controlledSubstancesService, 'checkPDMPHistory')
        .mockResolvedValue({
          riskLevel: 'very_high',
          riskScore: 85,
          summary: {
            opioidPrescriptions: 15,
            concurrentPrescriptions: 3,
            multiplePrescriberEpisodes: 6
          },
          riskFactors: ['multiple_prescribers', 'early_refills', 'high_mme']
        });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await controlledSubstancesService.prescribeControlledSubstance(
        mockPrescriptionData,
        context
      );

      expect(result.status).toBe('requires_review');
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts.some(alert => alert.type === 'pdmp_risk')).toBe(true);
    });
  });

  describe('validateDEANumberFormat', () => {
    test('should validate correct DEA number format', () => {
      expect(controlledSubstancesService.validateDEANumberFormat('BA1234563')).toBe(true);
      expect(controlledSubstancesService.validateDEANumberFormat('AB9876543')).toBe(true);
    });

    test('should reject invalid DEA number formats', () => {
      expect(controlledSubstancesService.validateDEANumberFormat('1234567890')).toBe(false);
      expect(controlledSubstancesService.validateDEANumberFormat('AB123456')).toBe(false);
      expect(controlledSubstancesService.validateDEANumberFormat('AB12345678')).toBe(false);
    });

    test('should validate DEA number checksum', () => {
      // Valid DEA number with correct checksum
      expect(controlledSubstancesService.validateDEANumberFormat('BA1234563')).toBe(true);
      
      // Invalid checksum
      expect(controlledSubstancesService.validateDEANumberFormat('BA1234564')).toBe(false);
    });
  });

  describe('checkPDMPHistory', () => {
    test('should return comprehensive PDMP report', async () => {
      const mockPDMPResults = {
        prescriptions: [
          {
            drugName: 'Oxycodone 5mg',
            fillDate: new Date('2023-12-01'),
            quantity: 30,
            daysSupply: 30,
            prescriber: 'Dr. Smith',
            pharmacy: 'CVS Pharmacy'
          }
        ],
        statesQueried: ['CA', 'NV']
      };

      jest.spyOn(require('../services/pdmpIntegrationService'), 'queryPDMP')
        .mockResolvedValue(mockPDMPResults);

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await controlledSubstancesService.checkPDMPHistory(
        'patient123',
        { lookbackDays: 365 },
        context
      );

      expect(result.patientId).toBe('patient123');
      expect(result.prescriptions).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.riskLevel).toMatch(/^(low|moderate|high|very_high)$/);
    });
  });

  describe('utility functions', () => {
    test('should return correct max days supply by schedule', () => {
      expect(controlledSubstancesService.getDefaultMaxDaysSupply('CI')).toBe(0);
      expect(controlledSubstancesService.getDefaultMaxDaysSupply('CII')).toBe(30);
      expect(controlledSubstancesService.getDefaultMaxDaysSupply('CIII')).toBe(90);
      expect(controlledSubstancesService.getDefaultMaxDaysSupply('CIV')).toBe(90);
      expect(controlledSubstancesService.getDefaultMaxDaysSupply('CV')).toBe(90);
    });

    test('should build correct substance type filters', () => {
      const options1 = { includeOpioids: true, includeBenzodiazepines: false };
      expect(controlledSubstancesService.buildSubstanceTypeFilter(options1)).toEqual(['opioids']);

      const options2 = { includeOpioids: true, includeBenzodiazepines: true, includeStimulants: true };
      expect(controlledSubstancesService.buildSubstanceTypeFilter(options2))
        .toEqual(['opioids', 'benzodiazepines', 'stimulants']);

      const options3 = {};
      expect(controlledSubstancesService.buildSubstanceTypeFilter(options3)).toEqual(['all']);
    });
  });
});
```

## Dependencies
- PDMP integration services (state prescription databases)
- DEA validation service
- Controlled substance database
- Regulatory reporting systems
- Clinical decision support engine
- Pharmacy integration for dispensing tracking

## Success Criteria
- ✅ Complete DEA registration verification
- ✅ Real-time PDMP history checking across states
- ✅ Comprehensive compliance validation for all CS schedules
- ✅ Automated regulatory reporting submission
- ✅ Risk assessment and clinical decision support
- ✅ Prescription tracking through dispensing
- ✅ Audit trail for all controlled substance activities
- ✅ Integration with prescribing and pharmacy workflows