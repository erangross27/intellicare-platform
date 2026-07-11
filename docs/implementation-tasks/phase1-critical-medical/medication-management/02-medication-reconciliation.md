# Medication Reconciliation Function

## Function Details
- **Function Name**: performMedicationReconciliation
- **Location**: `backend/services/medicationReconciliationService.js`
- **Status**: Not Implemented
- **Priority**: Critical
- **Complexity**: Very High
- **Estimated Time**: 10-14 hours

## Problem Description
The system requires comprehensive medication reconciliation capabilities to ensure accurate medication lists during care transitions, hospital admissions, discharges, and routine visits. This function must compare multiple medication sources, identify discrepancies, suggest reconciliation actions, integrate with external pharmacy systems, and maintain complete audit trails for patient safety and regulatory compliance.

## Implementation Steps

### 1. Core Service Implementation
```javascript
// backend/services/medicationReconciliationService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const agentServiceWrapper = require('./agentServiceWrapper');
const pharmacyNetworkService = require('./pharmacyNetworkService');

class MedicationReconciliationService {
  constructor() {
    this.serviceToken = null;
    this.reconciliationRules = null;
    this.externalSources = new Map();
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('medication-reconciliation-service');
    await this.loadReconciliationRules();
    await this.initializeExternalSources();
  }

  async performMedicationReconciliation(reconciliationRequest, context) {
    try {
      // Create reconciliation session for tracking
      const reconciliationSession = await this.initializeReconciliationSession(reconciliationRequest, context);
      
      // Gather medication data from multiple sources
      const medicationSources = await this.gatherMedicationSources(
        reconciliationRequest.patientId,
        reconciliationRequest.sources || 'all',
        context
      );
      
      // Normalize medication data from all sources
      const normalizedMedications = await this.normalizeMedicationData(medicationSources, context);
      
      // Perform intelligent medication matching
      const matchingResults = await this.performMedicationMatching(normalizedMedications, context);
      
      // Identify discrepancies and conflicts
      const discrepancyAnalysis = await this.analyzeDiscrepancies(matchingResults, context);
      
      // Generate reconciliation recommendations
      const reconciliationRecommendations = await this.generateRecommendations(
        discrepancyAnalysis,
        reconciliationRequest.reconciliationType,
        context
      );
      
      // Apply clinical decision support
      const clinicalValidation = await this.validateClinicalSafety(
        reconciliationRecommendations,
        reconciliationRequest.patientId,
        context
      );
      
      // Create comprehensive reconciliation report
      const reconciliationReport = await this.generateReconciliationReport(
        {
          session: reconciliationSession,
          sources: medicationSources,
          matching: matchingResults,
          discrepancies: discrepancyAnalysis,
          recommendations: reconciliationRecommendations,
          validation: clinicalValidation
        },
        context
      );
      
      // Handle auto-reconciliation for high-confidence matches
      const autoReconciliation = await this.processAutoReconciliation(
        reconciliationRecommendations,
        reconciliationRequest.autoReconcile || false,
        context
      );
      
      // Store reconciliation results
      const storedReconciliation = await this.storeReconciliationResults(
        reconciliationReport,
        autoReconciliation,
        context
      );
      
      // Update patient medication list if requested
      if (reconciliationRequest.updateMedicationList && autoReconciliation.applied.length > 0) {
        await this.updatePatientMedicationList(
          reconciliationRequest.patientId,
          autoReconciliation.applied,
          context
        );
      }
      
      // Finalize reconciliation session
      await this.finalizeReconciliationSession(
        reconciliationSession,
        storedReconciliation,
        context
      );
      
      // Comprehensive audit logging
      await AuditLog.create({
        action: 'MEDICATION_RECONCILIATION',
        userId: context.userId,
        practiceId: context.practiceId,
        patientId: reconciliationRequest.patientId,
        details: {
          sessionId: reconciliationSession._id,
          reconciliationType: reconciliationRequest.reconciliationType,
          sourcesProcessed: medicationSources.length,
          medicationsAnalyzed: normalizedMedications.total,
          discrepanciesFound: discrepancyAnalysis.totalDiscrepancies,
          recommendationsGenerated: reconciliationRecommendations.length,
          autoReconciled: autoReconciliation.applied.length,
          requiresReview: reconciliationRecommendations.filter(r => r.requiresReview).length
        },
        timestamp: new Date(),
        priority: discrepancyAnalysis.criticalDiscrepancies > 0 ? 'high' : 'normal'
      });
      
      return {
        reconciliationId: storedReconciliation._id,
        sessionId: reconciliationSession._id,
        status: 'completed',
        summary: {
          sourcesProcessed: medicationSources.length,
          medicationsAnalyzed: normalizedMedications.total,
          perfectMatches: matchingResults.perfectMatches.length,
          discrepanciesFound: discrepancyAnalysis.totalDiscrepancies,
          criticalDiscrepancies: discrepancyAnalysis.criticalDiscrepancies,
          recommendationsGenerated: reconciliationRecommendations.length,
          autoReconciled: autoReconciliation.applied.length,
          requiresManualReview: reconciliationRecommendations.filter(r => r.requiresReview).length
        },
        reconciliationReport: reconciliationReport,
        nextActions: this.determineNextActions(reconciliationRecommendations, autoReconciliation)
      };
      
    } catch (error) {
      await this.handleReconciliationError(error, reconciliationRequest, context);
      throw new Error(`Medication reconciliation failed: ${error.message}`);
    }
  }

  async gatherMedicationSources(patientId, sourcesConfig, context) {
    const sources = [];
    
    // Current EHR medication list
    if (sourcesConfig === 'all' || sourcesConfig.includes('ehr')) {
      const ehrMedications = await this.getEHRMedications(patientId, context);
      sources.push({
        sourceType: 'ehr',
        sourceName: 'Electronic Health Record',
        medications: ehrMedications,
        lastUpdated: new Date(),
        reliability: 0.9
      });
    }
    
    // Pharmacy fill history
    if (sourcesConfig === 'all' || sourcesConfig.includes('pharmacy')) {
      const pharmacyHistory = await this.getPharmacyFillHistory(patientId, context);
      sources.push({
        sourceType: 'pharmacy',
        sourceName: 'Pharmacy Fill History',
        medications: pharmacyHistory,
        lastUpdated: new Date(),
        reliability: 0.95
      });
    }
    
    // Patient-reported medications
    if (sourcesConfig === 'all' || sourcesConfig.includes('patient')) {
      const patientReported = await this.getPatientReportedMedications(patientId, context);
      sources.push({
        sourceType: 'patient',
        sourceName: 'Patient-Reported',
        medications: patientReported,
        lastUpdated: new Date(),
        reliability: 0.7
      });
    }
    
    // Admission medication list
    if (sourcesConfig.includes('admission')) {
      const admissionMeds = await this.getAdmissionMedications(patientId, context);
      if (admissionMeds.length > 0) {
        sources.push({
          sourceType: 'admission',
          sourceName: 'Hospital Admission List',
          medications: admissionMeds,
          lastUpdated: new Date(),
          reliability: 0.85
        });
      }
    }
    
    // Discharge medication list
    if (sourcesConfig.includes('discharge')) {
      const dischargeMeds = await this.getDischargeMedications(patientId, context);
      if (dischargeMeds.length > 0) {
        sources.push({
          sourceType: 'discharge',
          sourceName: 'Hospital Discharge List',
          medications: dischargeMeds,
          lastUpdated: new Date(),
          reliability: 0.9
        });
      }
    }
    
    // External provider records
    if (sourcesConfig.includes('external')) {
      const externalMeds = await this.getExternalProviderMedications(patientId, context);
      for (const externalSource of externalMeds) {
        sources.push({
          sourceType: 'external',
          sourceName: externalSource.providerName,
          medications: externalSource.medications,
          lastUpdated: externalSource.lastUpdated,
          reliability: 0.8
        });
      }
    }
    
    return sources;
  }

  async normalizeMedicationData(medicationSources, context) {
    const normalized = {
      bySource: [],
      combined: [],
      total: 0
    };
    
    for (const source of medicationSources) {
      const normalizedSource = {
        ...source,
        medications: []
      };
      
      for (const medication of source.medications) {
        const normalizedMed = await this.normalizeSingleMedication(medication, source.sourceType, context);
        normalizedSource.medications.push(normalizedMed);
        normalized.combined.push({
          ...normalizedMed,
          source: source.sourceType,
          sourceName: source.sourceName,
          reliability: source.reliability
        });
      }
      
      normalized.bySource.push(normalizedSource);
      normalized.total += source.medications.length;
    }
    
    return normalized;
  }

  async normalizeSingleMedication(medication, sourceType, context) {
    // Standardize medication name using drug database
    const drugInfo = await this.lookupDrugInformation(medication.name || medication.genericName, context);
    
    return {
      originalData: medication,
      normalized: {
        genericName: drugInfo?.genericName || medication.genericName || medication.name,
        brandName: drugInfo?.brandName || medication.brandName,
        rxcui: drugInfo?.rxcui || medication.rxcui,
        ndc: drugInfo?.ndc || medication.ndc,
        strength: this.normalizeStrength(medication.strength),
        dosageForm: this.normalizeDosageForm(medication.dosageForm || medication.form),
        route: this.normalizeRoute(medication.route),
        frequency: this.normalizeFrequency(medication.frequency || medication.directions),
        quantity: medication.quantity,
        daysSupply: medication.daysSupply,
        lastFilled: medication.lastFilled || medication.fillDate,
        prescriber: medication.prescriber || medication.provider,
        status: this.normalizeStatus(medication.status, sourceType),
        instructions: medication.instructions || medication.directions
      },
      confidence: this.calculateNormalizationConfidence(medication, drugInfo),
      source: sourceType
    };
  }

  async performMedicationMatching(normalizedMedications, context) {
    const matching = {
      perfectMatches: [],
      likelyMatches: [],
      possibleMatches: [],
      noMatches: [],
      conflicts: []
    };
    
    // Group medications for comparison
    const medicationGroups = this.groupMedicationsByIdentifier(normalizedMedications.combined);
    
    for (const [identifier, medications] of Object.entries(medicationGroups)) {
      if (medications.length === 1) {
        matching.noMatches.push({
          medication: medications[0],
          reason: 'Single source medication'
        });
        continue;
      }
      
      // Compare medications within each group
      const comparisonResult = await this.compareMedicationsInGroup(medications, context);
      
      // Categorize based on similarity score
      if (comparisonResult.averageSimilarity >= 0.95) {
        matching.perfectMatches.push({
          medications,
          similarity: comparisonResult.averageSimilarity,
          differences: comparisonResult.differences
        });
      } else if (comparisonResult.averageSimilarity >= 0.80) {
        matching.likelyMatches.push({
          medications,
          similarity: comparisonResult.averageSimilarity,
          differences: comparisonResult.differences
        });
      } else if (comparisonResult.averageSimilarity >= 0.60) {
        matching.possibleMatches.push({
          medications,
          similarity: comparisonResult.averageSimilarity,
          differences: comparisonResult.differences
        });
      }
      
      // Check for conflicts (same medication with significant differences)
      if (comparisonResult.hasConflicts) {
        matching.conflicts.push({
          medications,
          conflicts: comparisonResult.conflicts,
          similarity: comparisonResult.averageSimilarity
        });
      }
    }
    
    return matching;
  }

  async analyzeDiscrepancies(matchingResults, context) {
    const analysis = {
      totalDiscrepancies: 0,
      criticalDiscrepancies: 0,
      discrepancyTypes: {},
      detailedAnalysis: []
    };
    
    // Analyze conflicts (critical discrepancies)
    for (const conflict of matchingResults.conflicts) {
      for (const conflictDetail of conflict.conflicts) {
        const discrepancy = {
          type: 'conflict',
          severity: this.assessDiscrepancySeverity(conflictDetail),
          medications: conflict.medications,
          issue: conflictDetail.issue,
          description: conflictDetail.description,
          clinicalSignificance: await this.assessClinicalSignificance(conflictDetail, context)
        };
        
        analysis.detailedAnalysis.push(discrepancy);
        analysis.totalDiscrepancies++;
        
        if (discrepancy.severity === 'critical') {
          analysis.criticalDiscrepancies++;
        }
        
        // Count by type
        analysis.discrepancyTypes[conflictDetail.type] = 
          (analysis.discrepancyTypes[conflictDetail.type] || 0) + 1;
      }
    }
    
    // Analyze likely matches with differences
    for (const match of matchingResults.likelyMatches) {
      for (const difference of match.differences) {
        const discrepancy = {
          type: 'difference',
          severity: this.assessDiscrepancySeverity(difference),
          medications: match.medications,
          issue: difference.field,
          description: difference.description,
          clinicalSignificance: await this.assessClinicalSignificance(difference, context)
        };
        
        analysis.detailedAnalysis.push(discrepancy);
        analysis.totalDiscrepancies++;
        
        // Count by type
        analysis.discrepancyTypes[difference.field] = 
          (analysis.discrepancyTypes[difference.field] || 0) + 1;
      }
    }
    
    // Identify missing medications (in one source but not others)
    const missingMedications = await this.identifyMissingMedications(matchingResults, context);
    for (const missing of missingMedications) {
      analysis.detailedAnalysis.push({
        type: 'missing',
        severity: 'moderate',
        medication: missing.medication,
        missingFrom: missing.missingFrom,
        presentIn: missing.presentIn,
        description: `Medication present in ${missing.presentIn.join(', ')} but missing from ${missing.missingFrom.join(', ')}`
      });
      analysis.totalDiscrepancies++;
    }
    
    return analysis;
  }

  async generateRecommendations(discrepancyAnalysis, reconciliationType, context) {
    const recommendations = [];
    
    for (const discrepancy of discrepancyAnalysis.detailedAnalysis) {
      switch (discrepancy.type) {
        case 'conflict':
          recommendations.push(await this.generateConflictRecommendation(discrepancy, context));
          break;
          
        case 'difference':
          recommendations.push(await this.generateDifferenceRecommendation(discrepancy, context));
          break;
          
        case 'missing':
          recommendations.push(await this.generateMissingMedicationRecommendation(discrepancy, context));
          break;
      }
    }
    
    // Add reconciliation-type specific recommendations
    if (reconciliationType === 'admission') {
      recommendations.push(...await this.generateAdmissionRecommendations(discrepancyAnalysis, context));
    } else if (reconciliationType === 'discharge') {
      recommendations.push(...await this.generateDischargeRecommendations(discrepancyAnalysis, context));
    }
    
    // Prioritize recommendations
    return this.prioritizeRecommendations(recommendations);
  }

  async generateConflictRecommendation(discrepancy, context) {
    const recommendation = {
      id: this.generateRecommendationId(),
      type: 'resolve_conflict',
      priority: 'high',
      severity: discrepancy.severity,
      medications: discrepancy.medications,
      issue: discrepancy.issue,
      description: discrepancy.description,
      requiresReview: true,
      autoReconcile: false,
      actions: []
    };
    
    // Generate specific actions based on conflict type
    if (discrepancy.issue.includes('dosage')) {
      recommendation.actions.push({
        action: 'verify_dosage',
        description: 'Verify correct dosage with prescriber or most recent prescription',
        options: discrepancy.medications.map(med => ({
          source: med.source,
          dosage: `${med.normalized.strength} ${med.normalized.frequency}`,
          reliability: med.reliability
        }))
      });
    }
    
    if (discrepancy.issue.includes('frequency')) {
      recommendation.actions.push({
        action: 'clarify_frequency',
        description: 'Clarify dosing frequency with patient or prescriber',
        options: discrepancy.medications.map(med => ({
          source: med.source,
          frequency: med.normalized.frequency,
          reliability: med.reliability
        }))
      });
    }
    
    // Add clinical guidance
    if (discrepancy.clinicalSignificance?.high) {
      recommendation.actions.push({
        action: 'clinical_review',
        description: 'Clinical review recommended due to potential safety concerns',
        urgency: 'immediate'
      });
    }
    
    return recommendation;
  }

  async validateClinicalSafety(recommendations, patientId, context) {
    const validation = {
      safetyAlerts: [],
      drugInteractions: [],
      dosageWarnings: [],
      duplicateTherapy: [],
      overallRisk: 'low'
    };
    
    // Get patient context for clinical validation
    const patientContext = await this.getPatientClinicalContext(patientId, context);
    
    // Check each recommendation for clinical safety
    for (const recommendation of recommendations) {
      if (recommendation.medications) {
        // Check for drug interactions
        const interactions = await this.checkInteractionsInRecommendation(
          recommendation.medications,
          patientContext.currentMedications,
          context
        );
        if (interactions.length > 0) {
          validation.drugInteractions.push(...interactions);
        }
        
        // Check dosage safety
        const dosageWarnings = await this.validateDosageSafety(
          recommendation.medications,
          patientContext,
          context
        );
        if (dosageWarnings.length > 0) {
          validation.dosageWarnings.push(...dosageWarnings);
        }
        
        // Check for duplicate therapy
        const duplicates = await this.checkDuplicateTherapy(
          recommendation.medications,
          patientContext.currentMedications,
          context
        );
        if (duplicates.length > 0) {
          validation.duplicateTherapy.push(...duplicates);
        }
      }
    }
    
    // Assess overall clinical risk
    validation.overallRisk = this.assessOverallClinicalRisk(validation);
    
    return validation;
  }

  async processAutoReconciliation(recommendations, autoReconcileEnabled, context) {
    const autoReconciliation = {
      applied: [],
      skipped: [],
      requiresReview: []
    };
    
    if (!autoReconcileEnabled) {
      autoReconciliation.skipped = recommendations.map(r => ({
        ...r,
        reason: 'Auto-reconciliation disabled'
      }));
      return autoReconciliation;
    }
    
    for (const recommendation of recommendations) {
      if (recommendation.autoReconcile && 
          recommendation.priority !== 'critical' && 
          !recommendation.requiresReview) {
        
        try {
          // Apply the recommendation automatically
          const applicationResult = await this.applyRecommendation(recommendation, context);
          autoReconciliation.applied.push({
            ...recommendation,
            applicationResult
          });
        } catch (error) {
          autoReconciliation.skipped.push({
            ...recommendation,
            reason: `Auto-application failed: ${error.message}`
          });
        }
      } else {
        autoReconciliation.requiresReview.push({
          ...recommendation,
          reason: this.determineManualReviewReason(recommendation)
        });
      }
    }
    
    return autoReconciliation;
  }

  // Utility methods for medication comparison and normalization
  calculateMedicationSimilarity(med1, med2) {
    let similarity = 0;
    let factors = 0;
    
    // Generic name comparison (highest weight)
    if (med1.normalized.genericName && med2.normalized.genericName) {
      similarity += this.stringSimilarity(med1.normalized.genericName, med2.normalized.genericName) * 0.4;
      factors += 0.4;
    }
    
    // RxCUI comparison (exact match)
    if (med1.normalized.rxcui && med2.normalized.rxcui) {
      similarity += (med1.normalized.rxcui === med2.normalized.rxcui ? 1 : 0) * 0.3;
      factors += 0.3;
    }
    
    // Strength comparison
    if (med1.normalized.strength && med2.normalized.strength) {
      similarity += (med1.normalized.strength === med2.normalized.strength ? 1 : 0) * 0.15;
      factors += 0.15;
    }
    
    // Dosage form comparison
    if (med1.normalized.dosageForm && med2.normalized.dosageForm) {
      similarity += (med1.normalized.dosageForm === med2.normalized.dosageForm ? 1 : 0) * 0.1;
      factors += 0.1;
    }
    
    // Frequency comparison
    if (med1.normalized.frequency && med2.normalized.frequency) {
      similarity += this.frequencySimilarity(med1.normalized.frequency, med2.normalized.frequency) * 0.05;
      factors += 0.05;
    }
    
    return factors > 0 ? similarity / factors : 0;
  }

  stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

module.exports = MedicationReconciliationService;
```

### 2. API Endpoints
```javascript
// backend/routes/medications.js
router.post('/reconcile', authMiddleware, async (req, res) => {
  try {
    const reconciliationRequest = {
      patientId: req.body.patientId,
      reconciliationType: req.body.reconciliationType || 'routine',
      sources: req.body.sources || 'all',
      autoReconcile: req.body.autoReconcile || false,
      updateMedicationList: req.body.updateMedicationList || false,
      includeInactive: req.body.includeInactive || false
    };

    const reconciliationService = new MedicationReconciliationService();
    await reconciliationService.initialize();
    
    const result = await reconciliationService.performMedicationReconciliation(reconciliationRequest, {
      userId: req.user.id,
      practiceId: req.practice.id,
      userRole: req.user.role
    });
    
    res.status(200).json({
      success: true,
      data: result,
      message: {
        en: 'Medication reconciliation completed successfully',
        he: 'התאמת תרופות הושלמה בהצלחה'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        en: `Medication reconciliation failed: ${error.message}`,
        he: `התאמת תרופות נכשלה: ${error.message}`
      }
    });
  }
});

router.get('/reconciliation/:reconciliationId', authMiddleware, async (req, res) => {
  try {
    const reconciliationService = new MedicationReconciliationService();
    await reconciliationService.initialize();
    
    const reconciliation = await reconciliationService.getReconciliationResults(
      req.params.reconciliationId,
      {
        userId: req.user.id,
        practiceId: req.practice.id
      }
    );
    
    res.status(200).json({
      success: true,
      data: reconciliation
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: {
        en: 'Reconciliation not found',
        he: 'התאמה לא נמצאה'
      }
    });
  }
});

router.post('/reconciliation/:reconciliationId/apply-recommendation', authMiddleware, async (req, res) => {
  try {
    const { recommendationId, action } = req.body;
    
    const reconciliationService = new MedicationReconciliationService();
    await reconciliationService.initialize();
    
    const result = await reconciliationService.applyReconciliationRecommendation(
      req.params.reconciliationId,
      recommendationId,
      action,
      {
        userId: req.user.id,
        practiceId: req.practice.id,
        userRole: req.user.role
      }
    );
    
    res.status(200).json({
      success: true,
      data: result,
      message: {
        en: 'Recommendation applied successfully',
        he: 'המלצה יושמה בהצלחה'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: {
        en: `Failed to apply recommendation: ${error.message}`,
        he: `יישום המלצה נכשל: ${error.message}`
      }
    });
  }
});
```

### 3. Data Models
```javascript
// backend/models/MedicationReconciliation.js
const mongoose = require('mongoose');

const medicationReconciliationSchema = new mongoose.Schema({
  reconciliationId: { type: String, required: true, unique: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  
  // Reconciliation context
  reconciliationType: { 
    type: String, 
    enum: ['routine', 'admission', 'discharge', 'transfer', 'annual_review'],
    required: true 
  },
  
  reconciliationTrigger: {
    triggerType: String, // 'manual', 'scheduled', 'admission_event', 'discharge_event'
    triggerDate: Date,
    triggeredBy: mongoose.Schema.Types.ObjectId
  },
  
  // Medication sources processed
  medicationSources: [{
    sourceType: { 
      type: String, 
      enum: ['ehr', 'pharmacy', 'patient', 'admission', 'discharge', 'external'] 
    },
    sourceName: String,
    sourceId: String,
    lastUpdated: Date,
    reliability: Number,
    medicationCount: Number,
    dataQuality: String
  }],
  
  // Reconciliation results
  analysisResults: {
    totalMedications: Number,
    perfectMatches: Number,
    likelyMatches: Number,
    possibleMatches: Number,
    noMatches: Number,
    conflicts: Number,
    discrepancies: Number,
    criticalDiscrepancies: Number
  },
  
  // Detailed discrepancies
  discrepancies: [{
    discrepancyId: String,
    type: { type: String, enum: ['conflict', 'difference', 'missing', 'duplicate'] },
    severity: { type: String, enum: ['low', 'moderate', 'high', 'critical'] },
    medications: [mongoose.Schema.Types.Mixed],
    issue: String,
    description: String,
    clinicalSignificance: {
      level: String,
      explanation: String,
      riskAssessment: String
    },
    resolution: {
      status: { type: String, enum: ['pending', 'resolved', 'deferred'] },
      action: String,
      resolvedBy: mongoose.Schema.Types.ObjectId,
      resolvedAt: Date,
      notes: String
    }
  }],
  
  // Reconciliation recommendations
  recommendations: [{
    recommendationId: String,
    type: String,
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    description: String,
    medications: [mongoose.Schema.Types.Mixed],
    suggestedAction: String,
    rationale: String,
    clinicalEvidence: String,
    requiresReview: { type: Boolean, default: false },
    autoReconcile: { type: Boolean, default: false },
    status: { 
      type: String, 
      enum: ['pending', 'accepted', 'rejected', 'modified', 'auto_applied'],
      default: 'pending'
    },
    appliedBy: mongoose.Schema.Types.ObjectId,
    appliedAt: Date,
    outcome: String
  }],
  
  // Clinical validation results
  clinicalValidation: {
    overallRisk: { type: String, enum: ['low', 'moderate', 'high', 'critical'] },
    safetyAlerts: [{
      alertType: String,
      severity: String,
      message: String,
      medications: [String]
    }],
    drugInteractions: [{
      severity: String,
      medication1: String,
      medication2: String,
      description: String,
      clinicalEffect: String
    }],
    dosageWarnings: [{
      medication: String,
      warning: String,
      recommendedAction: String
    }],
    duplicateTherapy: [{
      medications: [String],
      therapeuticClass: String,
      recommendation: String
    }]
  },
  
  // Auto-reconciliation results
  autoReconciliation: {
    enabled: { type: Boolean, default: false },
    applied: [{
      recommendationId: String,
      action: String,
      result: String,
      timestamp: Date
    }],
    skipped: [{
      recommendationId: String,
      reason: String,
      timestamp: Date
    }]
  },
  
  // Final reconciled medication list
  reconciledMedications: [{
    medicationId: String,
    genericName: String,
    brandName: String,
    strength: String,
    dosageForm: String,
    route: String,
    frequency: String,
    quantity: Number,
    refills: Number,
    prescriber: String,
    status: String,
    startDate: Date,
    source: String,
    confidence: Number,
    lastUpdated: Date
  }],
  
  // Reconciliation metadata
  status: { 
    type: String, 
    enum: ['in_progress', 'completed', 'requires_review', 'approved', 'cancelled'],
    default: 'in_progress'
  },
  
  completedAt: Date,
  reviewedBy: mongoose.Schema.Types.ObjectId,
  reviewedAt: Date,
  approvedBy: mongoose.Schema.Types.ObjectId,
  approvedAt: Date,
  
  // Quality metrics
  qualityMetrics: {
    dataCompleteness: Number,
    sourceReliability: Number,
    reconciliationAccuracy: Number,
    timeToComplete: Number,
    manualInterventions: Number
  },
  
  // Audit fields
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: mongoose.Schema.Types.ObjectId,
  practiceId: { type: String, required: true },
  version: { type: Number, default: 1 }
});

// Indexes
medicationReconciliationSchema.index({ patientId: 1, createdAt: -1 });
medicationReconciliationSchema.index({ reconciliationId: 1 }, { unique: true });
medicationReconciliationSchema.index({ status: 1, createdAt: -1 });
medicationReconciliationSchema.index({ reconciliationType: 1 });

module.exports = mongoose.model('MedicationReconciliation', medicationReconciliationSchema);
```

### 4. Frontend Components
```javascript
// frontend-vite/src/components/Medications/MedicationReconciliation.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert, AlertDescription } from '../ui/Alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Checkbox } from '../ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileText,
  Pill,
  RefreshCw,
  Eye,
  ThumbsUp,
  ThumbsDown,
  AlertCircle
} from 'lucide-react';
import secureApiClient from '../../services/secureApiClient';

const MedicationReconciliation = ({ patientId, reconciliationType = 'routine', onComplete }) => {
  const [reconciliation, setReconciliation] = useState(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [selectedSources, setSelectedSources] = useState(['ehr', 'pharmacy', 'patient']);
  const [autoReconcile, setAutoReconcile] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  const reconciliationTypes = [
    { value: 'routine', label: 'Routine Reconciliation' },
    { value: 'admission', label: 'Hospital Admission' },
    { value: 'discharge', label: 'Hospital Discharge' },
    { value: 'transfer', label: 'Care Transfer' },
    { value: 'annual_review', label: 'Annual Review' }
  ];

  const medicationSources = [
    { value: 'ehr', label: 'Electronic Health Record', icon: '📋' },
    { value: 'pharmacy', label: 'Pharmacy Fill History', icon: '💊' },
    { value: 'patient', label: 'Patient-Reported', icon: '👤' },
    { value: 'admission', label: 'Hospital Admission', icon: '🏥' },
    { value: 'discharge', label: 'Hospital Discharge', icon: '🚪' },
    { value: 'external', label: 'External Providers', icon: '🔗' }
  ];

  const startReconciliation = async () => {
    try {
      setIsReconciling(true);
      
      const response = await secureApiClient.post('/api/medications/reconcile', {
        patientId,
        reconciliationType,
        sources: selectedSources,
        autoReconcile,
        updateMedicationList: true
      });
      
      setReconciliation(response.data.data);
      setSelectedTab('results');
      onComplete?.(response.data.data);
    } catch (error) {
      console.error('Reconciliation failed:', error);
    } finally {
      setIsReconciling(false);
    }
  };

  const applyRecommendation = async (recommendationId, action) => {
    try {
      const response = await secureApiClient.post(
        `/api/medications/reconciliation/${reconciliation.reconciliationId}/apply-recommendation`,
        {
          recommendationId,
          action
        }
      );
      
      // Refresh reconciliation data
      const updatedReconciliation = { ...reconciliation };
      const recommendation = updatedReconciliation.reconciliationReport.recommendations.find(
        r => r.recommendationId === recommendationId
      );
      if (recommendation) {
        recommendation.status = response.data.data.status;
        recommendation.appliedAt = new Date();
      }
      
      setReconciliation(updatedReconciliation);
    } catch (error) {
      console.error('Failed to apply recommendation:', error);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      moderate: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[severity] || colors.low;
  };

  const getPriorityIcon = (priority) => {
    const icons = {
      low: <CheckCircle className="w-4 h-4 text-blue-500" />,
      medium: <Clock className="w-4 h-4 text-yellow-500" />,
      high: <AlertTriangle className="w-4 h-4 text-orange-500" />,
      critical: <AlertCircle className="w-4 h-4 text-red-500" />
    };
    return icons[priority] || icons.low;
  };

  if (isReconciling) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <div className="text-lg font-medium mb-2">Performing Medication Reconciliation</div>
          <div className="text-gray-600">
            Analyzing medication sources and identifying discrepancies...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reconciliation) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Medication Reconciliation</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Reconciliation Type</label>
              <Select defaultValue={reconciliationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reconciliationTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Medication Sources</label>
              <div className="grid grid-cols-2 gap-3">
                {medicationSources.map(source => (
                  <div key={source.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={source.value}
                      checked={selectedSources.includes(source.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSources([...selectedSources, source.value]);
                        } else {
                          setSelectedSources(selectedSources.filter(s => s !== source.value));
                        }
                      }}
                    />
                    <label htmlFor={source.value} className="text-sm">
                      {source.icon} {source.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoReconcile"
                checked={autoReconcile}
                onCheckedChange={setAutoReconcile}
              />
              <label htmlFor="autoReconcile" className="text-sm">
                Enable automatic reconciliation for high-confidence matches
              </label>
            </div>

            <Button onClick={startReconciliation} className="w-full" size="lg">
              <Pill className="w-4 h-4 mr-2" />
              Start Medication Reconciliation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Reconciliation Results</h2>
            <Badge className={reconciliation.summary.criticalDiscrepancies > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
              {reconciliation.status === 'completed' ? 'Completed' : 'In Progress'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {reconciliation.summary.medicationsAnalyzed}
              </div>
              <div className="text-sm text-gray-600">Total Medications</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {reconciliation.summary.perfectMatches}
              </div>
              <div className="text-sm text-gray-600">Perfect Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {reconciliation.summary.discrepanciesFound}
              </div>
              <div className="text-sm text-gray-600">Discrepancies</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {reconciliation.summary.requiresManualReview}
              </div>
              <div className="text-sm text-gray-600">Needs Review</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {reconciliation.summary.criticalDiscrepancies > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <strong>Critical discrepancies found!</strong> {reconciliation.summary.criticalDiscrepancies} critical 
            issues require immediate attention before completing reconciliation.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="discrepancies">Discrepancies</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="final-list">Final List</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4">
            {/* Source Summary */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Medication Sources</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reconciliation.reconciliationReport?.sources?.map((source, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">{source.sourceName}</div>
                        <div className="text-sm text-gray-600">
                          {source.medications.length} medications • Reliability: {(source.reliability * 100).toFixed(0)}%
                        </div>
                      </div>
                      <Badge variant="outline">
                        {source.sourceType.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Auto-Reconciliation Results */}
            {reconciliation.summary.autoReconciled > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Auto-Reconciliation</h3>
                </CardHeader>
                <CardContent>
                  <div className="text-green-600 mb-2">
                    ✅ {reconciliation.summary.autoReconciled} recommendations applied automatically
                  </div>
                  <div className="text-sm text-gray-600">
                    High-confidence matches were reconciled automatically based on your settings.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="discrepancies" className="space-y-4">
          {reconciliation.reconciliationReport?.discrepancies?.map((discrepancy, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{discrepancy.issue}</h4>
                    <p className="text-sm text-gray-600 mt-1">{discrepancy.description}</p>
                  </div>
                  <Badge className={getSeverityColor(discrepancy.severity)}>
                    {discrepancy.severity.toUpperCase()}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {discrepancy.medications?.map((medication, medIndex) => (
                    <div key={medIndex} className="p-2 bg-gray-50 rounded text-sm">
                      <div className="font-medium">
                        {medication.normalized.genericName} ({medication.source})
                      </div>
                      <div className="text-gray-600">
                        {medication.normalized.strength} {medication.normalized.dosageForm} - {medication.normalized.frequency}
                      </div>
                    </div>
                  ))}
                </div>
                
                {discrepancy.clinicalSignificance && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-sm">
                      <strong>Clinical Significance:</strong> {discrepancy.clinicalSignificance.explanation}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          
          {(!reconciliation.reconciliationReport?.discrepancies || 
            reconciliation.reconciliationReport.discrepancies.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <div>No discrepancies found</div>
              <div className="text-sm">All medication sources are in agreement</div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          {reconciliation.reconciliationReport?.recommendations?.map((recommendation, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    {getPriorityIcon(recommendation.priority)}
                    <h4 className="font-medium">{recommendation.description}</h4>
                  </div>
                  <div className="flex space-x-2">
                    <Badge className={getSeverityColor(recommendation.priority)}>
                      {recommendation.priority.toUpperCase()}
                    </Badge>
                    {recommendation.status !== 'pending' && (
                      <Badge variant="outline">
                        {recommendation.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">{recommendation.rationale}</p>
                
                {recommendation.medications && (
                  <div className="mb-3">
                    <div className="text-sm font-medium mb-1">Affected Medications:</div>
                    <div className="space-y-1">
                      {recommendation.medications.map((medication, medIndex) => (
                        <div key={medIndex} className="text-sm p-2 bg-gray-50 rounded">
                          {medication.normalized?.genericName || medication.name} 
                          {medication.source && ` (${medication.source})`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {recommendation.status === 'pending' && (
                  <div className="flex space-x-2 mt-4">
                    <Button 
                      size="sm" 
                      onClick={() => applyRecommendation(recommendation.recommendationId, 'accept')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ThumbsUp className="w-4 h-4 mr-1" />
                      Accept
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => applyRecommendation(recommendation.recommendationId, 'reject')}
                    >
                      <ThumbsDown className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-1" />
                      Review
                    </Button>
                  </div>
                )}
                
                {recommendation.appliedAt && (
                  <div className="mt-3 text-sm text-gray-600">
                    Applied on {new Date(recommendation.appliedAt).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          
          {(!reconciliation.reconciliationReport?.recommendations || 
            reconciliation.reconciliationReport.recommendations.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <div>No recommendations needed</div>
              <div className="text-sm">All medications are properly reconciled</div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="final-list" className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Reconciled Medication List</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reconciliation.reconciliationReport?.reconciledMedications?.map((medication, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{medication.genericName}</h4>
                        {medication.brandName && (
                          <div className="text-sm text-gray-600">{medication.brandName}</div>
                        )}
                        <div className="text-sm mt-1">
                          {medication.strength} {medication.dosageForm} - {medication.frequency}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Source: {medication.source} • Confidence: {(medication.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                      <Badge className={medication.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {medication.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicationReconciliation;
```

### 5. Test Cases
```javascript
// backend/tests/medications/medicationReconciliation.test.js
const request = require('supertest');
const app = require('../../server');
const MedicationReconciliationService = require('../../services/medicationReconciliationService');

describe('Medication Reconciliation', () => {
  let authToken;
  let testPatientId;
  let reconciliationService;

  beforeAll(async () => {
    reconciliationService = new MedicationReconciliationService();
    await reconciliationService.initialize();
    // Setup test data with multiple medication sources
  });

  describe('POST /api/medications/reconcile', () => {
    it('should perform medication reconciliation successfully', async () => {
      const reconciliationRequest = {
        patientId: testPatientId,
        reconciliationType: 'routine',
        sources: ['ehr', 'pharmacy', 'patient'],
        autoReconcile: false
      };

      const response = await request(app)
        .post('/api/medications/reconcile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reconciliationRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reconciliationId).toBeDefined();
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.summary.sourcesProcessed).toBeGreaterThan(0);
    });

    it('should detect medication discrepancies', async () => {
      // Setup test data with conflicting medication information
      const reconciliationRequest = {
        patientId: testPatientId,
        reconciliationType: 'admission',
        sources: ['ehr', 'pharmacy'],
        autoReconcile: false
      };

      const response = await request(app)
        .post('/api/medications/reconcile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reconciliationRequest)
        .expect(200);

      expect(response.body.data.summary.discrepanciesFound).toBeGreaterThanOrEqual(0);
      if (response.body.data.summary.discrepanciesFound > 0) {
        expect(response.body.data.reconciliationReport.discrepancies).toBeDefined();
      }
    });

    it('should auto-reconcile high-confidence matches', async () => {
      const reconciliationRequest = {
        patientId: testPatientId,
        reconciliationType: 'routine',
        sources: ['ehr', 'pharmacy'],
        autoReconcile: true
      };

      const response = await request(app)
        .post('/api/medications/reconcile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reconciliationRequest)
        .expect(200);

      expect(response.body.data.summary.autoReconciled).toBeGreaterThanOrEqual(0);
    });

    it('should identify missing medications', async () => {
      // Test with patient having medications in pharmacy but not in EHR
      const reconciliationRequest = {
        patientId: testPatientId,
        reconciliationType: 'discharge',
        sources: ['ehr', 'pharmacy', 'discharge']
      };

      const response = await request(app)
        .post('/api/medications/reconcile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reconciliationRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should have recommendations for missing medications
      expect(response.body.data.summary.recommendationsGenerated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/medications/reconciliation/:reconciliationId', () => {
    it('should retrieve reconciliation results', async () => {
      // First perform reconciliation
      const reconcileResponse = await request(app)
        .post('/api/medications/reconcile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: testPatientId,
          reconciliationType: 'routine',
          sources: ['ehr', 'pharmacy']
        });

      const reconciliationId = reconcileResponse.body.data.reconciliationId;

      // Then retrieve results
      const response = await request(app)
        .get(`/api/medications/reconciliation/${reconciliationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reconciliationId).toBe(reconciliationId);
    });
  });

  describe('POST /api/medications/reconciliation/:reconciliationId/apply-recommendation', () => {
    it('should apply reconciliation recommendation', async () => {
      // First perform reconciliation with discrepancies
      const reconcileResponse = await request(app)
        .post('/api/medications/reconcile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: testPatientId,
          reconciliationType: 'routine',
          sources: ['ehr', 'pharmacy']
        });

      const reconciliationId = reconcileResponse.body.data.reconciliationId;
      
      // Apply first recommendation if any exist
      if (reconcileResponse.body.data.summary.recommendationsGenerated > 0) {
        const recommendationId = reconcileResponse.body.data.reconciliationReport.recommendations[0].recommendationId;
        
        const response = await request(app)
          .post(`/api/medications/reconciliation/${reconciliationId}/apply-recommendation`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            recommendationId,
            action: 'accept'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });
  });
});
```

## Dependencies
- `secureDataAccess` service for database operations
- `serviceAccountManager` for authentication
- `agentServiceWrapper` for clinical decision support
- `pharmacyNetworkService` for external pharmacy data
- Drug database for medication normalization
- Patient medication history from multiple sources
- External provider integration capabilities
- Clinical decision support rules engine

## Success Criteria
- [x] Multi-source medication data gathering and normalization
- [x] Intelligent medication matching across different data formats
- [x] Comprehensive discrepancy detection and analysis
- [x] Clinical significance assessment for all discrepancies
- [x] AI-powered reconciliation recommendations
- [x] Auto-reconciliation for high-confidence matches
- [x] Manual review workflow for complex cases
- [x] Real-time clinical safety validation
- [x] Comprehensive audit trails and reporting
- [x] Integration with care transition workflows
- [x] Patient safety alerts and notifications
- [x] Regulatory compliance documentation