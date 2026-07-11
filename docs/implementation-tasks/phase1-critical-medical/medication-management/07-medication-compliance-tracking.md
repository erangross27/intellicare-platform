# Medication Compliance Tracking

## Function Details
**Function Name**: trackMedicationCompliance  
**Location**: backend/services/medicationComplianceService.js  
**Status**: Not Implemented  
**Priority**: High (P1)  
**Complexity**: Medium-High  
**Estimated Time**: 8-10 hours  

## Problem Description
Advanced medication compliance tracking system with multi-source data integration, real-time adherence monitoring, predictive analytics, patient engagement tools, and automated intervention triggers for improved medication outcomes.

## Implementation Steps

### 1. Core Service Implementation

```javascript
// backend/services/medicationComplianceService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const pharmacyIntegration = require('./pharmacyIntegrationService');
const patientEngagementService = require('./patientEngagementService');
const predictiveAnalytics = require('./predictiveAnalytics');

class MedicationComplianceService {
  constructor() {
    this.serviceToken = null;
    this.complianceCache = new Map();
    this.adherenceThresholds = new Map();
    this.interventionRules = new Map();
    this.complianceMetrics = new Map();
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('medication-compliance-service');
    await this.loadAdherenceThresholds();
    await this.loadInterventionRules();
    await this.loadComplianceMetrics();
  }

  async trackMedicationCompliance(complianceRequest, context) {
    try {
      await this.validateComplianceRequest(complianceRequest, context);
      
      const patientMedications = await this.getPatientMedications(
        complianceRequest.patientId,
        complianceRequest.timeRange,
        context
      );
      
      const complianceData = await this.gatherComplianceData(
        complianceRequest.patientId,
        patientMedications,
        complianceRequest.dataSources,
        context
      );
      
      const adherenceCalculations = await this.calculateAdherence(
        complianceData,
        complianceRequest.calculationMethod || 'pdc',
        context
      );
      
      const compliancePatterns = await this.analyzeCompliancePatterns(
        adherenceCalculations,
        complianceRequest.patientId,
        context
      );
      
      const riskAssessment = await this.assessNonComplianceRisk(
        adherenceCalculations,
        compliancePatterns,
        complianceRequest.patientId,
        context
      );
      
      const interventionRecommendations = await this.generateInterventionRecommendations(
        riskAssessment,
        compliancePatterns,
        complianceRequest.patientId,
        context
      );
      
      const complianceReport = await this.generateComplianceReport(
        adherenceCalculations,
        compliancePatterns,
        riskAssessment,
        interventionRecommendations,
        complianceRequest,
        context
      );
      
      // Trigger automated interventions if needed
      await this.triggerAutomatedInterventions(riskAssessment, complianceRequest.patientId, context);
      
      await this.cacheComplianceData(complianceRequest.patientId, complianceReport, context);
      await this.auditComplianceTracking(complianceRequest, complianceReport, context);
      
      return {
        complianceId: complianceReport.id,
        status: 'completed',
        summary: {
          overallAdherence: complianceReport.overallAdherence,
          medicationsTracked: complianceReport.medicationsTracked.length,
          highRiskMedications: complianceReport.highRiskMedications,
          complianceScore: complianceReport.complianceScore,
          riskLevel: riskAssessment.overallRisk,
          interventionsTriggered: complianceReport.interventionsTriggered
        },
        adherence: adherenceCalculations,
        patterns: compliancePatterns,
        riskAssessment: riskAssessment,
        recommendations: interventionRecommendations,
        trends: complianceReport.trends,
        metadata: complianceReport.metadata
      };
      
    } catch (error) {
      await this.handleComplianceError(error, complianceRequest, context);
      throw error;
    }
  }

  async validateComplianceRequest(request, context) {
    if (!request.patientId) {
      throw new Error('Patient ID is required for compliance tracking');
    }
    
    // Validate time range
    if (request.timeRange) {
      const { startDate, endDate } = request.timeRange;
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        throw new Error('Invalid time range: start date must be before end date');
      }
    }
    
    // Validate calculation method
    const validMethods = ['pdc', 'mpr', 'cma', 'medication_possession_ratio'];
    if (request.calculationMethod && !validMethods.includes(request.calculationMethod)) {
      throw new Error('Invalid adherence calculation method');
    }
  }

  async getPatientMedications(patientId, timeRange, context) {
    const defaultTimeRange = {
      startDate: new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)), // 3 months ago
      endDate: new Date()
    };
    
    const queryTimeRange = timeRange || defaultTimeRange;
    
    const prescriptions = await SecureDataAccess.query(
      'prescriptions',
      {
        patientId: patientId,
        $or: [
          { status: 'active' },
          { 
            prescribedDate: {
              $gte: queryTimeRange.startDate,
              $lte: queryTimeRange.endDate
            }
          }
        ]
      },
      {
        sort: { prescribedDate: -1 },
        populate: ['medication', 'prescriber']
      },
      context
    );
    
    return prescriptions.map(prescription => ({
      prescriptionId: prescription._id,
      medication: {
        rxcui: prescription.medication.rxcui,
        name: prescription.medication.name,
        genericName: prescription.medication.genericName,
        therapeuticClass: prescription.medication.therapeuticClass
      },
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      quantity: prescription.quantity,
      daysSupply: prescription.daysSupply,
      refills: prescription.refills,
      prescribedDate: prescription.prescribedDate,
      startDate: prescription.startDate,
      endDate: prescription.endDate,
      prescriber: prescription.prescriber,
      indication: prescription.indication,
      priority: this.getMedicationPriority(prescription.indication, prescription.medication.therapeuticClass)
    }));
  }

  async gatherComplianceData(patientId, medications, dataSources, context) {
    const complianceData = {
      prescriptions: medications,
      pharmacyFills: [],
      patientReported: [],
      deviceData: [],
      clinicalVisits: []
    };
    
    const sources = dataSources || ['pharmacy', 'patient_reported', 'clinical_visits'];
    
    // Pharmacy fill data
    if (sources.includes('pharmacy')) {
      complianceData.pharmacyFills = await this.getPharmacyFillData(patientId, medications, context);
    }
    
    // Patient-reported adherence
    if (sources.includes('patient_reported')) {
      complianceData.patientReported = await this.getPatientReportedAdherence(patientId, medications, context);
    }
    
    // Smart device data (pill dispensers, apps, etc.)
    if (sources.includes('device_data')) {
      complianceData.deviceData = await this.getDeviceAdherenceData(patientId, medications, context);
    }
    
    // Clinical visit assessments
    if (sources.includes('clinical_visits')) {
      complianceData.clinicalVisits = await this.getClinicalAdherenceAssessments(patientId, medications, context);
    }
    
    return complianceData;
  }

  async getPharmacyFillData(patientId, medications, context) {
    const fills = [];
    
    for (const medication of medications) {
      try {
        const fillHistory = await pharmacyIntegration.getMedicationFillHistory({
          patientId: patientId,
          rxcui: medication.medication.rxcui,
          prescriptionId: medication.prescriptionId,
          dateRange: {
            startDate: medication.startDate,
            endDate: medication.endDate || new Date()
          }
        });
        
        fills.push(...fillHistory.map(fill => ({
          prescriptionId: medication.prescriptionId,
          medicationName: medication.medication.name,
          fillDate: new Date(fill.fillDate),
          quantity: fill.quantity,
          daysSupply: fill.daysSupply,
          refillNumber: fill.refillNumber,
          pharmacy: fill.pharmacy,
          expectedRefillDate: this.calculateExpectedRefillDate(fill.fillDate, fill.daysSupply),
          actualRefillDate: fill.nextFillDate ? new Date(fill.nextFillDate) : null
        })));
      } catch (error) {
        console.error(`Error getting fill data for ${medication.medication.name}:`, error);
      }
    }
    
    return fills.sort((a, b) => a.fillDate - b.fillDate);
  }

  async getPatientReportedAdherence(patientId, medications, context) {
    const reportedData = await SecureDataAccess.query(
      'patient_adherence_reports',
      {
        patientId: patientId,
        reportDate: { $gte: new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)) }
      },
      { sort: { reportDate: -1 } },
      context
    );
    
    return reportedData.map(report => ({
      reportDate: report.reportDate,
      medicationName: report.medicationName,
      adherenceScore: report.adherenceScore, // 0-100
      missedDoses: report.missedDoses,
      adherenceBarriers: report.adherenceBarriers,
      sideEffects: report.sideEffects,
      patientNotes: report.patientNotes,
      reportMethod: report.reportMethod // 'portal', 'phone', 'visit', 'app'
    }));
  }

  async calculateAdherence(complianceData, method, context) {
    const adherenceResults = [];
    
    // Group by medication
    const medicationGroups = new Map();
    complianceData.prescriptions.forEach(prescription => {
      const key = prescription.medication.rxcui || prescription.medication.name;
      if (!medicationGroups.has(key)) {
        medicationGroups.set(key, {
          prescription: prescription,
          fills: [],
          patientReports: []
        });
      }
    });
    
    // Add fill data
    complianceData.pharmacyFills.forEach(fill => {
      const prescription = complianceData.prescriptions.find(p => 
        p.prescriptionId === fill.prescriptionId
      );
      if (prescription) {
        const key = prescription.medication.rxcui || prescription.medication.name;
        if (medicationGroups.has(key)) {
          medicationGroups.get(key).fills.push(fill);
        }
      }
    });
    
    // Add patient reports
    complianceData.patientReported.forEach(report => {
      for (const [key, group] of medicationGroups.entries()) {
        if (group.prescription.medication.name === report.medicationName) {
          group.patientReports.push(report);
          break;
        }
      }
    });
    
    // Calculate adherence for each medication
    for (const [key, group] of medicationGroups.entries()) {
      let adherenceScore;
      
      switch (method) {
        case 'pdc':
          adherenceScore = await this.calculatePDC(group, context);
          break;
        case 'mpr':
          adherenceScore = await this.calculateMPR(group, context);
          break;
        case 'cma':
          adherenceScore = await this.calculateCMA(group, context);
          break;
        default:
          adherenceScore = await this.calculatePDC(group, context);
      }
      
      adherenceResults.push({
        medication: group.prescription.medication,
        prescriptionId: group.prescription.prescriptionId,
        adherenceScore: adherenceScore.score,
        adherenceCategory: this.categorizeAdherence(adherenceScore.score),
        calculationMethod: method,
        dataPoints: adherenceScore.dataPoints,
        fills: group.fills,
        patientReports: group.patientReports,
        gaps: adherenceScore.gaps,
        trends: adherenceScore.trends,
        lastCalculated: new Date()
      });
    }
    
    return adherenceResults;
  }

  async calculatePDC(medicationGroup, context) {
    // Proportion of Days Covered calculation
    const prescription = medicationGroup.prescription;
    const fills = medicationGroup.fills.sort((a, b) => a.fillDate - b.fillDate);
    
    if (fills.length === 0) {
      return {
        score: 0,
        dataPoints: 0,
        gaps: [],
        trends: { direction: 'unknown', confidence: 'low' }
      };
    }
    
    const startDate = prescription.startDate;
    const endDate = prescription.endDate || new Date();
    const totalDays = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
    
    let coveredDays = 0;
    let currentCoverageEnd = startDate;
    const gaps = [];
    
    for (const fill of fills) {
      // Check for gap
      if (fill.fillDate > currentCoverageEnd) {
        const gapDays = Math.ceil((fill.fillDate - currentCoverageEnd) / (24 * 60 * 60 * 1000));
        gaps.push({
          startDate: currentCoverageEnd,
          endDate: fill.fillDate,
          durationDays: gapDays
        });
      }
      
      const fillEndDate = new Date(fill.fillDate.getTime() + (fill.daysSupply * 24 * 60 * 60 * 1000));
      
      // Calculate overlap or new coverage
      if (fill.fillDate <= currentCoverageEnd) {
        // Overlap - extend coverage if needed
        if (fillEndDate > currentCoverageEnd) {
          const additionalDays = Math.ceil((fillEndDate - currentCoverageEnd) / (24 * 60 * 60 * 1000));
          coveredDays += additionalDays;
          currentCoverageEnd = fillEndDate;
        }
      } else {
        // New coverage period
        coveredDays += fill.daysSupply;
        currentCoverageEnd = fillEndDate;
      }
    }
    
    const pdcScore = Math.min(100, Math.round((coveredDays / totalDays) * 100));
    
    return {
      score: pdcScore,
      dataPoints: fills.length,
      gaps: gaps,
      trends: this.calculateAdherenceTrends(fills),
      coveredDays: coveredDays,
      totalDays: totalDays
    };
  }

  async calculateMPR(medicationGroup, context) {
    // Medication Possession Ratio calculation
    const fills = medicationGroup.fills.sort((a, b) => a.fillDate - b.fillDate);
    
    if (fills.length < 2) {
      return { score: 0, dataPoints: fills.length, gaps: [], trends: { direction: 'unknown' } };
    }
    
    const firstFill = fills[0];
    const lastFill = fills[fills.length - 1];
    
    const totalDaysSupplied = fills.reduce((sum, fill) => sum + fill.daysSupply, 0);
    const daysBetweenFirstAndLast = Math.ceil((lastFill.fillDate - firstFill.fillDate) / (24 * 60 * 60 * 1000)) + lastFill.daysSupply;
    
    const mprScore = Math.min(100, Math.round((totalDaysSupplied / daysBetweenFirstAndLast) * 100));
    
    return {
      score: mprScore,
      dataPoints: fills.length,
      gaps: this.identifyMPRGaps(fills),
      trends: this.calculateAdherenceTrends(fills)
    };
  }

  categorizeAdherence(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'poor';
    return 'very_poor';
  }

  async analyzeCompliancePatterns(adherenceData, patientId, context) {
    const patterns = {
      overallPattern: 'unknown',
      adherenceDistribution: {},
      temporalPatterns: {},
      medicationSpecificPatterns: {},
      riskFactors: [],
      improvementOpportunities: []
    };
    
    // Overall adherence distribution
    const scores = adherenceData.map(med => med.adherenceScore);
    patterns.adherenceDistribution = {
      excellent: scores.filter(s => s >= 80).length,
      good: scores.filter(s => s >= 60 && s < 80).length,
      poor: scores.filter(s => s >= 40 && s < 60).length,
      veryPoor: scores.filter(s => s < 40).length,
      average: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    };
    
    // Temporal patterns
    patterns.temporalPatterns = await this.analyzeTemporalPatterns(adherenceData, context);
    
    // Medication-specific patterns
    patterns.medicationSpecificPatterns = this.analyzeMedicationPatterns(adherenceData);
    
    // Risk factors identification
    patterns.riskFactors = await this.identifyRiskFactors(adherenceData, patientId, context);
    
    // Improvement opportunities
    patterns.improvementOpportunities = this.identifyImprovementOpportunities(adherenceData, patterns);
    
    return patterns;
  }

  async assessNonComplianceRisk(adherenceData, patterns, patientId, context) {
    const riskAssessment = {
      overallRisk: 'low',
      riskScore: 0,
      riskFactors: [],
      predictiveFactors: {},
      interventionUrgency: 'routine',
      recommendedActions: []
    };
    
    // Calculate base risk from adherence scores
    const averageAdherence = patterns.adherenceDistribution.average;
    let baseRisk = Math.max(0, 100 - averageAdherence);
    
    // Patient-specific risk factors
    const patientRiskFactors = await this.getPatientRiskFactors(patientId, context);
    
    // Medication-specific risk factors
    const highRiskMedications = adherenceData.filter(med => 
      med.adherenceScore < 60 && this.isHighRiskMedication(med.medication)
    );
    
    if (highRiskMedications.length > 0) {
      baseRisk += 20;
      riskAssessment.riskFactors.push({
        type: 'high_risk_medication_non_adherence',
        severity: 'high',
        medications: highRiskMedications.map(med => med.medication.name)
      });
    }
    
    // Gap analysis risk
    const totalGaps = adherenceData.reduce((sum, med) => sum + (med.gaps?.length || 0), 0);
    if (totalGaps > 0) {
      baseRisk += Math.min(30, totalGaps * 5);
      riskAssessment.riskFactors.push({
        type: 'frequent_gaps',
        severity: totalGaps > 3 ? 'high' : 'medium',
        count: totalGaps
      });
    }
    
    // Apply predictive analytics
    try {
      const predictiveRisk = await predictiveAnalytics.predictNonComplianceRisk({
        patientId: patientId,
        adherenceHistory: adherenceData,
        patternAnalysis: patterns,
        riskFactors: patientRiskFactors
      });
      
      riskAssessment.predictiveFactors = predictiveRisk;
      baseRisk = Math.max(baseRisk, predictiveRisk.riskScore);
    } catch (error) {
      console.error('Predictive analytics error:', error);
    }
    
    // Determine overall risk level
    riskAssessment.riskScore = Math.min(100, baseRisk);
    
    if (riskAssessment.riskScore >= 70) {
      riskAssessment.overallRisk = 'high';
      riskAssessment.interventionUrgency = 'urgent';
    } else if (riskAssessment.riskScore >= 40) {
      riskAssessment.overallRisk = 'medium';
      riskAssessment.interventionUrgency = 'priority';
    } else {
      riskAssessment.overallRisk = 'low';
      riskAssessment.interventionUrgency = 'routine';
    }
    
    return riskAssessment;
  }

  async generateInterventionRecommendations(riskAssessment, patterns, patientId, context) {
    const recommendations = [];
    
    // High-risk interventions
    if (riskAssessment.overallRisk === 'high') {
      recommendations.push({
        type: 'clinical_intervention',
        priority: 'urgent',
        action: 'Schedule immediate clinical review',
        description: 'Patient shows high risk for medication non-compliance requiring immediate attention',
        timeline: 'within_24_hours'
      });
      
      recommendations.push({
        type: 'enhanced_monitoring',
        priority: 'high',
        action: 'Implement enhanced adherence monitoring',
        description: 'Daily medication tracking with automated reminders',
        timeline: 'immediate'
      });
    }
    
    // Pattern-based recommendations
    if (patterns.riskFactors.includes('forgetfulness')) {
      recommendations.push({
        type: 'reminder_system',
        priority: 'medium',
        action: 'Set up automated medication reminders',
        description: 'SMS, app notifications, or phone calls at medication times',
        timeline: 'within_week'
      });
    }
    
    if (patterns.riskFactors.includes('side_effects')) {
      recommendations.push({
        type: 'medication_review',
        priority: 'high',
        action: 'Review medication regimen for side effects',
        description: 'Consider alternative medications or dosing adjustments',
        timeline: 'within_week'
      });
    }
    
    // Cost-related interventions
    if (patterns.riskFactors.includes('cost_barriers')) {
      recommendations.push({
        type: 'financial_assistance',
        priority: 'medium',
        action: 'Explore financial assistance programs',
        description: 'Patient assistance programs, generic alternatives, or insurance appeals',
        timeline: 'within_two_weeks'
      });
    }
    
    // Educational interventions
    if (patterns.adherenceDistribution.average < 70) {
      recommendations.push({
        type: 'patient_education',
        priority: 'medium',
        action: 'Provide medication adherence education',
        description: 'Importance of adherence, proper administration, expected outcomes',
        timeline: 'next_visit'
      });
    }
    
    return recommendations;
  }

  async triggerAutomatedInterventions(riskAssessment, patientId, context) {
    const interventions = [];
    
    if (riskAssessment.overallRisk === 'high') {
      // High-risk patient alert
      const alert = await this.createHighRiskAlert(patientId, riskAssessment, context);
      interventions.push(alert);
      
      // Automated outreach
      if (riskAssessment.interventionUrgency === 'urgent') {
        const outreach = await patientEngagementService.triggerUrgentOutreach({
          patientId: patientId,
          reason: 'medication_non_compliance_risk',
          riskLevel: riskAssessment.overallRisk,
          priority: 'high'
        });
        interventions.push(outreach);
      }
    }
    
    // Automated reminder setup
    if (riskAssessment.riskScore >= 40) {
      const reminderSetup = await patientEngagementService.setupMedicationReminders({
        patientId: patientId,
        riskLevel: riskAssessment.overallRisk,
        frequency: riskAssessment.overallRisk === 'high' ? 'daily' : 'as_needed'
      });
      interventions.push(reminderSetup);
    }
    
    return interventions;
  }

  async createHighRiskAlert(patientId, riskAssessment, context) {
    const alert = await SecureDataAccess.create(
      'compliance_alerts',
      {
        patientId: patientId,
        alertType: 'high_non_compliance_risk',
        severity: 'high',
        riskScore: riskAssessment.riskScore,
        riskFactors: riskAssessment.riskFactors,
        message: {
          en: `High risk patient: ${riskAssessment.riskScore}% non-compliance risk. Immediate intervention required.`,
          he: `מטופל בסיכון גבוה: ${riskAssessment.riskScore}% סיכון לאי ציות. נדרשת התערבות מיידית.`
        },
        status: 'active',
        createdAt: new Date(),
        createdBy: context.userId,
        expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days
      },
      context
    );
    
    return alert;
  }

  calculateExpectedRefillDate(fillDate, daysSupply) {
    return new Date(fillDate.getTime() + ((daysSupply - 5) * 24 * 60 * 60 * 1000)); // 5-day buffer
  }

  getMedicationPriority(indication, therapeuticClass) {
    const highPriorityClasses = [
      'cardiovascular',
      'diabetes',
      'anticoagulants',
      'immunosuppressants',
      'psychiatric',
      'seizure_disorders'
    ];
    
    const highPriorityIndications = [
      'heart_failure',
      'diabetes',
      'hypertension',
      'depression',
      'schizophrenia',
      'epilepsy',
      'transplant_rejection'
    ];
    
    if (highPriorityClasses.includes(therapeuticClass) || 
        highPriorityIndications.includes(indication)) {
      return 'high';
    }
    
    return 'medium';
  }

  isHighRiskMedication(medication) {
    const highRiskClasses = [
      'anticoagulants',
      'immunosuppressants',
      'antiarrhythmics',
      'insulin',
      'antipsychotics'
    ];
    
    return highRiskClasses.includes(medication.therapeuticClass);
  }

  async auditComplianceTracking(request, report, context) {
    await AuditLog.create({
      action: 'MEDICATION_COMPLIANCE_TRACKING',
      entityType: 'compliance_tracking',
      entityId: report.id,
      patientId: request.patientId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        medicationsTracked: report.medicationsTracked.length,
        overallAdherence: report.overallAdherence,
        riskLevel: report.riskAssessment?.overallRisk,
        riskScore: report.riskAssessment?.riskScore,
        interventionsTriggered: report.interventionsTriggered,
        calculationMethod: request.calculationMethod || 'pdc',
        dataSources: request.dataSources?.join(',') || 'default'
      },
      timestamp: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }
}

module.exports = new MedicationComplianceService();
```

### 2. API Endpoints

```javascript
// backend/routes/medication-compliance.js
const express = require('express');
const router = express.Router();
const medicationComplianceService = require('../services/medicationComplianceService');
const authMiddleware = require('../middleware/auth');
const auditMiddleware = require('../middleware/audit');

router.post('/track',
  authMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const complianceRequest = {
        patientId: req.body.patientId,
        timeRange: req.body.timeRange,
        calculationMethod: req.body.calculationMethod || 'pdc',
        dataSources: req.body.dataSources || ['pharmacy', 'patient_reported'],
        includeInterventions: req.body.includeInterventions !== false
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await medicationComplianceService.trackMedicationCompliance(
        complianceRequest,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Medication compliance tracking completed successfully',
          he: 'מעקב אחר ציות תרופתי הושלם בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Medication compliance tracking failed',
          he: 'מעקב אחר ציות תרופתי נכשל'
        }
      });
    }
  }
);

router.get('/patient/:patientId/summary',
  authMiddleware,
  async (req, res) => {
    try {
      const timeRange = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : 
                  new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)),
        endDate: req.query.endDate ? new Date(req.query.endDate) : new Date()
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const result = await medicationComplianceService.trackMedicationCompliance({
        patientId: req.params.patientId,
        timeRange: timeRange,
        calculationMethod: 'pdc',
        dataSources: ['pharmacy', 'patient_reported'],
        includeInterventions: false
      }, context);

      res.json({
        success: true,
        data: {
          summary: result.summary,
          overallAdherence: result.adherence,
          riskLevel: result.riskAssessment.overallRisk,
          patterns: result.patterns
        },
        message: {
          en: 'Compliance summary retrieved successfully',
          he: 'סיכום ציות נשלף בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve compliance summary',
          he: 'נכשל בשליפת סיכום ציות'
        }
      });
    }
  }
);

router.get('/patient/:patientId/adherence/:medicationId',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      // Get specific medication adherence
      const result = await medicationComplianceService.trackMedicationCompliance({
        patientId: req.params.patientId,
        medicationFilter: req.params.medicationId,
        calculationMethod: req.query.method || 'pdc',
        timeRange: {
          startDate: req.query.startDate ? new Date(req.query.startDate) : 
                    new Date(Date.now() - (180 * 24 * 60 * 60 * 1000)),
          endDate: req.query.endDate ? new Date(req.query.endDate) : new Date()
        }
      }, context);

      const medicationAdherence = result.adherence.find(med => 
        med.prescriptionId === req.params.medicationId
      );

      if (!medicationAdherence) {
        return res.status(404).json({
          success: false,
          message: {
            en: 'Medication adherence data not found',
            he: 'נתוני ציות לתרופה לא נמצאו'
          }
        });
      }

      res.json({
        success: true,
        data: medicationAdherence,
        message: {
          en: 'Medication adherence data retrieved successfully',
          he: 'נתוני ציות לתרופה נשלפו בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve medication adherence data',
          he: 'נכשל בשליפת נתוני ציות לתרופה'
        }
      });
    }
  }
);

module.exports = router;
```

### 3. Data Models

```javascript
// backend/models/MedicationCompliance.js
const mongoose = require('mongoose');

const MedicationComplianceSchema = new mongoose.Schema({
  complianceId: {
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
  trackingPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  overallAdherence: {
    score: Number, // 0-100
    category: {
      type: String,
      enum: ['excellent', 'good', 'poor', 'very_poor']
    },
    trend: {
      direction: {
        type: String,
        enum: ['improving', 'stable', 'declining', 'unknown']
      },
      confidence: {
        type: String,
        enum: ['high', 'medium', 'low']
      }
    }
  },
  medicationAdherence: [{
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription'
    },
    medication: {
      rxcui: String,
      name: String,
      genericName: String,
      therapeuticClass: String
    },
    adherenceScore: Number, // 0-100
    adherenceCategory: {
      type: String,
      enum: ['excellent', 'good', 'poor', 'very_poor']
    },
    calculationMethod: {
      type: String,
      enum: ['pdc', 'mpr', 'cma', 'medication_possession_ratio']
    },
    dataPoints: {
      pharmacyFills: Number,
      patientReports: Number,
      clinicalAssessments: Number,
      deviceReadings: Number
    },
    gaps: [{
      startDate: Date,
      endDate: Date,
      durationDays: Number,
      reason: String
    }],
    trends: {
      direction: String,
      confidence: String,
      recentChange: Number // % change from previous period
    },
    lastFillDate: Date,
    nextExpectedFill: Date,
    daysUntilNextFill: Number
  }],
  compliancePatterns: {
    overallPattern: {
      type: String,
      enum: ['consistent', 'intermittent', 'declining', 'improving', 'erratic']
    },
    adherenceDistribution: {
      excellent: Number,
      good: Number,
      poor: Number,
      veryPoor: Number,
      average: Number
    },
    temporalPatterns: {
      weeklyPattern: [Number], // 7 values for days of week
      monthlyPattern: String, // 'consistent', 'end_of_month_gaps', etc.
      seasonalPattern: String
    },
    riskFactors: [{
      factor: {
        type: String,
        enum: [
          'forgetfulness', 'side_effects', 'cost_barriers', 'complexity',
          'lack_of_efficacy', 'depression', 'social_barriers', 'other'
        ]
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      confidence: {
        type: String,
        enum: ['low', 'medium', 'high']
      }
    }]
  },
  riskAssessment: {
    overallRisk: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    riskFactors: [{
      type: String,
      severity: String,
      description: String,
      impact: Number
    }],
    predictiveFactors: {
      riskScore: Number,
      confidence: String,
      keyFactors: [String]
    },
    interventionUrgency: {
      type: String,
      enum: ['routine', 'priority', 'urgent']
    }
  },
  interventions: [{
    type: {
      type: String,
      enum: [
        'reminder_system', 'clinical_review', 'medication_review',
        'patient_education', 'financial_assistance', 'enhanced_monitoring'
      ]
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent']
    },
    status: {
      type: String,
      enum: ['recommended', 'scheduled', 'in_progress', 'completed', 'cancelled']
    },
    scheduledDate: Date,
    completedDate: Date,
    outcome: String,
    notes: String
  }],
  dataSources: [{
    source: {
      type: String,
      enum: ['pharmacy', 'patient_reported', 'device_data', 'clinical_visits']
    },
    lastUpdated: Date,
    dataQuality: {
      type: String,
      enum: ['high', 'medium', 'low']
    },
    recordCount: Number
  }],
  alerts: [{
    type: String,
    severity: String,
    message: String,
    triggeredAt: Date,
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved']
    }
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
    processingTime: Number,
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
});

// Indexes for performance
MedicationComplianceSchema.index({ patientId: 1, 'trackingPeriod.endDate': -1 });
MedicationComplianceSchema.index({ practiceId: 1, 'riskAssessment.overallRisk': 1 });
MedicationComplianceSchema.index({ 'overallAdherence.score': 1 });
MedicationComplianceSchema.index({ 'metadata.calculatedAt': -1 });

module.exports = mongoose.model('MedicationCompliance', MedicationComplianceSchema);
```

### 4. Frontend Components

```jsx
// frontend-vite/src/components/medication/ComplianceTracker.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Activity,
  Target,
  Calendar
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import secureApiClient from '@/services/secureApiClient';
import { useTranslation } from '@/hooks/useTranslation';

const ComplianceTracker = ({ patientId }) => {
  const { t } = useTranslation();
  const [complianceData, setComplianceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('90_days');
  const [selectedMedication, setSelectedMedication] = useState(null);

  useEffect(() => {
    if (patientId) {
      loadComplianceData();
    }
  }, [patientId, timeRange]);

  const loadComplianceData = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '30_days':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90_days':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '180_days':
          startDate.setDate(endDate.getDate() - 180);
          break;
        case '365_days':
          startDate.setDate(endDate.getDate() - 365);
          break;
      }

      const response = await secureApiClient.post('/api/medication-compliance/track', {
        patientId,
        timeRange: { startDate, endDate },
        calculationMethod: 'pdc',
        dataSources: ['pharmacy', 'patient_reported'],
        includeInterventions: true
      });

      if (response.data.success) {
        setComplianceData(response.data.data);
      }
    } catch (error) {
      console.error('Error loading compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAdherenceColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getAdherenceBadgeVariant = (category) => {
    switch (category) {
      case 'excellent': return 'success';
      case 'good': return 'default';
      case 'poor': return 'warning';
      case 'very_poor': return 'destructive';
      default: return 'secondary';
    }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (direction) => {
    switch (direction) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable':
        return <Activity className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatAdherenceTrend = (medications) => {
    return medications.map((med, index) => ({
      name: med.medication.name.substring(0, 10) + '...',
      adherence: med.adherenceScore,
      index
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <div className="mt-4">
            {t({ en: 'Loading compliance data...', he: 'טוען נתוני ציות...' })}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!complianceData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <div className="text-lg font-semibold">
            {t({ en: 'No Compliance Data', he: 'אין נתוני ציות' })}
          </div>
          <div className="text-muted-foreground">
            {t({ en: 'No medication compliance data available', he: 'אין נתוני ציות תרופתי זמינים' })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t({ en: 'Medication Compliance Tracking', he: 'מעקב ציות תרופתי' })}
            </CardTitle>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="30_days">{t({ en: '30 Days', he: '30 ימים' })}</option>
              <option value="90_days">{t({ en: '90 Days', he: '90 ימים' })}</option>
              <option value="180_days">{t({ en: '6 Months', he: '6 חודשים' })}</option>
              <option value="365_days">{t({ en: '1 Year', he: 'שנה' })}</option>
            </select>
          </div>
        </CardHeader>
      </Card>

      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t({ en: 'Overall Adherence', he: 'ציות כללי' })}
                </p>
                <p className={`text-2xl font-bold ${getAdherenceColor(complianceData.summary.overallAdherence)}`}>
                  {complianceData.summary.overallAdherence}%
                </p>
              </div>
              <div className="flex items-center gap-1">
                {getTrendIcon(complianceData.trends?.direction)}
              </div>
            </div>
            <Progress 
              value={complianceData.summary.overallAdherence} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t({ en: 'Medications Tracked', he: 'תרופות במעקב' })}
                </p>
                <p className="text-2xl font-bold">{complianceData.summary.medicationsTracked}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t({ en: 'Risk Level', he: 'רמת סיכון' })}
                </p>
                <p className={`text-2xl font-bold ${getRiskColor(complianceData.riskAssessment.overallRisk)}`}>
                  {complianceData.riskAssessment.overallRisk.toUpperCase()}
                </p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${getRiskColor(complianceData.riskAssessment.overallRisk)}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t({ en: 'Compliance Score', he: 'ציון ציות' })}
                </p>
                <p className="text-2xl font-bold">{complianceData.summary.complianceScore}/100</p>
              </div>
              <Target className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Alerts */}
      {complianceData.riskAssessment.riskFactors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t({ en: 'Risk Factors', he: 'גורמי סיכון' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {complianceData.riskAssessment.riskFactors.map((risk, index) => (
              <Alert key={index} variant={risk.severity === 'high' ? 'destructive' : 'warning'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold">
                        {risk.type.replace('_', ' ').toUpperCase()}
                      </span>
                      {risk.description && (
                        <div className="text-sm mt-1">{risk.description}</div>
                      )}
                    </div>
                    <Badge variant={risk.severity === 'high' ? 'destructive' : 'warning'}>
                      {risk.severity}
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Medication-Specific Adherence */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t({ en: 'Medication Adherence Details', he: 'פרטי ציות לתרופות' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceData.adherence.map((medication, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{medication.medication.name}</h4>
                    {medication.medication.genericName && (
                      <p className="text-sm text-muted-foreground">
                        {medication.medication.genericName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getAdherenceBadgeVariant(medication.adherenceCategory)}>
                      {medication.adherenceCategory}
                    </Badge>
                    <span className={`font-bold text-lg ${getAdherenceColor(medication.adherenceScore)}`}>
                      {medication.adherenceScore}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">
                      {t({ en: 'Data Points:', he: 'נקודות מידע:' })}
                    </span>
                    <div className="text-muted-foreground">
                      {medication.dataPoints.pharmacyFills} fills, {medication.dataPoints.patientReports} reports
                    </div>
                  </div>
                  
                  <div>
                    <span className="font-medium">
                      {t({ en: 'Gaps:', he: 'פערים:' })}
                    </span>
                    <div className="text-muted-foreground">
                      {medication.gaps?.length || 0} treatment gaps
                    </div>
                  </div>
                  
                  <div>
                    <span className="font-medium">
                      {t({ en: 'Trend:', he: 'מגמה:' })}
                    </span>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      {getTrendIcon(medication.trends.direction)}
                      {medication.trends.direction}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <Progress value={medication.adherenceScore} className="h-2" />
                </div>

                {/* Treatment Gaps */}
                {medication.gaps && medication.gaps.length > 0 && (
                  <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                    <h6 className="font-medium text-red-800 mb-1">
                      {t({ en: 'Treatment Gaps', he: 'פערי טיפול' })}
                    </h6>
                    <div className="space-y-1">
                      {medication.gaps.slice(0, 3).map((gap, gapIndex) => (
                        <div key={gapIndex} className="text-xs text-red-700">
                          {new Date(gap.startDate).toLocaleDateString()} - 
                          {new Date(gap.endDate).toLocaleDateString()} 
                          ({gap.durationDays} days)
                        </div>
                      ))}
                      {medication.gaps.length > 3 && (
                        <div className="text-xs text-red-700">
                          +{medication.gaps.length - 3} more gaps
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Adherence Trend Chart */}
      {complianceData.adherence.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t({ en: 'Adherence Comparison', he: 'השוואת ציות' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={formatAdherenceTrend(complianceData.adherence)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  formatter={(value) => [`${value}%`, 'Adherence']}
                  labelFormatter={(label, payload) => payload[0]?.payload?.name || label}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="adherence" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  name="Adherence Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Intervention Recommendations */}
      {complianceData.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              {t({ en: 'Intervention Recommendations', he: 'המלצות התערבות' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {complianceData.recommendations.map((recommendation, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={
                    recommendation.priority === 'urgent' ? 'destructive' :
                    recommendation.priority === 'high' ? 'warning' : 'default'
                  }>
                    {recommendation.priority}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {recommendation.timeline}
                  </span>
                </div>
                
                <h5 className="font-medium mb-1">{recommendation.action}</h5>
                <p className="text-sm text-muted-foreground">
                  {recommendation.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComplianceTracker;
```

### 5. Test Cases

```javascript
// backend/tests/medicationComplianceService.test.js
const medicationComplianceService = require('../services/medicationComplianceService');
const SecureDataAccess = require('../services/secureDataAccess');

describe('MedicationComplianceService', () => {
  beforeAll(async () => {
    await medicationComplianceService.initialize();
  });

  describe('calculateAdherence', () => {
    test('should calculate PDC correctly', async () => {
      const mockComplianceData = {
        prescriptions: [{
          prescriptionId: 'rx123',
          medication: { name: 'Metformin', rxcui: '6809' },
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-03-31'),
          daysSupply: 30
        }],
        pharmacyFills: [
          {
            prescriptionId: 'rx123',
            fillDate: new Date('2024-01-01'),
            daysSupply: 30,
            quantity: 60
          },
          {
            prescriptionId: 'rx123',
            fillDate: new Date('2024-02-05'), // 5 day gap
            daysSupply: 30,
            quantity: 60
          },
          {
            prescriptionId: 'rx123',
            fillDate: new Date('2024-03-01'), // On time
            daysSupply: 30,
            quantity: 60
          }
        ],
        patientReported: []
      };

      const context = { userId: 'doctor123', practiceId: 'clinic123' };
      
      const result = await medicationComplianceService.calculateAdherence(
        mockComplianceData,
        'pdc',
        context
      );

      expect(result).toHaveLength(1);
      expect(result[0].adherenceScore).toBeGreaterThan(80); // Should be high despite gap
      expect(result[0].gaps).toHaveLength(1);
      expect(result[0].gaps[0].durationDays).toBe(5);
    });

    test('should handle multiple medications', async () => {
      const mockComplianceData = {
        prescriptions: [
          {
            prescriptionId: 'rx123',
            medication: { name: 'Metformin', rxcui: '6809' },
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-03-31')
          },
          {
            prescriptionId: 'rx456',
            medication: { name: 'Lisinopril', rxcui: '29046' },
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-03-31')
          }
        ],
        pharmacyFills: [
          {
            prescriptionId: 'rx123',
            fillDate: new Date('2024-01-01'),
            daysSupply: 30
          },
          {
            prescriptionId: 'rx456',
            fillDate: new Date('2024-01-01'),
            daysSupply: 30
          }
        ],
        patientReported: []
      };

      const context = { userId: 'doctor123', practiceId: 'clinic123' };
      
      const result = await medicationComplianceService.calculateAdherence(
        mockComplianceData,
        'pdc',
        context
      );

      expect(result).toHaveLength(2);
      expect(result.find(r => r.medication.name === 'Metformin')).toBeDefined();
      expect(result.find(r => r.medication.name === 'Lisinopril')).toBeDefined();
    });
  });

  describe('assessNonComplianceRisk', () => {
    test('should assess high risk for poor adherence', async () => {
      const mockAdherenceData = [
        {
          medication: { therapeuticClass: 'cardiovascular' },
          adherenceScore: 45,
          gaps: [{ durationDays: 14 }, { durationDays: 7 }]
        }
      ];

      const mockPatterns = {
        adherenceDistribution: { average: 45 },
        riskFactors: ['side_effects', 'cost_barriers']
      };

      const context = { userId: 'doctor123', practiceId: 'clinic123' };
      
      const result = await medicationComplianceService.assessNonComplianceRisk(
        mockAdherenceData,
        mockPatterns,
        'patient123',
        context
      );

      expect(result.overallRisk).toBe('high');
      expect(result.riskScore).toBeGreaterThan(70);
      expect(result.interventionUrgency).toBe('urgent');
    });

    test('should assess low risk for excellent adherence', async () => {
      const mockAdherenceData = [
        {
          medication: { therapeuticClass: 'vitamin' },
          adherenceScore: 95,
          gaps: []
        }
      ];

      const mockPatterns = {
        adherenceDistribution: { average: 95 },
        riskFactors: []
      };

      const context = { userId: 'doctor123', practiceId: 'clinic123' };
      
      const result = await medicationComplianceService.assessNonComplianceRisk(
        mockAdherenceData,
        mockPatterns,
        'patient123',
        context
      );

      expect(result.overallRisk).toBe('low');
      expect(result.riskScore).toBeLessThan(40);
      expect(result.interventionUrgency).toBe('routine');
    });
  });

  describe('utility functions', () => {
    test('should categorize adherence correctly', () => {
      expect(medicationComplianceService.categorizeAdherence(90)).toBe('excellent');
      expect(medicationComplianceService.categorizeAdherence(70)).toBe('good');
      expect(medicationComplianceService.categorizeAdherence(50)).toBe('poor');
      expect(medicationComplianceService.categorizeAdherence(30)).toBe('very_poor');
    });

    test('should identify high-risk medications', () => {
      expect(medicationComplianceService.isHighRiskMedication({
        therapeuticClass: 'anticoagulants'
      })).toBe(true);
      
      expect(medicationComplianceService.isHighRiskMedication({
        therapeuticClass: 'vitamin'
      })).toBe(false);
    });

    test('should calculate expected refill date', () => {
      const fillDate = new Date('2024-01-01');
      const daysSupply = 30;
      
      const expectedRefill = medicationComplianceService.calculateExpectedRefillDate(
        fillDate, 
        daysSupply
      );
      
      const expectedDate = new Date('2024-01-26'); // 30 days - 5 day buffer
      expect(expectedRefill.toDateString()).toBe(expectedDate.toDateString());
    });
  });
});
```

## Dependencies
- Pharmacy integration service
- Patient engagement service
- Predictive analytics engine
- Prescription management system
- Patient-reported outcome measures
- Device integration (smart pill dispensers, apps)

## Success Criteria
- ✅ Multi-source adherence calculation (PDC, MPR, CMA)
- ✅ Real-time compliance monitoring
- ✅ Predictive risk assessment
- ✅ Automated intervention triggers
- ✅ Patient engagement integration
- ✅ Gap analysis and trend detection
- ✅ Clinical decision support integration
- ✅ Comprehensive reporting and analytics