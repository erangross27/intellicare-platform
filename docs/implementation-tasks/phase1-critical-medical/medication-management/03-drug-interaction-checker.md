# Drug Interaction Checker

## Function Details
**Function Name**: checkDrugInteractions  
**Location**: backend/services/medicationSafetyService.js  
**Status**: Not Implemented  
**Priority**: Critical (P1)  
**Complexity**: High  
**Estimated Time**: 8-12 hours  

## Problem Description
Real-time drug interaction detection and severity assessment with clinical decision support, contraindication alerts, and automated safety screening for all prescribed medications.

## Implementation Steps

### 1. Core Service Implementation

```javascript
// backend/services/medicationSafetyService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const interactionDatabase = require('./drugInteractionDatabase');
const clinicalDecisionSupport = require('./clinicalDecisionSupport');

class MedicationSafetyService {
  constructor() {
    this.serviceToken = null;
    this.interactionDatabase = null;
    this.severityMatrix = new Map();
    this.clinicalRules = null;
    this.alertThresholds = null;
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('medication-safety-service');
    this.interactionDatabase = await interactionDatabase.initialize();
    await this.loadSeverityMatrix();
    await this.loadClinicalRules();
    await this.loadAlertThresholds();
  }

  async checkDrugInteractions(interactionRequest, context) {
    try {
      await this.validateInteractionRequest(interactionRequest, context);
      
      const patientMedications = await this.getCurrentMedications(
        interactionRequest.patientId, 
        context
      );
      
      const newMedications = this.normalizeMedications(interactionRequest.medications);
      const allMedications = [...patientMedications, ...newMedications];
      
      const interactionAnalysis = await this.performInteractionAnalysis(
        allMedications, 
        context
      );
      
      const severityAssessment = await this.assessInteractionSeverity(
        interactionAnalysis,
        interactionRequest.patientId,
        context
      );
      
      const clinicalRecommendations = await this.generateClinicalRecommendations(
        severityAssessment,
        interactionRequest.prescriberId,
        context
      );
      
      const alertConfiguration = await this.configureAlerts(
        clinicalRecommendations,
        interactionRequest.alertLevel || 'standard',
        context
      );
      
      const interactionReport = await this.generateInteractionReport(
        interactionAnalysis,
        severityAssessment,
        clinicalRecommendations,
        alertConfiguration,
        context
      );
      
      await this.auditInteractionCheck(interactionRequest, interactionReport, context);
      
      return {
        interactionId: interactionReport.id,
        status: 'completed',
        summary: {
          totalInteractions: interactionReport.interactions.length,
          criticalInteractions: interactionReport.interactions.filter(i => i.severity === 'critical').length,
          majorInteractions: interactionReport.interactions.filter(i => i.severity === 'major').length,
          moderateInteractions: interactionReport.interactions.filter(i => i.severity === 'moderate').length,
          minorInteractions: interactionReport.interactions.filter(i => i.severity === 'minor').length,
          recommendedActions: interactionReport.recommendations.length,
          alertsGenerated: interactionReport.alerts.length,
          processingTime: interactionReport.processingTime
        },
        interactions: interactionReport.interactions,
        recommendations: interactionReport.recommendations,
        alerts: interactionReport.alerts,
        metadata: interactionReport.metadata
      };
      
    } catch (error) {
      await this.handleInteractionError(error, interactionRequest, context);
      throw error;
    }
  }

  async validateInteractionRequest(request, context) {
    if (!request.patientId || !request.medications || !Array.isArray(request.medications)) {
      throw new Error('Invalid interaction request structure');
    }
    
    if (!request.prescriberId) {
      throw new Error('Prescriber ID is required for drug interaction checking');
    }
    
    // Validate medications format
    for (const medication of request.medications) {
      if (!medication.drugCode && !medication.drugName) {
        throw new Error('Each medication must have either drugCode or drugName');
      }
    }
  }

  async getCurrentMedications(patientId, context) {
    const activePrescriptions = await SecureDataAccess.query(
      'prescriptions',
      {
        patientId: patientId,
        status: { $in: ['active', 'pending'] },
        endDate: { $gte: new Date() }
      },
      { sort: { createdAt: -1 } },
      context
    );
    
    return activePrescriptions.map(prescription => ({
      prescriptionId: prescription._id,
      drugCode: prescription.medication.rxcui,
      drugName: prescription.medication.name,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      route: prescription.route,
      startDate: prescription.startDate,
      endDate: prescription.endDate,
      prescriberId: prescription.prescriberId
    }));
  }

  normalizeMedications(medications) {
    return medications.map(medication => ({
      drugCode: medication.drugCode || null,
      drugName: medication.drugName,
      dosage: medication.dosage,
      frequency: medication.frequency,
      route: medication.route || 'oral',
      isNewPrescription: true
    }));
  }

  async performInteractionAnalysis(medications, context) {
    const interactions = [];
    
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const drug1 = medications[i];
        const drug2 = medications[j];
        
        const interaction = await this.checkDrugPairInteraction(drug1, drug2, context);
        if (interaction) {
          interactions.push({
            drug1: drug1,
            drug2: drug2,
            interactionType: interaction.type,
            mechanism: interaction.mechanism,
            effect: interaction.effect,
            severity: interaction.severity,
            evidence: interaction.evidence,
            references: interaction.references,
            recommendations: interaction.recommendations
          });
        }
      }
    }
    
    // Check for drug-class interactions
    const classInteractions = await this.checkDrugClassInteractions(medications, context);
    interactions.push(...classInteractions);
    
    // Check for duplicate therapy
    const duplicateTherapy = await this.checkDuplicateTherapy(medications, context);
    interactions.push(...duplicateTherapy);
    
    return interactions;
  }

  async checkDrugPairInteraction(drug1, drug2, context) {
    // Primary check using RxNorm codes
    if (drug1.drugCode && drug2.drugCode) {
      const codeInteraction = await this.interactionDatabase.checkByRxCUI(
        drug1.drugCode, 
        drug2.drugCode
      );
      if (codeInteraction) return codeInteraction;
    }
    
    // Fallback to ingredient-based checking
    const ingredients1 = await this.getActiveIngredients(drug1, context);
    const ingredients2 = await this.getActiveIngredients(drug2, context);
    
    for (const ingredient1 of ingredients1) {
      for (const ingredient2 of ingredients2) {
        const ingredientInteraction = await this.interactionDatabase.checkByIngredients(
          ingredient1, 
          ingredient2
        );
        if (ingredientInteraction) return ingredientInteraction;
      }
    }
    
    return null;
  }

  async assessInteractionSeverity(interactions, patientId, context) {
    const patientFactors = await this.getPatientRiskFactors(patientId, context);
    
    return interactions.map(interaction => {
      let adjustedSeverity = interaction.severity;
      
      // Adjust severity based on patient factors
      if (patientFactors.age >= 65 && interaction.geriatricRisk) {
        adjustedSeverity = this.increaseSeverity(adjustedSeverity);
      }
      
      if (patientFactors.renalImpairment && interaction.renalClearanceAffected) {
        adjustedSeverity = this.increaseSeverity(adjustedSeverity);
      }
      
      if (patientFactors.hepaticImpairment && interaction.hepaticMetabolismAffected) {
        adjustedSeverity = this.increaseSeverity(adjustedSeverity);
      }
      
      if (patientFactors.allergies.some(allergy => 
        interaction.drug1.drugName.includes(allergy) || 
        interaction.drug2.drugName.includes(allergy)
      )) {
        adjustedSeverity = 'critical';
      }
      
      return {
        ...interaction,
        originalSeverity: interaction.severity,
        adjustedSeverity: adjustedSeverity,
        riskFactors: patientFactors,
        clinicalSignificance: this.assessClinicalSignificance(interaction, patientFactors)
      };
    });
  }

  async generateClinicalRecommendations(severityAssessment, prescriberId, context) {
    const recommendations = [];
    
    for (const interaction of severityAssessment) {
      if (interaction.adjustedSeverity === 'critical') {
        recommendations.push({
          interactionId: interaction.id,
          type: 'contraindication',
          priority: 'immediate',
          action: 'Do not prescribe - absolute contraindication',
          alternatives: await this.findAlternativeMedications(interaction, context),
          rationale: interaction.mechanism,
          evidenceLevel: interaction.evidence
        });
      } else if (interaction.adjustedSeverity === 'major') {
        recommendations.push({
          interactionId: interaction.id,
          type: 'warning',
          priority: 'high',
          action: 'Consider alternative or monitor closely',
          monitoring: await this.getMonitoringRequirements(interaction, context),
          alternatives: await this.findAlternativeMedications(interaction, context),
          rationale: interaction.mechanism,
          evidenceLevel: interaction.evidence
        });
      } else if (interaction.adjustedSeverity === 'moderate') {
        recommendations.push({
          interactionId: interaction.id,
          type: 'caution',
          priority: 'medium',
          action: 'Monitor for adverse effects',
          monitoring: await this.getMonitoringRequirements(interaction, context),
          patientEducation: await this.getPatientEducation(interaction, context),
          rationale: interaction.mechanism,
          evidenceLevel: interaction.evidence
        });
      }
    }
    
    return recommendations;
  }

  async configureAlerts(recommendations, alertLevel, context) {
    const alerts = [];
    
    const alertSettings = {
      minimal: { critical: true, major: false, moderate: false },
      standard: { critical: true, major: true, moderate: false },
      comprehensive: { critical: true, major: true, moderate: true }
    };
    
    const settings = alertSettings[alertLevel] || alertSettings.standard;
    
    for (const recommendation of recommendations) {
      let shouldAlert = false;
      
      if (recommendation.type === 'contraindication' && settings.critical) {
        shouldAlert = true;
      } else if (recommendation.type === 'warning' && settings.major) {
        shouldAlert = true;
      } else if (recommendation.type === 'caution' && settings.moderate) {
        shouldAlert = true;
      }
      
      if (shouldAlert) {
        alerts.push({
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: recommendation.type,
          severity: recommendation.priority,
          title: this.generateAlertTitle(recommendation),
          message: this.generateAlertMessage(recommendation),
          action: recommendation.action,
          dismissible: recommendation.type !== 'contraindication',
          timestamp: new Date(),
          interactionId: recommendation.interactionId
        });
      }
    }
    
    return alerts;
  }

  async generateInteractionReport(analysis, assessment, recommendations, alerts, context) {
    const reportId = `interaction_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const report = {
      id: reportId,
      timestamp: new Date(),
      interactions: assessment,
      recommendations: recommendations,
      alerts: alerts,
      summary: {
        totalInteractions: assessment.length,
        severityBreakdown: this.calculateSeverityBreakdown(assessment),
        riskLevel: this.calculateOverallRiskLevel(assessment),
        actionRequired: recommendations.filter(r => r.type === 'contraindication').length > 0
      },
      metadata: {
        databaseVersion: await this.interactionDatabase.getVersion(),
        algorithmVersion: '2.1.0',
        processingTime: new Date() - context.startTime || 0
      }
    };
    
    // Store report for audit trail
    await SecureDataAccess.create(
      'drug_interaction_reports',
      {
        ...report,
        patientId: context.patientId,
        prescriberId: context.prescriberId,
        practiceId: context.practiceId
      },
      context
    );
    
    return report;
  }

  async auditInteractionCheck(request, report, context) {
    await AuditLog.create({
      action: 'DRUG_INTERACTION_CHECK',
      entityType: 'medication_safety',
      entityId: report.id,
      patientId: request.patientId,
      userId: request.prescriberId,
      practiceId: context.practiceId,
      details: {
        medicationsChecked: request.medications.length,
        interactionsFound: report.interactions.length,
        criticalInteractions: report.interactions.filter(i => i.adjustedSeverity === 'critical').length,
        alertsGenerated: report.alerts.length,
        processingTime: report.metadata.processingTime
      },
      timestamp: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }
}

module.exports = new MedicationSafetyService();
```

### 2. Drug Interaction Database Service

```javascript
// backend/services/drugInteractionDatabase.js
const fs = require('fs').promises;
const path = require('path');
const SecureDataAccess = require('./secureDataAccess');

class DrugInteractionDatabase {
  constructor() {
    this.interactions = new Map();
    this.ingredients = new Map();
    this.drugClasses = new Map();
    this.version = null;
  }

  async initialize() {
    await this.loadInteractionData();
    await this.loadIngredientMapping();
    await this.loadDrugClassification();
    await this.buildIndexes();
  }

  async loadInteractionData() {
    // Load from multiple sources
    const sources = [
      'rxnorm-interactions.json',
      'fda-drug-interactions.json',
      'clinical-pharmacology.json'
    ];
    
    for (const source of sources) {
      const filePath = path.join(__dirname, '../data/drug-interactions', source);
      try {
        const data = await fs.readFile(filePath, 'utf8');
        const interactions = JSON.parse(data);
        this.mergeInteractionData(interactions);
      } catch (error) {
        console.error(`Error loading ${source}:`, error.message);
      }
    }
  }

  async checkByRxCUI(rxcui1, rxcui2) {
    const key1 = `${rxcui1}-${rxcui2}`;
    const key2 = `${rxcui2}-${rxcui1}`;
    
    return this.interactions.get(key1) || this.interactions.get(key2);
  }

  async checkByIngredients(ingredient1, ingredient2) {
    const interactions = [];
    
    // Check direct ingredient interactions
    const directInteraction = await this.checkDirectIngredientInteraction(
      ingredient1, 
      ingredient2
    );
    if (directInteraction) interactions.push(directInteraction);
    
    // Check class-based interactions
    const classInteraction = await this.checkIngredientClassInteraction(
      ingredient1, 
      ingredient2
    );
    if (classInteraction) interactions.push(classInteraction);
    
    return interactions.length > 0 ? interactions[0] : null;
  }

  mergeInteractionData(newData) {
    for (const interaction of newData.interactions) {
      const key = `${interaction.drug1.rxcui}-${interaction.drug2.rxcui}`;
      
      if (this.interactions.has(key)) {
        // Merge with existing data, prioritizing higher evidence levels
        const existing = this.interactions.get(key);
        const merged = this.mergeSingleInteraction(existing, interaction);
        this.interactions.set(key, merged);
      } else {
        this.interactions.set(key, interaction);
      }
    }
  }

  mergeSingleInteraction(existing, newData) {
    const evidenceLevels = { 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
    const severityLevels = { 'critical': 4, 'major': 3, 'moderate': 2, 'minor': 1 };
    
    return {
      ...existing,
      severity: severityLevels[newData.severity] > severityLevels[existing.severity] 
        ? newData.severity : existing.severity,
      evidence: evidenceLevels[newData.evidence] > evidenceLevels[existing.evidence]
        ? newData.evidence : existing.evidence,
      references: [...existing.references, ...newData.references].filter((ref, index, arr) => 
        arr.findIndex(r => r.pmid === ref.pmid) === index
      ),
      mechanisms: [...existing.mechanisms, ...newData.mechanisms].filter((mech, index, arr) => 
        arr.indexOf(mech) === index
      )
    };
  }

  async getVersion() {
    return this.version || '1.0.0';
  }
}

module.exports = DrugInteractionDatabase;
```

### 3. API Endpoints

```javascript
// backend/routes/medication-safety.js
const express = require('express');
const router = express.Router();
const medicationSafetyService = require('../services/medicationSafetyService');
const authMiddleware = require('../middleware/auth');
const auditMiddleware = require('../middleware/audit');

router.post('/check-interactions', 
  authMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const interactionRequest = {
        patientId: req.body.patientId,
        medications: req.body.medications,
        prescriberId: req.user.id,
        alertLevel: req.body.alertLevel || 'standard'
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        startTime: new Date()
      };

      const result = await medicationSafetyService.checkDrugInteractions(
        interactionRequest, 
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Drug interaction check completed successfully',
          he: 'בדיקת אינטראקציות תרופתיות הושלמה בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Drug interaction check failed',
          he: 'בדיקת אינטראקציות תרופתיות נכשלה'
        }
      });
    }
  }
);

router.get('/interaction-history/:patientId',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const history = await SecureDataAccess.query(
        'drug_interaction_reports',
        { patientId: req.params.patientId },
        { sort: { timestamp: -1 }, limit: 50 },
        context
      );

      res.json({
        success: true,
        data: history,
        message: {
          en: 'Interaction history retrieved successfully',
          he: 'היסטוריית אינטראקציות נשלפה בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve interaction history',
          he: 'נכשל בשליפת היסטוריית אינטראקציות'
        }
      });
    }
  }
);

module.exports = router;
```

### 4. Data Models

```javascript
// backend/models/DrugInteractionReport.js
const mongoose = require('mongoose');

const DrugInteractionReportSchema = new mongoose.Schema({
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
  interactions: [{
    id: String,
    drug1: {
      drugCode: String,
      drugName: String,
      dosage: String,
      frequency: String
    },
    drug2: {
      drugCode: String,
      drugName: String,
      dosage: String,
      frequency: String
    },
    interactionType: {
      type: String,
      enum: ['pharmacokinetic', 'pharmacodynamic', 'contraindication', 'duplicate_therapy']
    },
    severity: {
      type: String,
      enum: ['critical', 'major', 'moderate', 'minor']
    },
    adjustedSeverity: {
      type: String,
      enum: ['critical', 'major', 'moderate', 'minor']
    },
    mechanism: String,
    effect: String,
    evidence: {
      type: String,
      enum: ['A', 'B', 'C', 'D']
    },
    clinicalSignificance: String,
    references: [String]
  }],
  recommendations: [{
    interactionId: String,
    type: {
      type: String,
      enum: ['contraindication', 'warning', 'caution']
    },
    priority: {
      type: String,
      enum: ['immediate', 'high', 'medium', 'low']
    },
    action: String,
    alternatives: [String],
    monitoring: [String],
    patientEducation: String,
    rationale: String,
    evidenceLevel: String
  }],
  alerts: [{
    id: String,
    type: String,
    severity: String,
    title: String,
    message: String,
    action: String,
    dismissible: Boolean,
    timestamp: Date,
    interactionId: String
  }],
  summary: {
    totalInteractions: Number,
    severityBreakdown: {
      critical: Number,
      major: Number,
      moderate: Number,
      minor: Number
    },
    riskLevel: {
      type: String,
      enum: ['low', 'moderate', 'high', 'critical']
    },
    actionRequired: Boolean
  },
  metadata: {
    databaseVersion: String,
    algorithmVersion: String,
    processingTime: Number
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for performance
DrugInteractionReportSchema.index({ patientId: 1, timestamp: -1 });
DrugInteractionReportSchema.index({ prescriberId: 1, timestamp: -1 });
DrugInteractionReportSchema.index({ practiceId: 1, timestamp: -1 });
DrugInteractionReportSchema.index({ 'summary.riskLevel': 1 });

module.exports = mongoose.model('DrugInteractionReport', DrugInteractionReportSchema);
```

### 5. Frontend Components

```jsx
// frontend-vite/src/components/medication/DrugInteractionChecker.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import secureApiClient from '@/services/secureApiClient';
import { useTranslation } from '@/hooks/useTranslation';

const DrugInteractionChecker = ({ patientId, medications, onInteractionResult }) => {
  const { t } = useTranslation();
  const [isChecking, setIsChecking] = useState(false);
  const [interactions, setInteractions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [alertLevel, setAlertLevel] = useState('standard');

  const checkInteractions = async () => {
    if (!medications || medications.length === 0) return;

    setIsChecking(true);
    try {
      const response = await secureApiClient.post('/api/medication-safety/check-interactions', {
        patientId,
        medications,
        alertLevel
      });

      if (response.data.success) {
        setInteractions(response.data.data.interactions);
        setAlerts(response.data.data.alerts);
        setRecommendations(response.data.data.recommendations);
        
        if (onInteractionResult) {
          onInteractionResult(response.data.data);
        }
      }
    } catch (error) {
      console.error('Error checking drug interactions:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (medications && medications.length > 1) {
      checkInteractions();
    }
  }, [medications, alertLevel]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'major': return 'warning';
      case 'moderate': return 'default';
      case 'minor': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'major': return <AlertTriangle className="h-4 w-4" />;
      case 'moderate': return <Info className="h-4 w-4" />;
      case 'minor': return <Info className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const dismissAlert = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t({
                en: 'Drug Interaction Checker',
                he: 'בודק אינטראקציות תרופתיות'
              })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={alertLevel}
                onChange={(e) => setAlertLevel(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="minimal">{t({ en: 'Critical Only', he: 'קריטי בלבד' })}</option>
                <option value="standard">{t({ en: 'Standard', he: 'רגיל' })}</option>
                <option value="comprehensive">{t({ en: 'Comprehensive', he: 'מקיף' })}</option>
              </select>
              <Button
                onClick={checkInteractions}
                disabled={isChecking || !medications?.length}
                size="sm"
              >
                {isChecking ? t({ en: 'Checking...', he: 'בודק...' }) : t({ en: 'Check', he: 'בדוק' })}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Active Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2 mb-4">
              <h4 className="font-semibold text-sm">
                {t({ en: 'Active Alerts', he: 'התראות פעילות' })}
              </h4>
              {alerts.map((alert) => (
                <Alert key={alert.id} variant={getSeverityColor(alert.severity)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {getSeverityIcon(alert.severity)}
                      <div>
                        <AlertDescription className="font-semibold">
                          {alert.title}
                        </AlertDescription>
                        <AlertDescription className="text-sm mt-1">
                          {alert.message}
                        </AlertDescription>
                        {alert.action && (
                          <AlertDescription className="text-sm mt-2 font-medium">
                            {t({ en: 'Recommended Action:', he: 'פעולה מומלצת:' })} {alert.action}
                          </AlertDescription>
                        )}
                      </div>
                    </div>
                    {alert.dismissible && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissAlert(alert.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Alert>
              ))}
            </div>
          )}

          {/* Interaction Summary */}
          {interactions.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {interactions.filter(i => i.adjustedSeverity === 'critical').length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t({ en: 'Critical', he: 'קריטי' })}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {interactions.filter(i => i.adjustedSeverity === 'major').length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t({ en: 'Major', he: 'חמור' })}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {interactions.filter(i => i.adjustedSeverity === 'moderate').length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t({ en: 'Moderate', he: 'בינוני' })}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {interactions.filter(i => i.adjustedSeverity === 'minor').length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t({ en: 'Minor', he: 'קל' })}
                  </div>
                </div>
              </div>

              {/* Detailed Interactions */}
              <div className="space-y-3">
                <h4 className="font-semibold">
                  {t({ en: 'Interaction Details', he: 'פרטי האינטראקציות' })}
                </h4>
                {interactions.map((interaction, index) => (
                  <Card key={index} className="border-l-4" 
                        style={{borderLeftColor: 
                          interaction.adjustedSeverity === 'critical' ? '#ef4444' :
                          interaction.adjustedSeverity === 'major' ? '#f97316' :
                          interaction.adjustedSeverity === 'moderate' ? '#eab308' : '#6b7280'
                        }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(interaction.adjustedSeverity)}>
                            {interaction.adjustedSeverity}
                          </Badge>
                          {interaction.originalSeverity !== interaction.adjustedSeverity && (
                            <span className="text-xs text-muted-foreground">
                              (adjusted from {interaction.originalSeverity})
                            </span>
                          )}
                        </div>
                        <Badge variant="outline">
                          {t({ en: 'Evidence', he: 'ראיה' })}: {interaction.evidence}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium">
                            {interaction.drug1.drugName}
                          </span>
                          {' + '}
                          <span className="font-medium">
                            {interaction.drug2.drugName}
                          </span>
                        </div>
                        
                        <div className="text-sm">
                          <span className="font-medium">
                            {t({ en: 'Mechanism:', he: 'מנגנון:' })}
                          </span>
                          {' ' + interaction.mechanism}
                        </div>
                        
                        <div className="text-sm">
                          <span className="font-medium">
                            {t({ en: 'Effect:', he: 'השפעה:' })}
                          </span>
                          {' ' + interaction.effect}
                        </div>
                        
                        {interaction.clinicalSignificance && (
                          <div className="text-sm">
                            <span className="font-medium">
                              {t({ en: 'Clinical Significance:', he: 'משמעות קלינית:' })}
                            </span>
                            {' ' + interaction.clinicalSignificance}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : interactions.length === 0 && medications?.length > 1 && !isChecking ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <div className="text-lg font-semibold text-green-600">
                {t({
                  en: 'No Drug Interactions Found',
                  he: 'לא נמצאו אינטראקציות תרופתיות'
                })}
              </div>
              <div className="text-sm text-muted-foreground">
                {t({
                  en: 'The selected medications appear to be safe to use together',
                  he: 'התרופות שנבחרו נראות בטוחות לשימוש יחד'
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Info className="h-12 w-12 mx-auto mb-2" />
              <div>
                {t({
                  en: 'Add multiple medications to check for interactions',
                  he: 'הוסף מספר תרופות כדי לבדוק אינטראקציות'
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t({ en: 'Clinical Recommendations', he: 'המלצות קליניות' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={
                      rec.priority === 'immediate' ? 'destructive' :
                      rec.priority === 'high' ? 'warning' : 'default'
                    }>
                      {rec.priority}
                    </Badge>
                    <span className="font-medium">{rec.action}</span>
                  </div>
                  
                  {rec.alternatives?.length > 0 && (
                    <div className="text-sm mt-2">
                      <span className="font-medium">
                        {t({ en: 'Alternatives:', he: 'חלופות:' })}
                      </span>
                      <ul className="list-disc list-inside mt-1">
                        {rec.alternatives.map((alt, i) => (
                          <li key={i}>{alt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {rec.monitoring?.length > 0 && (
                    <div className="text-sm mt-2">
                      <span className="font-medium">
                        {t({ en: 'Monitoring:', he: 'מעקב:' })}
                      </span>
                      <ul className="list-disc list-inside mt-1">
                        {rec.monitoring.map((mon, i) => (
                          <li key={i}>{mon}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {rec.rationale && (
                    <div className="text-sm mt-2 text-muted-foreground">
                      <span className="font-medium">
                        {t({ en: 'Rationale:', he: 'הנמקה:' })}
                      </span>
                      {' ' + rec.rationale}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DrugInteractionChecker;
```

### 6. Test Cases

```javascript
// backend/tests/medicationSafetyService.test.js
const medicationSafetyService = require('../services/medicationSafetyService');
const SecureDataAccess = require('../services/secureDataAccess');

describe('MedicationSafetyService', () => {
  beforeAll(async () => {
    await medicationSafetyService.initialize();
  });

  describe('checkDrugInteractions', () => {
    test('should detect critical warfarin-aspirin interaction', async () => {
      const request = {
        patientId: 'patient123',
        prescriberId: 'doctor123',
        medications: [
          {
            drugCode: '11289', // Warfarin
            drugName: 'Warfarin',
            dosage: '5mg',
            frequency: 'daily'
          },
          {
            drugCode: '1191', // Aspirin
            drugName: 'Aspirin',
            dosage: '81mg',
            frequency: 'daily'
          }
        ]
      };

      const context = {
        practiceId: 'clinic123',
        userId: 'doctor123'
      };

      const result = await medicationSafetyService.checkDrugInteractions(request, context);

      expect(result.status).toBe('completed');
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0].adjustedSeverity).toBe('critical');
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should handle no interactions scenario', async () => {
      const request = {
        patientId: 'patient123',
        prescriberId: 'doctor123',
        medications: [
          {
            drugCode: '1191', // Aspirin
            drugName: 'Aspirin',
            dosage: '81mg',
            frequency: 'daily'
          },
          {
            drugCode: '161', // Acetaminophen
            drugName: 'Acetaminophen',
            dosage: '500mg',
            frequency: 'q6h'
          }
        ]
      };

      const context = {
        practiceId: 'clinic123',
        userId: 'doctor123'
      };

      const result = await medicationSafetyService.checkDrugInteractions(request, context);

      expect(result.status).toBe('completed');
      expect(result.interactions).toHaveLength(0);
      expect(result.alerts).toHaveLength(0);
    });

    test('should adjust severity based on patient factors', async () => {
      // Mock patient with renal impairment
      jest.spyOn(medicationSafetyService, 'getPatientRiskFactors')
        .mockResolvedValue({
          age: 75,
          renalImpairment: true,
          hepaticImpairment: false,
          allergies: []
        });

      const request = {
        patientId: 'elderly_patient',
        prescriberId: 'doctor123',
        medications: [
          {
            drugCode: '1191', // Aspirin
            drugName: 'Aspirin',
            dosage: '325mg',
            frequency: 'daily'
          },
          {
            drugCode: '11289', // Warfarin
            drugName: 'Warfarin',
            dosage: '5mg',
            frequency: 'daily'
          }
        ]
      };

      const context = {
        practiceId: 'clinic123',
        userId: 'doctor123'
      };

      const result = await medicationSafetyService.checkDrugInteractions(request, context);

      expect(result.interactions[0].adjustedSeverity).toBe('critical');
      expect(result.interactions[0].originalSeverity).toBe('major');
    });
  });
});
```

## Dependencies
- Drug interaction database (RxNorm, FDA, clinical pharmacology)
- Patient medication history
- Clinical decision support rules
- Alert configuration system
- Audit logging system

## Success Criteria
- ✅ Real-time interaction detection with <2 second response time
- ✅ Severity adjustment based on patient factors
- ✅ Clinical recommendations with alternatives
- ✅ Configurable alert levels
- ✅ Complete audit trail
- ✅ Integration with prescribing workflow
- ✅ Evidence-based interaction database
- ✅ Support for multiple interaction types