# Medication History Management

## Function Details
**Function Name**: getMedicationHistory  
**Location**: backend/services/medicationHistoryService.js  
**Status**: Not Implemented  
**Priority**: High (P1)  
**Complexity**: Medium-High  
**Estimated Time**: 6-8 hours  

## Problem Description
Comprehensive medication history tracking with multi-source integration, timeline visualization, adherence monitoring, and clinical correlation for informed prescribing decisions.

## Implementation Steps

### 1. Core Service Implementation

```javascript
// backend/services/medicationHistoryService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const pharmacyIntegration = require('./pharmacyIntegrationService');
const hl7Service = require('./hl7Service');

class MedicationHistoryService {
  constructor() {
    this.serviceToken = null;
    this.historyCache = new Map();
    this.adherenceCalculator = null;
    this.timelineBuilder = null;
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('medication-history-service');
    this.adherenceCalculator = await this.initializeAdherenceCalculator();
    this.timelineBuilder = await this.initializeTimelineBuilder();
  }

  async getMedicationHistory(historyRequest, context) {
    try {
      await this.validateHistoryRequest(historyRequest, context);
      
      const patientIdentifiers = await this.getPatientIdentifiers(
        historyRequest.patientId, 
        context
      );
      
      const historySources = await this.gatherHistorySources(
        patientIdentifiers,
        historyRequest.sources || 'all',
        historyRequest.timeRange,
        context
      );
      
      const consolidatedHistory = await this.consolidateMedicationHistory(
        historySources,
        historyRequest.includeDuplicates || false,
        context
      );
      
      const timelineData = await this.buildMedicationTimeline(
        consolidatedHistory,
        historyRequest.groupBy || 'chronological',
        context
      );
      
      const adherenceAnalysis = await this.calculateAdherenceMetrics(
        consolidatedHistory,
        historyRequest.analyzeAdherence !== false,
        context
      );
      
      const clinicalInsights = await this.generateClinicalInsights(
        consolidatedHistory,
        timelineData,
        adherenceAnalysis,
        context
      );
      
      const historyReport = await this.generateHistoryReport(
        consolidatedHistory,
        timelineData,
        adherenceAnalysis,
        clinicalInsights,
        historyRequest,
        context
      );
      
      await this.cacheHistoryData(historyRequest.patientId, historyReport, context);
      await this.auditHistoryAccess(historyRequest, historyReport, context);
      
      return {
        historyId: historyReport.id,
        status: 'completed',
        summary: {
          totalMedications: historyReport.medications.length,
          activeMedications: historyReport.medications.filter(m => m.status === 'active').length,
          discontinuedMedications: historyReport.medications.filter(m => m.status === 'discontinued').length,
          chronicConditions: historyReport.chronicMedications.length,
          adherenceScore: historyReport.adherence.overallScore,
          lastUpdated: historyReport.lastUpdated,
          dataCompleteness: historyReport.completeness.score
        },
        timeline: historyReport.timeline,
        medications: historyReport.medications,
        adherence: historyReport.adherence,
        insights: historyReport.insights,
        metadata: historyReport.metadata
      };
      
    } catch (error) {
      await this.handleHistoryError(error, historyRequest, context);
      throw error;
    }
  }

  async validateHistoryRequest(request, context) {
    if (!request.patientId) {
      throw new Error('Patient ID is required for medication history retrieval');
    }
    
    // Validate time range
    if (request.timeRange) {
      const { startDate, endDate } = request.timeRange;
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        throw new Error('Invalid time range: start date must be before end date');
      }
    }
    
    // Validate sources
    const validSources = ['ehr', 'pharmacy', 'claims', 'patient_reported', 'hospital', 'all'];
    if (request.sources && !validSources.includes(request.sources)) {
      throw new Error('Invalid history source specified');
    }
  }

  async getPatientIdentifiers(patientId, context) {
    const patient = await SecureDataAccess.findById('patients', patientId, context);
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    return {
      patientId: patient._id,
      mrn: patient.medicalRecordNumber,
      ssn: patient.demographics.ssn,
      dateOfBirth: patient.demographics.dateOfBirth,
      firstName: patient.demographics.firstName,
      lastName: patient.demographics.lastName,
      insuranceIds: patient.insurance?.map(ins => ({
        memberId: ins.memberId,
        groupNumber: ins.groupNumber,
        planId: ins.planId
      })) || []
    };
  }

  async gatherHistorySources(identifiers, sources, timeRange, context) {
    const historySources = {
      ehr: [],
      pharmacy: [],
      claims: [],
      patientReported: [],
      hospital: []
    };
    
    const defaultTimeRange = {
      startDate: new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)), // 1 year ago
      endDate: new Date()
    };
    
    const queryTimeRange = timeRange || defaultTimeRange;
    
    if (sources === 'all' || sources === 'ehr') {
      historySources.ehr = await this.getEHRMedicationHistory(
        identifiers,
        queryTimeRange,
        context
      );
    }
    
    if (sources === 'all' || sources === 'pharmacy') {
      historySources.pharmacy = await this.getPharmacyFillHistory(
        identifiers,
        queryTimeRange,
        context
      );
    }
    
    if (sources === 'all' || sources === 'claims') {
      historySources.claims = await this.getInsuranceClaimsHistory(
        identifiers,
        queryTimeRange,
        context
      );
    }
    
    if (sources === 'all' || sources === 'patient_reported') {
      historySources.patientReported = await this.getPatientReportedHistory(
        identifiers.patientId,
        queryTimeRange,
        context
      );
    }
    
    if (sources === 'all' || sources === 'hospital') {
      historySources.hospital = await this.getHospitalMedicationHistory(
        identifiers,
        queryTimeRange,
        context
      );
    }
    
    return historySources;
  }

  async getEHRMedicationHistory(identifiers, timeRange, context) {
    const prescriptions = await SecureDataAccess.query(
      'prescriptions',
      {
        patientId: identifiers.patientId,
        prescribedDate: {
          $gte: timeRange.startDate,
          $lte: timeRange.endDate
        }
      },
      {
        sort: { prescribedDate: -1 },
        populate: ['prescriber', 'medication']
      },
      context
    );
    
    return prescriptions.map(prescription => ({
      source: 'ehr',
      sourceId: prescription._id,
      medication: {
        rxcui: prescription.medication.rxcui,
        name: prescription.medication.name,
        genericName: prescription.medication.genericName,
        strength: prescription.medication.strength,
        dosageForm: prescription.medication.dosageForm
      },
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      quantity: prescription.quantity,
      daysSupply: prescription.daysSupply,
      refills: prescription.refills,
      prescriber: {
        npi: prescription.prescriber.npi,
        name: prescription.prescriber.name,
        specialty: prescription.prescriber.specialty
      },
      prescribedDate: prescription.prescribedDate,
      startDate: prescription.startDate,
      endDate: prescription.endDate,
      status: prescription.status,
      indication: prescription.indication,
      notes: prescription.notes,
      lastModified: prescription.updatedAt
    }));
  }

  async getPharmacyFillHistory(identifiers, timeRange, context) {
    try {
      const pharmacyData = await pharmacyIntegration.getPatientFillHistory({
        patientIdentifiers: identifiers,
        dateRange: timeRange
      });
      
      return pharmacyData.fills.map(fill => ({
        source: 'pharmacy',
        sourceId: fill.prescriptionNumber,
        pharmacy: {
          ncpdpId: fill.pharmacy.ncpdpId,
          name: fill.pharmacy.name,
          address: fill.pharmacy.address
        },
        medication: {
          ndc: fill.medication.ndc,
          rxcui: fill.medication.rxcui,
          name: fill.medication.name,
          genericName: fill.medication.genericName,
          strength: fill.medication.strength,
          dosageForm: fill.medication.dosageForm
        },
        quantity: fill.quantity,
        daysSupply: fill.daysSupply,
        fillDate: new Date(fill.fillDate),
        prescriber: fill.prescriber,
        copayAmount: fill.copayAmount,
        insurancePaid: fill.insurancePaid,
        refillNumber: fill.refillNumber,
        lastFillDate: fill.lastFillDate,
        nextFillDate: fill.nextFillDate,
        status: 'filled'
      }));
    } catch (error) {
      console.error('Error retrieving pharmacy history:', error);
      return [];
    }
  }

  async getInsuranceClaimsHistory(identifiers, timeRange, context) {
    const claims = [];
    
    for (const insurance of identifiers.insuranceIds) {
      try {
        const insuranceClaims = await this.queryInsuranceClaims(
          insurance,
          identifiers,
          timeRange,
          context
        );
        claims.push(...insuranceClaims);
      } catch (error) {
        console.error('Error retrieving insurance claims:', error);
      }
    }
    
    return claims.map(claim => ({
      source: 'claims',
      sourceId: claim.claimId,
      insurance: {
        planId: claim.planId,
        memberId: claim.memberId,
        groupNumber: claim.groupNumber
      },
      medication: {
        ndc: claim.ndc,
        name: claim.drugName,
        strength: claim.strength
      },
      quantity: claim.quantity,
      daysSupply: claim.daysSupply,
      serviceDate: new Date(claim.serviceDate),
      pharmacy: claim.pharmacy,
      prescriber: claim.prescriber,
      paidAmount: claim.paidAmount,
      patientPay: claim.patientPay,
      status: 'claimed'
    }));
  }

  async getPatientReportedHistory(patientId, timeRange, context) {
    const patientMeds = await SecureDataAccess.query(
      'patient_reported_medications',
      {
        patientId: patientId,
        reportedDate: {
          $gte: timeRange.startDate,
          $lte: timeRange.endDate
        }
      },
      { sort: { reportedDate: -1 } },
      context
    );
    
    return patientMeds.map(med => ({
      source: 'patient_reported',
      sourceId: med._id,
      medication: {
        name: med.medicationName,
        strength: med.strength,
        dosageForm: med.dosageForm
      },
      dosage: med.dosage,
      frequency: med.frequency,
      indication: med.indication,
      startDate: med.startDate,
      endDate: med.endDate,
      reportedDate: med.reportedDate,
      status: med.status,
      notes: med.notes,
      adherenceNotes: med.adherenceNotes
    }));
  }

  async consolidateMedicationHistory(sources, includeDuplicates, context) {
    const allMedications = [];
    
    // Combine all sources
    Object.values(sources).forEach(sourceData => {
      allMedications.push(...sourceData);
    });
    
    // Sort by date (most recent first)
    allMedications.sort((a, b) => {
      const dateA = a.fillDate || a.prescribedDate || a.serviceDate || a.reportedDate;
      const dateB = b.fillDate || b.prescribedDate || b.serviceDate || b.reportedDate;
      return new Date(dateB) - new Date(dateA);
    });
    
    if (!includeDuplicates) {
      return await this.deduplicateMedications(allMedications, context);
    }
    
    return allMedications.map((med, index) => ({
      ...med,
      historyId: `hist_${index}_${Date.now()}`,
      consolidatedDate: new Date()
    }));
  }

  async deduplicateMedications(medications, context) {
    const deduplicated = [];
    const seenMedications = new Map();
    
    for (const medication of medications) {
      const key = this.generateMedicationKey(medication);
      
      if (!seenMedications.has(key)) {
        seenMedications.set(key, medication);
        deduplicated.push({
          ...medication,
          historyId: `hist_${deduplicated.length}_${Date.now()}`,
          consolidatedDate: new Date(),
          duplicateCount: 1
        });
      } else {
        // Update existing entry with additional source information
        const existing = seenMedications.get(key);
        existing.duplicateCount = (existing.duplicateCount || 1) + 1;
        existing.additionalSources = existing.additionalSources || [];
        existing.additionalSources.push({
          source: medication.source,
          sourceId: medication.sourceId,
          date: medication.fillDate || medication.prescribedDate || medication.serviceDate
        });
      }
    }
    
    return deduplicated;
  }

  generateMedicationKey(medication) {
    const name = medication.medication.name?.toLowerCase() || '';
    const strength = medication.medication.strength || '';
    const dosageForm = medication.medication.dosageForm || '';
    const startDate = medication.startDate ? 
      new Date(medication.startDate).toDateString() : '';
    
    return `${name}_${strength}_${dosageForm}_${startDate}`;
  }

  async buildMedicationTimeline(medications, groupBy, context) {
    switch (groupBy) {
      case 'medication':
        return this.buildMedicationGroupedTimeline(medications);
      case 'condition':
        return this.buildConditionGroupedTimeline(medications);
      case 'prescriber':
        return this.buildPrescriberGroupedTimeline(medications);
      case 'source':
        return this.buildSourceGroupedTimeline(medications);
      default:
        return this.buildChronologicalTimeline(medications);
    }
  }

  buildChronologicalTimeline(medications) {
    const timeline = [];
    const monthGroups = new Map();
    
    medications.forEach(medication => {
      const date = medication.fillDate || medication.prescribedDate || 
                  medication.serviceDate || medication.reportedDate;
      const monthKey = new Date(date).toISOString().substring(0, 7); // YYYY-MM
      
      if (!monthGroups.has(monthKey)) {
        monthGroups.set(monthKey, {
          period: monthKey,
          medications: []
        });
      }
      
      monthGroups.get(monthKey).medications.push(medication);
    });
    
    // Convert to sorted array
    return Array.from(monthGroups.values())
      .sort((a, b) => b.period.localeCompare(a.period));
  }

  async calculateAdherenceMetrics(medications, analyze, context) {
    if (!analyze) {
      return { analyzed: false };
    }
    
    const adherenceData = {
      analyzed: true,
      overallScore: 0,
      medicationAdherence: [],
      patterns: {},
      recommendations: []
    };
    
    // Group by medication for adherence calculation
    const medicationGroups = new Map();
    
    medications.forEach(med => {
      const key = this.generateMedicationKey(med);
      if (!medicationGroups.has(key)) {
        medicationGroups.set(key, []);
      }
      medicationGroups.get(key).push(med);
    });
    
    let totalAdherence = 0;
    let medicationCount = 0;
    
    for (const [medicationKey, medList] of medicationGroups.entries()) {
      if (medList.length > 1) { // Need at least 2 data points
        const adherenceScore = await this.calculateMedicationAdherence(medList, context);
        
        adherenceData.medicationAdherence.push({
          medication: medList[0].medication.name,
          adherenceScore: adherenceScore.score,
          fillPattern: adherenceScore.pattern,
          gaps: adherenceScore.gaps,
          recommendations: adherenceScore.recommendations
        });
        
        totalAdherence += adherenceScore.score;
        medicationCount++;
      }
    }
    
    if (medicationCount > 0) {
      adherenceData.overallScore = Math.round(totalAdherence / medicationCount);
    }
    
    adherenceData.patterns = await this.identifyAdherencePatterns(medications, context);
    adherenceData.recommendations = await this.generateAdherenceRecommendations(
      adherenceData, 
      context
    );
    
    return adherenceData;
  }

  async calculateMedicationAdherence(medicationList, context) {
    // Sort by date
    const sortedMeds = medicationList.sort((a, b) => {
      const dateA = new Date(a.fillDate || a.prescribedDate || a.serviceDate);
      const dateB = new Date(b.fillDate || b.prescribedDate || b.serviceDate);
      return dateA - dateB;
    });
    
    const adherenceScore = {
      score: 0,
      pattern: 'unknown',
      gaps: [],
      recommendations: []
    };
    
    // Calculate Proportion of Days Covered (PDC)
    let totalDaysCovered = 0;
    let totalDaysPeriod = 0;
    let lastEndDate = null;
    
    sortedMeds.forEach((med, index) => {
      const startDate = new Date(med.fillDate || med.prescribedDate || med.serviceDate);
      const daysSupply = parseInt(med.daysSupply) || 30;
      const endDate = new Date(startDate.getTime() + (daysSupply * 24 * 60 * 60 * 1000));
      
      if (index === 0) {
        totalDaysCovered += daysSupply;
        lastEndDate = endDate;
      } else {
        // Check for gap
        if (startDate > lastEndDate) {
          const gapDays = Math.floor((startDate - lastEndDate) / (24 * 60 * 60 * 1000));
          adherenceScore.gaps.push({
            startDate: lastEndDate,
            endDate: startDate,
            durationDays: gapDays
          });
        }
        
        // Calculate overlap or gap
        if (startDate <= lastEndDate) {
          // Overlap - don't double count
          const overlapEnd = new Date(Math.max(endDate, lastEndDate));
          totalDaysCovered += Math.floor((overlapEnd - lastEndDate) / (24 * 60 * 60 * 1000));
          lastEndDate = overlapEnd;
        } else {
          // Gap - add new period
          totalDaysCovered += daysSupply;
          lastEndDate = endDate;
        }
      }
    });
    
    if (sortedMeds.length > 0) {
      const firstDate = new Date(sortedMeds[0].fillDate || sortedMeds[0].prescribedDate);
      const lastDate = lastEndDate;
      totalDaysPeriod = Math.floor((lastDate - firstDate) / (24 * 60 * 60 * 1000));
      
      if (totalDaysPeriod > 0) {
        adherenceScore.score = Math.min(100, Math.round((totalDaysCovered / totalDaysPeriod) * 100));
      }
    }
    
    // Determine pattern
    if (adherenceScore.score >= 80) {
      adherenceScore.pattern = 'excellent';
    } else if (adherenceScore.score >= 60) {
      adherenceScore.pattern = 'good';
    } else if (adherenceScore.score >= 40) {
      adherenceScore.pattern = 'poor';
    } else {
      adherenceScore.pattern = 'very_poor';
    }
    
    return adherenceScore;
  }

  async generateHistoryReport(consolidated, timeline, adherence, insights, request, context) {
    const reportId = `med_history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const report = {
      id: reportId,
      patientId: request.patientId,
      requestParameters: request,
      timestamp: new Date(),
      lastUpdated: new Date(),
      
      medications: consolidated,
      timeline: timeline,
      adherence: adherence,
      insights: insights,
      
      // Categorized medications
      activeMedications: consolidated.filter(m => m.status === 'active' || m.status === 'filled'),
      chronicMedications: this.identifyChronicMedications(consolidated),
      recentChanges: this.identifyRecentChanges(consolidated, 30), // Last 30 days
      
      // Data quality metrics
      completeness: {
        score: this.calculateCompletenessScore(consolidated),
        sources: Object.keys(request.sources || {}).length,
        dateRange: {
          earliest: this.getEarliestDate(consolidated),
          latest: this.getLatestDate(consolidated)
        }
      },
      
      metadata: {
        generatedAt: new Date(),
        requestedBy: context.userId,
        practiceId: context.practiceId,
        version: '1.0.0'
      }
    };
    
    // Store report
    await SecureDataAccess.create(
      'medication_history_reports',
      report,
      context
    );
    
    return report;
  }

  async auditHistoryAccess(request, report, context) {
    await AuditLog.create({
      action: 'MEDICATION_HISTORY_ACCESS',
      entityType: 'medication_history',
      entityId: report.id,
      patientId: request.patientId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        medicationsRetrieved: report.medications.length,
        sources: Object.keys(request.sources || {}),
        timeRange: request.timeRange,
        adherenceAnalyzed: request.analyzeAdherence !== false,
        completenessScore: report.completeness.score
      },
      timestamp: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }
}

module.exports = new MedicationHistoryService();
```

### 2. API Endpoints

```javascript
// backend/routes/medication-history.js
const express = require('express');
const router = express.Router();
const medicationHistoryService = require('../services/medicationHistoryService');
const authMiddleware = require('../middleware/auth');
const auditMiddleware = require('../middleware/audit');

router.post('/history',
  authMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const historyRequest = {
        patientId: req.body.patientId,
        sources: req.body.sources || 'all',
        timeRange: req.body.timeRange,
        includeDuplicates: req.body.includeDuplicates || false,
        analyzeAdherence: req.body.analyzeAdherence !== false,
        groupBy: req.body.groupBy || 'chronological'
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await medicationHistoryService.getMedicationHistory(
        historyRequest,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Medication history retrieved successfully',
          he: 'היסטוריית תרופות נשלפה בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve medication history',
          he: 'נכשל בשליפת היסטוריית תרופות'
        }
      });
    }
  }
);

router.get('/timeline/:patientId',
  authMiddleware,
  async (req, res) => {
    try {
      const timeRange = {
        startDate: req.query.startDate ? new Date(req.query.startDate) : 
                  new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)),
        endDate: req.query.endDate ? new Date(req.query.endDate) : new Date()
      };

      const historyRequest = {
        patientId: req.params.patientId,
        sources: req.query.sources || 'all',
        timeRange: timeRange,
        groupBy: req.query.groupBy || 'chronological',
        analyzeAdherence: false // Quick timeline request
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const result = await medicationHistoryService.getMedicationHistory(
        historyRequest,
        context
      );

      res.json({
        success: true,
        data: {
          timeline: result.timeline,
          summary: result.summary
        },
        message: {
          en: 'Medication timeline retrieved successfully',
          he: 'ציר זמן תרופות נשלף בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve medication timeline',
          he: 'נכשל בשליפת ציר זמן תרופות'
        }
      });
    }
  }
);

router.get('/adherence/:patientId',
  authMiddleware,
  async (req, res) => {
    try {
      const historyRequest = {
        patientId: req.params.patientId,
        sources: 'pharmacy', // Focus on fill data for adherence
        analyzeAdherence: true,
        timeRange: {
          startDate: new Date(Date.now() - (180 * 24 * 60 * 60 * 1000)), // 6 months
          endDate: new Date()
        }
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const result = await medicationHistoryService.getMedicationHistory(
        historyRequest,
        context
      );

      res.json({
        success: true,
        data: {
          adherence: result.adherence,
          summary: result.summary
        },
        message: {
          en: 'Medication adherence analysis completed',
          he: 'ניתוח דבקות תרופתית הושלם'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to analyze medication adherence',
          he: 'נכשל בניתוח דבקות תרופתית'
        }
      });
    }
  }
);

module.exports = router;
```

### 3. Data Models

```javascript
// backend/models/MedicationHistoryReport.js
const mongoose = require('mongoose');

const MedicationHistoryReportSchema = new mongoose.Schema({
  reportId: {
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
  requestParameters: {
    sources: String,
    timeRange: {
      startDate: Date,
      endDate: Date
    },
    includeDuplicates: Boolean,
    analyzeAdherence: Boolean,
    groupBy: String
  },
  medications: [{
    historyId: String,
    source: {
      type: String,
      enum: ['ehr', 'pharmacy', 'claims', 'patient_reported', 'hospital']
    },
    sourceId: String,
    medication: {
      rxcui: String,
      ndc: String,
      name: String,
      genericName: String,
      strength: String,
      dosageForm: String
    },
    dosage: String,
    frequency: String,
    quantity: Number,
    daysSupply: Number,
    refills: Number,
    prescriber: {
      npi: String,
      name: String,
      specialty: String
    },
    pharmacy: {
      ncpdpId: String,
      name: String,
      address: String
    },
    prescribedDate: Date,
    fillDate: Date,
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['active', 'discontinued', 'filled', 'pending', 'expired']
    },
    indication: String,
    notes: String,
    copayAmount: Number,
    insurancePaid: Number,
    duplicateCount: Number,
    additionalSources: [{
      source: String,
      sourceId: String,
      date: Date
    }],
    consolidatedDate: Date
  }],
  timeline: [{
    period: String, // YYYY-MM for monthly grouping
    medications: [String], // Array of historyIds
    events: [{
      type: {
        type: String,
        enum: ['started', 'stopped', 'changed', 'filled']
      },
      medicationName: String,
      date: Date,
      details: String
    }]
  }],
  adherence: {
    analyzed: Boolean,
    overallScore: Number, // 0-100
    medicationAdherence: [{
      medication: String,
      adherenceScore: Number,
      fillPattern: {
        type: String,
        enum: ['excellent', 'good', 'poor', 'very_poor', 'unknown']
      },
      gaps: [{
        startDate: Date,
        endDate: Date,
        durationDays: Number
      }],
      recommendations: [String]
    }],
    patterns: {
      consistentFiller: Boolean,
      earlyRefills: Boolean,
      lateRefills: Boolean,
      missedRefills: Boolean,
      pharmacyShopping: Boolean
    },
    recommendations: [String]
  },
  insights: {
    chronicMedications: [String],
    recentChanges: [{
      type: {
        type: String,
        enum: ['new', 'discontinued', 'dose_change', 'frequency_change']
      },
      medicationName: String,
      date: Date,
      details: String
    }],
    potentialIssues: [{
      type: {
        type: String,
        enum: ['duplicate_therapy', 'interaction_risk', 'adherence_concern']
      },
      description: String,
      severity: {
        type: String,
        enum: ['low', 'moderate', 'high']
      },
      recommendations: [String]
    }],
    clinicalRecommendations: [String]
  },
  completeness: {
    score: Number, // 0-100
    sources: Number,
    dateRange: {
      earliest: Date,
      latest: Date
    },
    missingData: [String]
  },
  metadata: {
    generatedAt: Date,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    version: String,
    processingTime: Number
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for performance
MedicationHistoryReportSchema.index({ patientId: 1, timestamp: -1 });
MedicationHistoryReportSchema.index({ practiceId: 1, timestamp: -1 });
MedicationHistoryReportSchema.index({ 'adherence.overallScore': 1 });
MedicationHistoryReportSchema.index({ 'completeness.score': 1 });

module.exports = mongoose.model('MedicationHistoryReport', MedicationHistoryReportSchema);
```

### 4. Frontend Components

```jsx
// frontend-vite/src/components/medication/MedicationHistoryView.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Pills, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react';
import secureApiClient from '@/services/secureApiClient';
import { useTranslation } from '@/hooks/useTranslation';

const MedicationHistoryView = ({ patientId }) => {
  const { t } = useTranslation();
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    sources: 'all',
    timeRange: 'year',
    groupBy: 'chronological'
  });
  const [activeTab, setActiveTab] = useState('timeline');

  useEffect(() => {
    if (patientId) {
      loadMedicationHistory();
    }
  }, [patientId, filters]);

  const loadMedicationHistory = async () => {
    setLoading(true);
    try {
      const timeRange = getTimeRange(filters.timeRange);
      
      const response = await secureApiClient.post('/api/medication-history/history', {
        patientId,
        sources: filters.sources,
        timeRange,
        groupBy: filters.groupBy,
        analyzeAdherence: true
      });

      if (response.data.success) {
        setHistoryData(response.data.data);
      }
    } catch (error) {
      console.error('Error loading medication history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRange = (range) => {
    const endDate = new Date();
    let startDate;
    
    switch (range) {
      case 'month':
        startDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
        break;
      case '3months':
        startDate = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));
        break;
      case '6months':
        startDate = new Date(Date.now() - (180 * 24 * 60 * 60 * 1000));
        break;
      case 'year':
      default:
        startDate = new Date(Date.now() - (365 * 24 * 60 * 60 * 1000));
        break;
      case '2years':
        startDate = new Date(Date.now() - (2 * 365 * 24 * 60 * 60 * 1000));
        break;
    }
    
    return { startDate, endDate };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'filled':
        return 'success';
      case 'discontinued':
      case 'expired':
        return 'secondary';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getAdherenceColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <div className="mt-4">
            {t({ en: 'Loading medication history...', he: 'טוען היסטוריית תרופות...' })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Pills className="h-5 w-5" />
              {t({ en: 'Medication History', he: 'היסטוריית תרופות' })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={filters.sources}
                onChange={(e) => setFilters(prev => ({ ...prev, sources: e.target.value }))}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="all">{t({ en: 'All Sources', he: 'כל המקורות' })}</option>
                <option value="ehr">{t({ en: 'EHR Only', he: 'רק רשומה רפואית' })}</option>
                <option value="pharmacy">{t({ en: 'Pharmacy Only', he: 'רק בית מרקחת' })}</option>
                <option value="claims">{t({ en: 'Insurance Claims', he: 'תביעות ביטוח' })}</option>
              </select>
              <select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value }))}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="month">{t({ en: '1 Month', he: 'חודש' })}</option>
                <option value="3months">{t({ en: '3 Months', he: '3 חודשים' })}</option>
                <option value="6months">{t({ en: '6 Months', he: '6 חודשים' })}</option>
                <option value="year">{t({ en: '1 Year', he: 'שנה' })}</option>
                <option value="2years">{t({ en: '2 Years', he: 'שנתיים' })}</option>
              </select>
              <Button onClick={loadMedicationHistory} size="sm">
                <Filter className="h-4 w-4 mr-1" />
                {t({ en: 'Apply', he: 'החל' })}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {historyData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t({ en: 'Total Medications', he: 'סך תרופות' })}
                    </p>
                    <p className="text-2xl font-bold">{historyData.summary.totalMedications}</p>
                  </div>
                  <Pills className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t({ en: 'Active Medications', he: 'תרופות פעילות' })}
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {historyData.summary.activeMedications}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t({ en: 'Adherence Score', he: 'ציון דבקות' })}
                    </p>
                    <p className={`text-2xl font-bold ${getAdherenceColor(historyData.summary.adherenceScore)}`}>
                      {historyData.summary.adherenceScore}%
                    </p>
                  </div>
                  <TrendingUp className={`h-8 w-8 ${getAdherenceColor(historyData.summary.adherenceScore)}`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t({ en: 'Data Quality', he: 'איכות נתונים' })}
                    </p>
                    <p className="text-2xl font-bold">{historyData.summary.dataCompleteness}%</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Views */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="timeline">
                <Calendar className="h-4 w-4 mr-2" />
                {t({ en: 'Timeline', he: 'ציר זמן' })}
              </TabsTrigger>
              <TabsTrigger value="medications">
                <Pills className="h-4 w-4 mr-2" />
                {t({ en: 'Medications', he: 'תרופות' })}
              </TabsTrigger>
              <TabsTrigger value="adherence">
                <TrendingUp className="h-4 w-4 mr-2" />
                {t({ en: 'Adherence', he: 'דבקות' })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t({ en: 'Medication Timeline', he: 'ציר זמן תרופות' })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {historyData.timeline.map((period, index) => (
                      <div key={period.period} className="border-l-2 border-primary pl-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">
                            {new Date(period.period + '-01').toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long'
                            })}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {period.medications.length} {t({ en: 'medications', he: 'תרופות' })}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {period.medications.slice(0, 5).map((medId) => {
                            const medication = historyData.medications.find(m => m.historyId === medId);
                            if (!medication) return null;
                            
                            return (
                              <div key={medId} className="flex items-center justify-between p-2 bg-muted rounded">
                                <div>
                                  <div className="font-medium">{medication.medication.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {medication.dosage} • {medication.frequency}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={getStatusColor(medication.status)}>
                                    {medication.status}
                                  </Badge>
                                  <Badge variant="outline">
                                    {medication.source}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                          
                          {period.medications.length > 5 && (
                            <div className="text-sm text-muted-foreground text-center py-2">
                              +{period.medications.length - 5} more medications
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="medications">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t({ en: 'All Medications', he: 'כל התרופות' })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {historyData.medications.map((medication, index) => (
                      <div key={medication.historyId} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{medication.medication.name}</h4>
                              {medication.medication.genericName && (
                                <span className="text-sm text-muted-foreground">
                                  ({medication.medication.genericName})
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              <div>
                                <span className="font-medium">
                                  {t({ en: 'Dosage:', he: 'מינון:' })}
                                </span>
                                {' ' + medication.dosage}
                              </div>
                              <div>
                                <span className="font-medium">
                                  {t({ en: 'Frequency:', he: 'תדירות:' })}
                                </span>
                                {' ' + medication.frequency}
                              </div>
                              <div>
                                <span className="font-medium">
                                  {t({ en: 'Source:', he: 'מקור:' })}
                                </span>
                                {' ' + medication.source}
                              </div>
                              <div>
                                <span className="font-medium">
                                  {t({ en: 'Date:', he: 'תאריך:' })}
                                </span>
                                {' ' + formatDate(medication.fillDate || medication.prescribedDate)}
                              </div>
                            </div>
                            
                            {medication.prescriber && (
                              <div className="mt-2 text-sm">
                                <span className="font-medium">
                                  {t({ en: 'Prescriber:', he: 'רופא מרשם:' })}
                                </span>
                                {' ' + medication.prescriber.name}
                                {medication.prescriber.specialty && (
                                  <span className="text-muted-foreground">
                                    {' (' + medication.prescriber.specialty + ')'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={getStatusColor(medication.status)}>
                              {medication.status}
                            </Badge>
                            {medication.duplicateCount > 1 && (
                              <Badge variant="secondary">
                                {medication.duplicateCount} sources
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="adherence">
              <div className="space-y-6">
                {/* Overall Adherence */}
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {t({ en: 'Adherence Analysis', he: 'ניתוח דבקות' })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center mb-6">
                      <div className={`text-4xl font-bold ${getAdherenceColor(historyData.adherence.overallScore)}`}>
                        {historyData.adherence.overallScore}%
                      </div>
                      <div className="text-muted-foreground">
                        {t({ en: 'Overall Adherence Score', he: 'ציון דבקות כללי' })}
                      </div>
                    </div>
                    
                    {historyData.adherence.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="font-semibold">
                          {t({ en: 'Recommendations:', he: 'המלצות:' })}
                        </h5>
                        {historyData.adherence.recommendations.map((rec, index) => (
                          <div key={index} className="p-3 bg-muted rounded flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                            <span className="text-sm">{rec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Per-Medication Adherence */}
                {historyData.adherence.medicationAdherence && historyData.adherence.medicationAdherence.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {t({ en: 'Medication-Specific Adherence', he: 'דבקות לפי תרופה' })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {historyData.adherence.medicationAdherence.map((medAdherence, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium">{medAdherence.medication}</h5>
                              <div className="flex items-center gap-2">
                                <Badge variant={medAdherence.fillPattern === 'excellent' ? 'success' : 
                                              medAdherence.fillPattern === 'good' ? 'default' : 'warning'}>
                                  {medAdherence.fillPattern}
                                </Badge>
                                <span className={`font-bold ${getAdherenceColor(medAdherence.adherenceScore)}`}>
                                  {medAdherence.adherenceScore}%
                                </span>
                              </div>
                            </div>
                            
                            {medAdherence.gaps.length > 0 && (
                              <div className="mt-2">
                                <span className="text-sm font-medium text-red-600">
                                  {t({ en: 'Treatment Gaps:', he: 'פערי טיפול:' })}
                                </span>
                                <div className="mt-1 space-y-1">
                                  {medAdherence.gaps.map((gap, gapIndex) => (
                                    <div key={gapIndex} className="text-sm text-muted-foreground flex items-center gap-2">
                                      <Clock className="h-3 w-3" />
                                      {formatDate(gap.startDate)} - {formatDate(gap.endDate)}
                                      ({gap.durationDays} days)
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {medAdherence.recommendations.length > 0 && (
                              <div className="mt-3">
                                <span className="text-sm font-medium">
                                  {t({ en: 'Recommendations:', he: 'המלצות:' })}
                                </span>
                                <ul className="mt-1 space-y-1">
                                  {medAdherence.recommendations.map((rec, recIndex) => (
                                    <li key={recIndex} className="text-sm text-muted-foreground">
                                      • {rec}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default MedicationHistoryView;
```

### 5. Test Cases

```javascript
// backend/tests/medicationHistoryService.test.js
const medicationHistoryService = require('../services/medicationHistoryService');
const SecureDataAccess = require('../services/secureDataAccess');

describe('MedicationHistoryService', () => {
  beforeAll(async () => {
    await medicationHistoryService.initialize();
  });

  describe('getMedicationHistory', () => {
    test('should retrieve comprehensive medication history', async () => {
      const request = {
        patientId: 'patient123',
        sources: 'all',
        timeRange: {
          startDate: new Date('2023-01-01'),
          endDate: new Date('2024-01-01')
        },
        analyzeAdherence: true
      };

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await medicationHistoryService.getMedicationHistory(request, context);

      expect(result.status).toBe('completed');
      expect(result.historyId).toBeDefined();
      expect(result.timeline).toBeInstanceOf(Array);
      expect(result.medications).toBeInstanceOf(Array);
      expect(result.adherence.analyzed).toBe(true);
      expect(result.summary).toHaveProperty('totalMedications');
    });

    test('should handle pharmacy-only history request', async () => {
      const request = {
        patientId: 'patient123',
        sources: 'pharmacy',
        analyzeAdherence: true
      };

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await medicationHistoryService.getMedicationHistory(request, context);

      expect(result.status).toBe('completed');
      expect(result.medications.every(med => med.source === 'pharmacy')).toBe(true);
    });

    test('should calculate adherence correctly', async () => {
      // Mock pharmacy fill data with known pattern
      const mockFills = [
        {
          source: 'pharmacy',
          medication: { name: 'Metformin', rxcui: '6809' },
          fillDate: new Date('2023-01-01'),
          daysSupply: 30
        },
        {
          source: 'pharmacy',
          medication: { name: 'Metformin', rxcui: '6809' },
          fillDate: new Date('2023-02-05'), // 5 day gap
          daysSupply: 30
        },
        {
          source: 'pharmacy',
          medication: { name: 'Metformin', rxcui: '6809' },
          fillDate: new Date('2023-03-01'), // On time
          daysSupply: 30
        }
      ];

      jest.spyOn(medicationHistoryService, 'getPharmacyFillHistory')
        .mockResolvedValue(mockFills);

      const request = {
        patientId: 'patient123',
        sources: 'pharmacy',
        analyzeAdherence: true
      };

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await medicationHistoryService.getMedicationHistory(request, context);

      expect(result.adherence.analyzed).toBe(true);
      expect(result.adherence.overallScore).toBeGreaterThan(0);
      expect(result.adherence.medicationAdherence).toHaveLength(1);
      expect(result.adherence.medicationAdherence[0].gaps).toBeDefined();
    });
  });

  describe('consolidateMedicationHistory', () => {
    test('should deduplicate medications correctly', async () => {
      const sources = {
        ehr: [
          {
            source: 'ehr',
            medication: { name: 'Aspirin', strength: '81mg' },
            startDate: '2023-01-01'
          }
        ],
        pharmacy: [
          {
            source: 'pharmacy',
            medication: { name: 'Aspirin', strength: '81mg' },
            fillDate: '2023-01-01'
          }
        ]
      };

      const context = { userId: 'doctor123', practiceId: 'clinic123' };
      const result = await medicationHistoryService.consolidateMedicationHistory(
        sources,
        false, // don't include duplicates
        context
      );

      expect(result).toHaveLength(1);
      expect(result[0].duplicateCount).toBe(2);
      expect(result[0].additionalSources).toHaveLength(1);
    });
  });
});
```

## Dependencies
- Multi-source data integration (EHR, pharmacy, claims)
- Patient identity matching
- Medication normalization (RxNorm/NDC)
- Adherence calculation algorithms
- Timeline visualization
- Audit logging

## Success Criteria
- ✅ Multi-source medication history consolidation
- ✅ Timeline visualization with configurable grouping
- ✅ Adherence analysis with gap identification
- ✅ Duplicate detection and deduplication
- ✅ Clinical insights and recommendations
- ✅ Data quality scoring
- ✅ Real-time updates from pharmacy feeds
- ✅ Comprehensive audit trail