# Allergy Management System

## Function Details
**Function Name**: manageAllergies  
**Location**: backend/services/allergyManagementService.js  
**Status**: Not Implemented  
**Priority**: Critical (P1)  
**Complexity**: Medium-High  
**Estimated Time**: 6-8 hours  

## Problem Description
Comprehensive allergy management system with drug allergy tracking, cross-reactivity detection, severity classification, automatic prescribing alerts, and integration with clinical decision support for medication safety.

## Implementation Steps

### 1. Core Service Implementation

```javascript
// backend/services/allergyManagementService.js
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AuditLog = require('../models/AuditLog');
const drugDatabase = require('./drugDatabase');
const crossReactivityEngine = require('./crossReactivityEngine');

class AllergyManagementService {
  constructor() {
    this.serviceToken = null;
    this.allergyDatabase = null;
    this.crossReactivityRules = new Map();
    this.severityClassifications = new Map();
    this.reactionTypes = new Set();
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('allergy-management-service');
    await this.loadAllergyDatabase();
    await this.loadCrossReactivityRules();
    await this.loadSeverityClassifications();
    await this.loadReactionTypes();
  }

  async manageAllergies(allergyRequest, context) {
    try {
      await this.validateAllergyRequest(allergyRequest, context);
      
      const patientAllergies = await this.getPatientAllergies(
        allergyRequest.patientId,
        context
      );
      
      let result;
      
      switch (allergyRequest.action) {
        case 'add':
          result = await this.addAllergy(
            allergyRequest.patientId,
            allergyRequest.allergyData,
            context
          );
          break;
          
        case 'update':
          result = await this.updateAllergy(
            allergyRequest.allergyId,
            allergyRequest.allergyData,
            context
          );
          break;
          
        case 'remove':
          result = await this.removeAllergy(
            allergyRequest.allergyId,
            allergyRequest.reason,
            context
          );
          break;
          
        case 'verify':
          result = await this.verifyAllergy(
            allergyRequest.allergyId,
            allergyRequest.verificationData,
            context
          );
          break;
          
        case 'check_medication':
          result = await this.checkMedicationAgainstAllergies(
            allergyRequest.patientId,
            allergyRequest.medicationData,
            context
          );
          break;
          
        case 'get_cross_reactions':
          result = await this.getCrossReactiveSubstances(
            allergyRequest.allergen,
            context
          );
          break;
          
        default:
          throw new Error('Invalid allergy management action');
      }
      
      await this.auditAllergyAction(allergyRequest, result, context);
      
      return result;
      
    } catch (error) {
      await this.handleAllergyError(error, allergyRequest, context);
      throw error;
    }
  }

  async validateAllergyRequest(request, context) {
    if (!request.patientId) {
      throw new Error('Patient ID is required');
    }
    
    if (!request.action) {
      throw new Error('Action is required');
    }
    
    const validActions = ['add', 'update', 'remove', 'verify', 'check_medication', 'get_cross_reactions'];
    if (!validActions.includes(request.action)) {
      throw new Error('Invalid action specified');
    }
    
    // Validate specific action requirements
    if (request.action === 'add' && !request.allergyData) {
      throw new Error('Allergy data is required for add action');
    }
    
    if (request.action === 'update' && (!request.allergyId || !request.allergyData)) {
      throw new Error('Allergy ID and data are required for update action');
    }
    
    if (request.action === 'check_medication' && !request.medicationData) {
      throw new Error('Medication data is required for medication check');
    }
  }

  async getPatientAllergies(patientId, context) {
    const allergies = await SecureDataAccess.query(
      'allergies',
      { 
        patientId: patientId,
        status: { $ne: 'deleted' }
      },
      { 
        sort: { severity: -1, lastUpdated: -1 },
        populate: ['reportedBy', 'verifiedBy']
      },
      context
    );
    
    // Enrich with cross-reactivity information
    for (const allergy of allergies) {
      allergy.crossReactiveSubstances = await this.getCrossReactiveSubstances(
        allergy.allergen,
        context
      );
    }
    
    return allergies;
  }

  async addAllergy(patientId, allergyData, context) {
    // Validate allergy data
    await this.validateAllergyData(allergyData, context);
    
    // Check for duplicates
    const existingAllergy = await this.checkForDuplicateAllergy(
      patientId,
      allergyData.allergen,
      context
    );
    
    if (existingAllergy) {
      throw new Error('Similar allergy already exists for this patient');
    }
    
    // Normalize allergen name
    const normalizedAllergen = await this.normalizeAllergen(allergyData.allergen);
    
    // Classify severity if not provided
    const classifiedSeverity = allergyData.severity || 
      await this.classifySeverity(allergyData.reactions);
    
    // Get cross-reactive substances
    const crossReactiveSubstances = await this.getCrossReactiveSubstances(
      normalizedAllergen,
      context
    );
    
    const allergyRecord = {
      patientId: patientId,
      allergen: {
        name: normalizedAllergen.name,
        type: normalizedAllergen.type,
        code: normalizedAllergen.code, // RxNorm, UNII, or ICD code
        category: normalizedAllergen.category
      },
      reactions: allergyData.reactions.map(reaction => ({
        type: reaction.type,
        severity: reaction.severity,
        description: reaction.description,
        onset: reaction.onset,
        duration: reaction.duration
      })),
      severity: classifiedSeverity,
      onsetDate: allergyData.onsetDate ? new Date(allergyData.onsetDate) : null,
      reportedDate: new Date(),
      reportedBy: {
        userId: context.userId,
        type: allergyData.reportedByType || 'healthcare_provider',
        name: allergyData.reportedByName
      },
      verificationStatus: 'unverified',
      verificationRequired: this.requiresVerification(classifiedSeverity, normalizedAllergen.type),
      crossReactiveSubstances: crossReactiveSubstances,
      clinicalNotes: allergyData.clinicalNotes,
      status: 'active',
      metadata: {
        source: allergyData.source || 'manual_entry',
        confidence: allergyData.confidence || 'medium',
        lastUpdated: new Date(),
        updatedBy: context.userId
      }
    };
    
    const savedAllergy = await SecureDataAccess.create(
      'allergies',
      allergyRecord,
      context
    );
    
    // Create allergy alerts for active prescriptions
    await this.createAllergyAlerts(patientId, savedAllergy, context);
    
    // Generate cross-reactivity warnings
    const crossReactivityWarnings = await this.generateCrossReactivityWarnings(
      patientId,
      savedAllergy,
      context
    );
    
    return {
      allergyId: savedAllergy._id,
      status: 'added',
      allergy: savedAllergy,
      crossReactivityWarnings: crossReactivityWarnings,
      alertsCreated: true,
      verificationRequired: allergyRecord.verificationRequired
    };
  }

  async updateAllergy(allergyId, allergyData, context) {
    const existingAllergy = await SecureDataAccess.findById('allergies', allergyId, context);
    if (!existingAllergy) {
      throw new Error('Allergy not found');
    }
    
    await this.validateAllergyData(allergyData, context);
    
    // Create update history entry
    const updateHistory = {
      updatedAt: new Date(),
      updatedBy: context.userId,
      changes: this.calculateAllergyChanges(existingAllergy, allergyData),
      reason: allergyData.updateReason
    };
    
    const updatedFields = {
      ...allergyData,
      'metadata.lastUpdated': new Date(),
      'metadata.updatedBy': context.userId,
      $push: { 'metadata.updateHistory': updateHistory }
    };
    
    if (allergyData.severity && allergyData.severity !== existingAllergy.severity) {
      updatedFields.verificationRequired = this.requiresVerification(
        allergyData.severity,
        existingAllergy.allergen.type
      );
    }
    
    const updatedAllergy = await SecureDataAccess.update(
      'allergies',
      allergyId,
      updatedFields,
      context
    );
    
    // Update related alerts
    await this.updateAllergyAlerts(updatedAllergy, context);
    
    return {
      allergyId: allergyId,
      status: 'updated',
      allergy: updatedAllergy,
      changes: updateHistory.changes
    };
  }

  async removeAllergy(allergyId, reason, context) {
    const allergy = await SecureDataAccess.findById('allergies', allergyId, context);
    if (!allergy) {
      throw new Error('Allergy not found');
    }
    
    // Soft delete with reason
    const removalData = {
      status: 'inactive',
      removalReason: reason,
      removedDate: new Date(),
      removedBy: context.userId,
      'metadata.lastUpdated': new Date(),
      'metadata.updatedBy': context.userId
    };
    
    const removedAllergy = await SecureDataAccess.update(
      'allergies',
      allergyId,
      removalData,
      context
    );
    
    // Deactivate related alerts
    await this.deactivateAllergyAlerts(allergyId, context);
    
    return {
      allergyId: allergyId,
      status: 'removed',
      reason: reason,
      removedDate: new Date()
    };
  }

  async verifyAllergy(allergyId, verificationData, context) {
    const allergy = await SecureDataAccess.findById('allergies', allergyId, context);
    if (!allergy) {
      throw new Error('Allergy not found');
    }
    
    const verification = {
      verificationStatus: verificationData.status, // 'verified', 'unverified', 'disputed'
      verifiedDate: new Date(),
      verifiedBy: {
        userId: context.userId,
        name: verificationData.verifierName,
        credentials: verificationData.verifierCredentials
      },
      verificationMethod: verificationData.method, // 'clinical_history', 'skin_test', 'blood_test', 'challenge_test'
      verificationNotes: verificationData.notes,
      confidenceLevel: verificationData.confidenceLevel || 'high'
    };
    
    const verifiedAllergy = await SecureDataAccess.update(
      'allergies',
      allergyId,
      {
        ...verification,
        verificationRequired: false,
        'metadata.lastUpdated': new Date(),
        'metadata.updatedBy': context.userId
      },
      context
    );
    
    return {
      allergyId: allergyId,
      status: 'verified',
      verification: verification,
      allergy: verifiedAllergy
    };
  }

  async checkMedicationAgainstAllergies(patientId, medicationData, context) {
    const patientAllergies = await this.getPatientAllergies(patientId, context);
    
    if (patientAllergies.length === 0) {
      return {
        hasConflicts: false,
        conflicts: [],
        crossReactivityRisks: [],
        recommendations: []
      };
    }
    
    const conflicts = [];
    const crossReactivityRisks = [];
    const recommendations = [];
    
    // Direct allergy matches
    for (const allergy of patientAllergies) {
      const directMatch = await this.checkDirectAllergyMatch(
        medicationData,
        allergy,
        context
      );
      
      if (directMatch) {
        conflicts.push({
          type: 'direct_allergy',
          severity: allergy.severity,
          allergen: allergy.allergen.name,
          medication: medicationData.name,
          reactions: allergy.reactions,
          recommendation: this.getDirectAllergyRecommendation(allergy.severity)
        });
      }
      
      // Cross-reactivity checks
      const crossReactivity = await this.checkCrossReactivity(
        medicationData,
        allergy,
        context
      );
      
      if (crossReactivity.hasRisk) {
        crossReactivityRisks.push({
          type: 'cross_reactivity',
          knownAllergen: allergy.allergen.name,
          medication: medicationData.name,
          riskLevel: crossReactivity.riskLevel,
          mechanism: crossReactivity.mechanism,
          probability: crossReactivity.probability,
          recommendation: crossReactivity.recommendation
        });
      }
    }
    
    // Generate overall recommendations
    if (conflicts.length > 0 || crossReactivityRisks.length > 0) {
      recommendations.push(...this.generateMedicationAllergyRecommendations(
        conflicts,
        crossReactivityRisks,
        medicationData,
        context
      ));
    }
    
    return {
      hasConflicts: conflicts.length > 0 || crossReactivityRisks.length > 0,
      conflicts: conflicts,
      crossReactivityRisks: crossReactivityRisks,
      recommendations: recommendations,
      severity: this.calculateOverallRiskSeverity(conflicts, crossReactivityRisks)
    };
  }

  async getCrossReactiveSubstances(allergen, context) {
    if (typeof allergen === 'string') {
      allergen = await this.normalizeAllergen(allergen);
    }
    
    const crossReactive = await crossReactivityEngine.getCrossReactiveSubstances(
      allergen.code || allergen.name
    );
    
    return crossReactive.map(substance => ({
      name: substance.name,
      type: substance.type,
      code: substance.code,
      riskLevel: substance.riskLevel, // 'high', 'moderate', 'low'
      mechanism: substance.mechanism,
      evidence: substance.evidence,
      frequency: substance.frequency
    }));
  }

  async normalizeAllergen(allergenInput) {
    // Try to find in drug database first
    const drugMatch = await drugDatabase.findByName(allergenInput);
    if (drugMatch) {
      return {
        name: drugMatch.name,
        type: 'medication',
        code: drugMatch.rxcui,
        category: drugMatch.therapeuticClass
      };
    }
    
    // Check allergen database
    const allergenMatch = await this.allergyDatabase.findAllergen(allergenInput);
    if (allergenMatch) {
      return {
        name: allergenMatch.name,
        type: allergenMatch.type, // 'medication', 'food', 'environmental', 'other'
        code: allergenMatch.code,
        category: allergenMatch.category
      };
    }
    
    // Default normalization
    return {
      name: allergenInput.toLowerCase().trim(),
      type: 'other',
      code: null,
      category: 'unspecified'
    };
  }

  async classifySeverity(reactions) {
    let maxSeverity = 'mild';
    
    const severityMapping = {
      'mild': 1,
      'moderate': 2,
      'severe': 3,
      'life_threatening': 4
    };
    
    for (const reaction of reactions) {
      // Check for life-threatening reactions
      if (this.isLifeThreateningReaction(reaction.type)) {
        return 'life_threatening';
      }
      
      // Check for severe reactions
      if (this.isSevereReaction(reaction.type)) {
        maxSeverity = 'severe';
        continue;
      }
      
      // Use provided severity or default assessment
      const reactionSeverity = reaction.severity || this.assessReactionSeverity(reaction.type);
      if (severityMapping[reactionSeverity] > severityMapping[maxSeverity]) {
        maxSeverity = reactionSeverity;
      }
    }
    
    return maxSeverity;
  }

  isLifeThreateningReaction(reactionType) {
    const lifeThreatening = [
      'anaphylaxis',
      'anaphylactic_shock',
      'severe_bronchospasm',
      'laryngeal_edema',
      'severe_hypotension',
      'cardiac_arrest',
      'respiratory_arrest',
      'severe_angioedema'
    ];
    
    return lifeThreatening.includes(reactionType.toLowerCase());
  }

  isSevereReaction(reactionType) {
    const severe = [
      'stevens_johnson_syndrome',
      'toxic_epidermal_necrolysis',
      'drug_reaction_eosinophilia_systemic_symptoms',
      'severe_cutaneous_adverse_reaction',
      'acute_generalized_exanthematous_pustulosis',
      'severe_skin_reaction',
      'organ_dysfunction'
    ];
    
    return severe.includes(reactionType.toLowerCase());
  }

  async checkDirectAllergyMatch(medicationData, allergy, context) {
    // Check by RxCUI/code
    if (medicationData.rxcui && allergy.allergen.code === medicationData.rxcui) {
      return true;
    }
    
    // Check by name (normalized)
    const medicationNormalized = medicationData.name.toLowerCase().trim();
    const allergenNormalized = allergy.allergen.name.toLowerCase().trim();
    
    if (medicationNormalized === allergenNormalized) {
      return true;
    }
    
    // Check generic/brand name matches
    if (medicationData.genericName) {
      const genericNormalized = medicationData.genericName.toLowerCase().trim();
      if (genericNormalized === allergenNormalized) {
        return true;
      }
    }
    
    // Check active ingredients
    if (medicationData.activeIngredients) {
      for (const ingredient of medicationData.activeIngredients) {
        if (ingredient.toLowerCase().trim() === allergenNormalized) {
          return true;
        }
      }
    }
    
    return false;
  }

  async checkCrossReactivity(medicationData, allergy, context) {
    const crossReactiveSubstances = allergy.crossReactiveSubstances || 
      await this.getCrossReactiveSubstances(allergy.allergen, context);
    
    for (const substance of crossReactiveSubstances) {
      // Check if medication matches cross-reactive substance
      const isMatch = await this.checkSubstanceMatch(medicationData, substance);
      
      if (isMatch) {
        return {
          hasRisk: true,
          riskLevel: substance.riskLevel,
          mechanism: substance.mechanism,
          probability: substance.frequency,
          recommendation: this.getCrossReactivityRecommendation(substance.riskLevel)
        };
      }
    }
    
    return { hasRisk: false };
  }

  getCrossReactivityRecommendation(riskLevel) {
    switch (riskLevel) {
      case 'high':
        return 'Avoid - high risk of cross-reactivity. Consider alternative medication.';
      case 'moderate':
        return 'Caution - moderate risk of cross-reactivity. Monitor closely if used.';
      case 'low':
        return 'Low risk - consider patient history and monitor for reactions.';
      default:
        return 'Assess individual risk factors and proceed with caution.';
    }
  }

  async createAllergyAlerts(patientId, allergy, context) {
    // Get current active prescriptions
    const activePrescriptions = await SecureDataAccess.query(
      'prescriptions',
      {
        patientId: patientId,
        status: 'active',
        endDate: { $gte: new Date() }
      },
      {},
      context
    );
    
    const alerts = [];
    
    for (const prescription of activePrescriptions) {
      const allergyCheck = await this.checkMedicationAgainstAllergies(
        patientId,
        prescription.medication,
        context
      );
      
      if (allergyCheck.hasConflicts) {
        const alert = await SecureDataAccess.create(
          'allergy_alerts',
          {
            patientId: patientId,
            allergyId: allergy._id,
            prescriptionId: prescription._id,
            alertType: 'allergy_conflict',
            severity: allergyCheck.severity,
            message: this.generateAlertMessage(allergy, prescription.medication),
            conflicts: allergyCheck.conflicts,
            crossReactivityRisks: allergyCheck.crossReactivityRisks,
            status: 'active',
            createdAt: new Date(),
            createdBy: context.userId
          },
          context
        );
        
        alerts.push(alert);
      }
    }
    
    return alerts;
  }

  generateAlertMessage(allergy, medication) {
    return {
      en: `ALLERGY ALERT: Patient has documented ${allergy.severity} allergy to ${allergy.allergen.name}. Prescribed medication ${medication.name} may cause allergic reaction.`,
      he: `התראת אלרגיה: למטופל אלרגיה מתועדת ברמת ${allergy.severity} ל${allergy.allergen.name}. התרופה שנרשמה ${medication.name} עלולה לגרום לתגובה אלרגית.`
    };
  }

  async auditAllergyAction(request, result, context) {
    await AuditLog.create({
      action: 'ALLERGY_MANAGEMENT',
      subAction: request.action.toUpperCase(),
      entityType: 'allergy',
      entityId: result.allergyId || request.allergyId,
      patientId: request.patientId,
      userId: context.userId,
      practiceId: context.practiceId,
      details: {
        action: request.action,
        allergen: request.allergyData?.allergen,
        severity: request.allergyData?.severity || result.allergy?.severity,
        hasConflicts: result.hasConflicts,
        conflictsCount: result.conflicts?.length || 0,
        crossReactivityRisksCount: result.crossReactivityRisks?.length || 0
      },
      timestamp: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }
}

module.exports = new AllergyManagementService();
```

### 2. API Endpoints

```javascript
// backend/routes/allergy-management.js
const express = require('express');
const router = express.Router();
const allergyManagementService = require('../services/allergyManagementService');
const authMiddleware = require('../middleware/auth');
const auditMiddleware = require('../middleware/audit');

router.post('/manage',
  authMiddleware,
  auditMiddleware,
  async (req, res) => {
    try {
      const allergyRequest = {
        action: req.body.action,
        patientId: req.body.patientId,
        allergyId: req.body.allergyId,
        allergyData: req.body.allergyData,
        medicationData: req.body.medicationData,
        reason: req.body.reason,
        verificationData: req.body.verificationData
      };

      const context = {
        userId: req.user.id,
        practiceId: req.practice.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      const result = await allergyManagementService.manageAllergies(
        allergyRequest,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Allergy management action completed successfully',
          he: 'פעולת ניהול אלרגיות הושלמה בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Allergy management action failed',
          he: 'פעולת ניהול אלרגיות נכשלה'
        }
      });
    }
  }
);

router.get('/patient/:patientId',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const allergies = await allergyManagementService.getPatientAllergies(
        req.params.patientId,
        context
      );

      res.json({
        success: true,
        data: allergies,
        message: {
          en: 'Patient allergies retrieved successfully',
          he: 'אלרגיות המטופל נשלפו בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve patient allergies',
          he: 'נכשל בשליפת אלרגיות המטופל'
        }
      });
    }
  }
);

router.post('/check-medication',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const result = await allergyManagementService.checkMedicationAgainstAllergies(
        req.body.patientId,
        req.body.medicationData,
        context
      );

      res.json({
        success: true,
        data: result,
        message: {
          en: 'Medication allergy check completed',
          he: 'בדיקת אלרגיה לתרופה הושלמה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Medication allergy check failed',
          he: 'בדיקת אלרגיה לתרופה נכשלה'
        }
      });
    }
  }
);

router.get('/cross-reactivity/:allergen',
  authMiddleware,
  async (req, res) => {
    try {
      const context = {
        userId: req.user.id,
        practiceId: req.practice.id
      };

      const crossReactive = await allergyManagementService.getCrossReactiveSubstances(
        req.params.allergen,
        context
      );

      res.json({
        success: true,
        data: crossReactive,
        message: {
          en: 'Cross-reactive substances retrieved successfully',
          he: 'חומרים בעלי תגובתיות צולבת נשלפו בהצלחה'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: {
          en: 'Failed to retrieve cross-reactive substances',
          he: 'נכשל בשליפת חומרים בעלי תגובתיות צולבת'
        }
      });
    }
  }
);

module.exports = router;
```

### 3. Data Models

```javascript
// backend/models/Allergy.js
const mongoose = require('mongoose');

const AllergySchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  allergen: {
    name: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['medication', 'food', 'environmental', 'other'],
      required: true,
      index: true
    },
    code: String, // RxCUI, UNII, ICD code
    category: String
  },
  reactions: [{
    type: {
      type: String,
      required: true,
      enum: [
        'rash', 'hives', 'itching', 'swelling', 'difficulty_breathing',
        'wheezing', 'cough', 'nausea', 'vomiting', 'diarrhea',
        'anaphylaxis', 'angioedema', 'bronchospasm', 'hypotension',
        'tachycardia', 'stevens_johnson_syndrome', 'other'
      ]
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'life_threatening'],
      required: true
    },
    description: String,
    onset: String, // 'immediate', 'delayed', 'unknown'
    duration: String
  }],
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe', 'life_threatening'],
    required: true,
    index: true
  },
  onsetDate: Date,
  reportedDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  reportedBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['patient', 'family_member', 'healthcare_provider', 'pharmacy', 'other'],
      required: true
    },
    name: String
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'verified', 'disputed', 'historical'],
    default: 'unverified',
    index: true
  },
  verificationRequired: {
    type: Boolean,
    default: false
  },
  verifiedDate: Date,
  verifiedBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    credentials: String
  },
  verificationMethod: {
    type: String,
    enum: ['clinical_history', 'skin_test', 'blood_test', 'challenge_test', 'other']
  },
  verificationNotes: String,
  confidenceLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  crossReactiveSubstances: [{
    name: String,
    type: String,
    code: String,
    riskLevel: {
      type: String,
      enum: ['low', 'moderate', 'high']
    },
    mechanism: String,
    evidence: String
  }],
  clinicalNotes: String,
  status: {
    type: String,
    enum: ['active', 'inactive', 'resolved', 'deleted'],
    default: 'active',
    index: true
  },
  removalReason: String,
  removedDate: Date,
  removedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    source: {
      type: String,
      enum: ['manual_entry', 'ehr_import', 'pharmacy_report', 'patient_portal', 'hl7_message'],
      default: 'manual_entry'
    },
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updateHistory: [{
      updatedAt: Date,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      changes: mongoose.Schema.Types.Mixed,
      reason: String
    }]
  }
});

// Indexes for performance and uniqueness
AllergySchema.index({ patientId: 1, 'allergen.name': 1 });
AllergySchema.index({ patientId: 1, severity: -1, status: 1 });
AllergySchema.index({ 'allergen.type': 1, severity: 1 });
AllergySchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('Allergy', AllergySchema);
```

### 4. Frontend Components

```jsx
// frontend-vite/src/components/allergy/AllergyManagement.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import secureApiClient from '@/services/secureApiClient';
import { useTranslation } from '@/hooks/useTranslation';

const AllergyManagement = ({ patientId, onAllergyUpdate }) => {
  const { t } = useTranslation();
  const [allergies, setAllergies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState(null);
  const [allergyForm, setAllergyForm] = useState({
    allergen: '',
    type: 'medication',
    severity: 'moderate',
    reactions: [],
    onsetDate: '',
    clinicalNotes: ''
  });

  useEffect(() => {
    if (patientId) {
      loadPatientAllergies();
    }
  }, [patientId]);

  const loadPatientAllergies = async () => {
    setLoading(true);
    try {
      const response = await secureApiClient.get(`/api/allergy-management/patient/${patientId}`);
      if (response.data.success) {
        setAllergies(response.data.data);
      }
    } catch (error) {
      console.error('Error loading allergies:', error);
    } finally {
      setLoading(false);
    }
  };

  const addAllergy = async () => {
    try {
      const response = await secureApiClient.post('/api/allergy-management/manage', {
        action: 'add',
        patientId,
        allergyData: {
          ...allergyForm,
          reactions: allergyForm.reactions.length > 0 ? allergyForm.reactions : [
            { type: 'rash', severity: allergyForm.severity }
          ]
        }
      });

      if (response.data.success) {
        await loadPatientAllergies();
        setShowAddForm(false);
        resetForm();
        if (onAllergyUpdate) {
          onAllergyUpdate();
        }
      }
    } catch (error) {
      console.error('Error adding allergy:', error);
    }
  };

  const updateAllergy = async () => {
    try {
      const response = await secureApiClient.post('/api/allergy-management/manage', {
        action: 'update',
        patientId,
        allergyId: editingAllergy._id,
        allergyData: allergyForm
      });

      if (response.data.success) {
        await loadPatientAllergies();
        setEditingAllergy(null);
        resetForm();
        if (onAllergyUpdate) {
          onAllergyUpdate();
        }
      }
    } catch (error) {
      console.error('Error updating allergy:', error);
    }
  };

  const removeAllergy = async (allergyId, reason) => {
    try {
      const response = await secureApiClient.post('/api/allergy-management/manage', {
        action: 'remove',
        patientId,
        allergyId,
        reason: reason || 'No longer applicable'
      });

      if (response.data.success) {
        await loadPatientAllergies();
        if (onAllergyUpdate) {
          onAllergyUpdate();
        }
      }
    } catch (error) {
      console.error('Error removing allergy:', error);
    }
  };

  const verifyAllergy = async (allergyId, verificationData) => {
    try {
      const response = await secureApiClient.post('/api/allergy-management/manage', {
        action: 'verify',
        patientId,
        allergyId,
        verificationData
      });

      if (response.data.success) {
        await loadPatientAllergies();
        if (onAllergyUpdate) {
          onAllergyUpdate();
        }
      }
    } catch (error) {
      console.error('Error verifying allergy:', error);
    }
  };

  const resetForm = () => {
    setAllergyForm({
      allergen: '',
      type: 'medication',
      severity: 'moderate',
      reactions: [],
      onsetDate: '',
      clinicalNotes: ''
    });
  };

  const startEdit = (allergy) => {
    setEditingAllergy(allergy);
    setAllergyForm({
      allergen: allergy.allergen.name,
      type: allergy.allergen.type,
      severity: allergy.severity,
      reactions: allergy.reactions,
      onsetDate: allergy.onsetDate ? new Date(allergy.onsetDate).toISOString().split('T')[0] : '',
      clinicalNotes: allergy.clinicalNotes || ''
    });
    setShowAddForm(true);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'life_threatening': return 'destructive';
      case 'severe': return 'warning';
      case 'moderate': return 'default';
      case 'mild': return 'secondary';
      default: return 'secondary';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'medication': return '💊';
      case 'food': return '🍽️';
      case 'environmental': return '🌱';
      default: return '⚠️';
    }
  };

  const getVerificationIcon = (status) => {
    switch (status) {
      case 'verified': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'disputed': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Info className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t({ en: 'Allergy Management', he: 'ניהול אלרגיות' })}
            </CardTitle>
            <Button 
              onClick={() => setShowAddForm(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t({ en: 'Add Allergy', he: 'הוסף אלרגיה' })}
            </Button>
          </div>
        </CardHeader>
        {allergies.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {allergies.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'Total Allergies', he: 'סך אלרגיות' })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {allergies.filter(a => a.severity === 'life_threatening' || a.severity === 'severe').length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'Severe/Critical', he: 'חמור/קריטי' })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {allergies.filter(a => a.allergen.type === 'medication').length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'Drug Allergies', he: 'אלרגיות לתרופות' })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {allergies.filter(a => a.verificationStatus === 'verified').length}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t({ en: 'Verified', he: 'מאומתים' })}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingAllergy ? 
                t({ en: 'Edit Allergy', he: 'ערוך אלרגיה' }) : 
                t({ en: 'Add New Allergy', he: 'הוסף אלרגיה חדשה' })
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="allergen">
                  {t({ en: 'Allergen', he: 'אלרגן' })} *
                </Label>
                <Input
                  id="allergen"
                  value={allergyForm.allergen}
                  onChange={(e) => setAllergyForm(prev => ({ ...prev, allergen: e.target.value }))}
                  placeholder={t({ en: 'Enter allergen name...', he: 'הכנס שם אלרגן...' })}
                />
              </div>
              
              <div>
                <Label htmlFor="type">
                  {t({ en: 'Type', he: 'סוג' })}
                </Label>
                <select
                  id="type"
                  value={allergyForm.type}
                  onChange={(e) => setAllergyForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="medication">{t({ en: 'Medication', he: 'תרופה' })}</option>
                  <option value="food">{t({ en: 'Food', he: 'מזון' })}</option>
                  <option value="environmental">{t({ en: 'Environmental', he: 'סביבתי' })}</option>
                  <option value="other">{t({ en: 'Other', he: 'אחר' })}</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="severity">
                  {t({ en: 'Severity', he: 'חומרה' })} *
                </Label>
                <select
                  id="severity"
                  value={allergyForm.severity}
                  onChange={(e) => setAllergyForm(prev => ({ ...prev, severity: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="mild">{t({ en: 'Mild', he: 'קל' })}</option>
                  <option value="moderate">{t({ en: 'Moderate', he: 'בינוני' })}</option>
                  <option value="severe">{t({ en: 'Severe', he: 'חמור' })}</option>
                  <option value="life_threatening">{t({ en: 'Life Threatening', he: 'מסכן חיים' })}</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="onsetDate">
                  {t({ en: 'Onset Date', he: 'תאריך התחלה' })}
                </Label>
                <Input
                  id="onsetDate"
                  type="date"
                  value={allergyForm.onsetDate}
                  onChange={(e) => setAllergyForm(prev => ({ ...prev, onsetDate: e.target.value }))}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="clinicalNotes">
                {t({ en: 'Clinical Notes', he: 'הערות קליניות' })}
              </Label>
              <textarea
                id="clinicalNotes"
                value={allergyForm.clinicalNotes}
                onChange={(e) => setAllergyForm(prev => ({ ...prev, clinicalNotes: e.target.value }))}
                className="w-full border rounded px-3 py-2 min-h-[80px]"
                placeholder={t({ en: 'Enter clinical notes...', he: 'הכנס הערות קליניות...' })}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={editingAllergy ? updateAllergy : addAllergy}
                disabled={!allergyForm.allergen}
              >
                {editingAllergy ? 
                  t({ en: 'Update Allergy', he: 'עדכן אלרגיה' }) : 
                  t({ en: 'Add Allergy', he: 'הוסף אלרגיה' })
                }
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddForm(false);
                  setEditingAllergy(null);
                  resetForm();
                }}
              >
                {t({ en: 'Cancel', he: 'בטל' })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allergies List */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <div className="mt-4">
              {t({ en: 'Loading allergies...', he: 'טוען אלרגיות...' })}
            </div>
          </CardContent>
        </Card>
      ) : allergies.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-semibold">
              {t({ en: 'No Known Allergies', he: 'אין אלרגיות ידועות' })}
            </div>
            <div className="text-muted-foreground">
              {t({ en: 'This patient has no documented allergies', he: 'למטופל זה אין אלרגיות מתועדות' })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allergies.map((allergy) => (
            <Card key={allergy._id} className={`border-l-4 ${
              allergy.severity === 'life_threatening' ? 'border-red-500' :
              allergy.severity === 'severe' ? 'border-orange-500' :
              allergy.severity === 'moderate' ? 'border-yellow-500' : 'border-gray-500'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getTypeIcon(allergy.allergen.type)}</span>
                      <div>
                        <h4 className="font-semibold text-lg">{allergy.allergen.name}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(allergy.severity)}>
                            {allergy.severity.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline">
                            {allergy.allergen.type}
                          </Badge>
                          <div className="flex items-center gap-1">
                            {getVerificationIcon(allergy.verificationStatus)}
                            <span className="text-sm text-muted-foreground">
                              {allergy.verificationStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Reactions */}
                    {allergy.reactions?.length > 0 && (
                      <div className="mb-2">
                        <span className="text-sm font-medium">
                          {t({ en: 'Reactions:', he: 'תגובות:' })}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {allergy.reactions.map((reaction, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {reaction.type.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Cross-reactivity warning */}
                    {allergy.crossReactiveSubstances?.length > 0 && (
                      <Alert className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <span className="font-medium">
                            {t({ en: 'Cross-reactivity:', he: 'תגובתיות צולבת:' })}
                          </span>
                          {' '}
                          {allergy.crossReactiveSubstances.slice(0, 3).map(sub => sub.name).join(', ')}
                          {allergy.crossReactiveSubstances.length > 3 && ` +${allergy.crossReactiveSubstances.length - 3} more`}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Clinical Notes */}
                    {allergy.clinicalNotes && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium">
                          {t({ en: 'Notes:', he: 'הערות:' })}
                        </span>
                        {' ' + allergy.clinicalNotes}
                      </div>
                    )}
                    
                    {/* Dates */}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {allergy.onsetDate && (
                        <span>
                          {t({ en: 'Onset:', he: 'התחלה:' })} {new Date(allergy.onsetDate).toLocaleDateString()}
                        </span>
                      )}
                      {allergy.onsetDate && allergy.reportedDate && ' • '}
                      <span>
                        {t({ en: 'Reported:', he: 'דווח:' })} {new Date(allergy.reportedDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(allergy)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    {allergy.verificationStatus === 'unverified' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => verifyAllergy(allergy._id, {
                          status: 'verified',
                          method: 'clinical_history',
                          confidenceLevel: 'medium'
                        })}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAllergy(allergy._id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllergyManagement;
```

### 5. Test Cases

```javascript
// backend/tests/allergyManagementService.test.js
const allergyManagementService = require('../services/allergyManagementService');
const SecureDataAccess = require('../services/secureDataAccess');

describe('AllergyManagementService', () => {
  beforeAll(async () => {
    await allergyManagementService.initialize();
  });

  describe('addAllergy', () => {
    test('should add new allergy successfully', async () => {
      const allergyData = {
        allergen: 'Penicillin',
        type: 'medication',
        severity: 'severe',
        reactions: [
          { type: 'rash', severity: 'moderate' },
          { type: 'difficulty_breathing', severity: 'severe' }
        ],
        clinicalNotes: 'Patient developed severe reaction after injection'
      };

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await allergyManagementService.addAllergy(
        'patient123',
        allergyData,
        context
      );

      expect(result.status).toBe('added');
      expect(result.allergyId).toBeDefined();
      expect(result.allergy.allergen.name).toBe('penicillin');
      expect(result.allergy.severity).toBe('severe');
      expect(result.crossReactivityWarnings).toBeDefined();
    });

    test('should prevent duplicate allergies', async () => {
      const allergyData = {
        allergen: 'Penicillin',
        type: 'medication',
        severity: 'mild',
        reactions: [{ type: 'rash', severity: 'mild' }]
      };

      // Mock existing allergy
      jest.spyOn(allergyManagementService, 'checkForDuplicateAllergy')
        .mockResolvedValue({ _id: 'existing123' });

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      await expect(
        allergyManagementService.addAllergy('patient123', allergyData, context)
      ).rejects.toThrow('Similar allergy already exists');
    });

    test('should classify severity based on reactions', async () => {
      const allergyData = {
        allergen: 'Shellfish',
        type: 'food',
        reactions: [
          { type: 'anaphylaxis', severity: 'life_threatening' },
          { type: 'hives', severity: 'moderate' }
        ]
      };

      const context = {
        userId: 'doctor123',
        practiceId: 'clinic123'
      };

      const result = await allergyManagementService.addAllergy(
        'patient123',
        allergyData,
        context
      );

      expect(result.allergy.severity).toBe('life_threatening');
    });
  });

  describe('checkMedicationAgainstAllergies', () => {
    test('should detect direct allergy match', async () => {
      const mockAllergies = [{
        allergen: { name: 'penicillin', code: '7980' },
        severity: 'severe',
        reactions: [{ type: 'rash', severity: 'moderate' }]
      }];

      jest.spyOn(allergyManagementService, 'getPatientAllergies')
        .mockResolvedValue(mockAllergies);

      const medicationData = {
        name: 'Penicillin G',
        rxcui: '7980',
        activeIngredients: ['penicillin']
      };

      const context = { userId: 'doctor123', practiceId: 'clinic123' };

      const result = await allergyManagementService.checkMedicationAgainstAllergies(
        'patient123',
        medicationData,
        context
      );

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('direct_allergy');
    });

    test('should detect cross-reactivity risks', async () => {
      const mockAllergies = [{
        allergen: { name: 'penicillin' },
        severity: 'moderate',
        crossReactiveSubstances: [
          { name: 'amoxicillin', riskLevel: 'high' }
        ]
      }];

      jest.spyOn(allergyManagementService, 'getPatientAllergies')
        .mockResolvedValue(mockAllergies);

      const medicationData = {
        name: 'Amoxicillin',
        rxcui: '723'
      };

      const context = { userId: 'doctor123', practiceId: 'clinic123' };

      const result = await allergyManagementService.checkMedicationAgainstAllergies(
        'patient123',
        medicationData,
        context
      );

      expect(result.hasConflicts).toBe(true);
      expect(result.crossReactivityRisks).toHaveLength(1);
      expect(result.crossReactivityRisks[0].riskLevel).toBe('high');
    });

    test('should handle no allergies scenario', async () => {
      jest.spyOn(allergyManagementService, 'getPatientAllergies')
        .mockResolvedValue([]);

      const medicationData = {
        name: 'Ibuprofen',
        rxcui: '5640'
      };

      const context = { userId: 'doctor123', practiceId: 'clinic123' };

      const result = await allergyManagementService.checkMedicationAgainstAllergies(
        'patient123',
        medicationData,
        context
      );

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.crossReactivityRisks).toHaveLength(0);
    });
  });

  describe('utility functions', () => {
    test('should classify life-threatening reactions correctly', () => {
      expect(allergyManagementService.isLifeThreateningReaction('anaphylaxis')).toBe(true);
      expect(allergyManagementService.isLifeThreateningReaction('laryngeal_edema')).toBe(true);
      expect(allergyManagementService.isLifeThreateningReaction('rash')).toBe(false);
    });

    test('should classify severe reactions correctly', () => {
      expect(allergyManagementService.isSevereReaction('stevens_johnson_syndrome')).toBe(true);
      expect(allergyManagementService.isSevereReaction('toxic_epidermal_necrolysis')).toBe(true);
      expect(allergyManagementService.isSevereReaction('hives')).toBe(false);
    });

    test('should normalize allergen names correctly', async () => {
      const normalized = await allergyManagementService.normalizeAllergen('PENICILLIN G ');
      expect(normalized.name).toBe('penicillin g');
      expect(normalized.type).toBeDefined();
    });
  });
});
```

## Dependencies
- Drug database with allergen codes
- Cross-reactivity rules engine
- Patient medication history
- Clinical decision support system
- Alert notification system
- Audit logging

## Success Criteria
- ✅ Comprehensive allergy tracking with severity classification
- ✅ Cross-reactivity detection and warnings
- ✅ Real-time medication conflict checking
- ✅ Verification workflow for allergy validation
- ✅ Integration with prescribing alerts
- ✅ Duplicate prevention and management
- ✅ Complete audit trail
- ✅ Clinical decision support integration