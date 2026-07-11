/**
 * 🏥 TREATMENT PLANNING SERVICE
 * 
 * Comprehensive treatment planning system with evidence-based protocols,
 * clinical decision support, and outcome tracking for optimal patient care.
 * 
 * FEATURES: Protocol management, treatment recommendations, outcome metrics
 * SECURITY: Service authentication and secure data access for all operations
 */

const crypto = require('crypto');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class TreatmentPlanningService {
  constructor() {
    this.serviceId = 'treatment-planning-service';
    this.serviceToken = null;
    this.initialized = false;
    this.protocolLibrary = new Map();
    this.evidenceDatabase = new Map();
    this.outcomeMetrics = new Map();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      await this.loadTreatmentProtocols();
      await this.loadEvidenceDatabase();
      this.initialized = true;
      
      // Log initialization
      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'treatmentPlanningService',
        timestamp: new Date()
      }, {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      });
      
      console.log('✅ Treatment Planning Service initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize Treatment Planning Service:', error);
      throw error;
    }
  }

  // Helper methods for service access - CRITICAL for treatment planning operations
  getSecureDataAccess() {
    return getServiceProxy().getService('secureDataAccess');
  }

  getGeminiMedicalService() {
    return getServiceProxy().getService('geminiMedicalService');
  }

  getSecureConfigService() {
    return getServiceProxy().getService('secureConfigService');
  }

  async loadTreatmentProtocols() {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'load-treatment-protocols',
        practiceId: 'global'
      };

      const secureDataAccess = this.getSecureDataAccess();
      const protocols = await secureDataAccess.query(
        'treatment_protocols',
        { active: true },
        { limit: 500 },
        context
      );

      protocols.forEach(protocol => {
        this.protocolLibrary.set(protocol.protocolId, {
          name: protocol.name,
          condition: protocol.condition,
          icd10Codes: protocol.icd10Codes || [],
          steps: protocol.steps || [],
          decisionPoints: protocol.decisionPoints || [],
          evidenceLevel: protocol.evidenceLevel,
          outcomes: protocol.outcomes || [],
          version: protocol.version
        });
      });

      if (this.protocolLibrary.size === 0) {
        this.loadDefaultProtocols();
      }
    } catch (error) {
      console.error('Failed to load treatment protocols:', error);
      this.loadDefaultProtocols();
    }
  }

  loadDefaultProtocols() {
    const diabetesProtocol = {
      name: 'Type 2 Diabetes Management',
      condition: 'Type 2 Diabetes Mellitus',
      icd10Codes: ['E11', 'E11.9', 'E11.65'],
      steps: [
        {
          stepId: 'initial_assessment',
          name: 'Initial Assessment',
          description: 'Comprehensive evaluation of patient',
          actions: ['HbA1c test', 'Lipid panel', 'Kidney function', 'Eye exam referral'],
          timeline: 'Week 1'
        },
        {
          stepId: 'lifestyle_modification',
          name: 'Lifestyle Modification',
          description: 'Diet and exercise counseling',
          actions: ['Nutrition consultation', 'Exercise plan', 'Weight management'],
          timeline: 'Weeks 1-4'
        },
        {
          stepId: 'medication_initiation',
          name: 'Medication Initiation',
          description: 'Start metformin if lifestyle changes insufficient',
          actions: ['Prescribe metformin 500mg BID', 'Monitor for side effects'],
          timeline: 'Week 4',
          decisionPoint: true
        },
        {
          stepId: 'follow_up',
          name: 'Follow-up Assessment',
          description: '3-month follow-up',
          actions: ['Repeat HbA1c', 'Adjust medications', 'Review compliance'],
          timeline: 'Month 3'
        }
      ],
      decisionPoints: [
        {
          id: 'medication_decision',
          step: 'medication_initiation',
          criteria: 'HbA1c > 7.0% after lifestyle modification',
          options: ['Start metformin', 'Continue lifestyle only', 'Consider GLP-1']
        }
      ],
      evidenceLevel: 'A',
      outcomes: ['HbA1c reduction', 'Weight loss', 'Cardiovascular risk reduction'],
      version: '2024.1'
    };

    const hypertensionProtocol = {
      name: 'Hypertension Management',
      condition: 'Essential Hypertension',
      icd10Codes: ['I10', 'I11', 'I12'],
      steps: [
        {
          stepId: 'bp_confirmation',
          name: 'BP Confirmation',
          description: 'Confirm diagnosis with multiple readings',
          actions: ['Home BP monitoring', 'Office BP checks x3', '24-hour ambulatory BP'],
          timeline: 'Week 1-2'
        },
        {
          stepId: 'risk_assessment',
          name: 'Cardiovascular Risk Assessment',
          description: 'Calculate 10-year CV risk',
          actions: ['Lipid panel', 'EKG', 'Calculate ASCVD score'],
          timeline: 'Week 2'
        },
        {
          stepId: 'lifestyle_intervention',
          name: 'Lifestyle Intervention',
          description: 'DASH diet and exercise',
          actions: ['DASH diet education', 'Sodium restriction', 'Exercise prescription'],
          timeline: 'Weeks 2-6'
        },
        {
          stepId: 'pharmacotherapy',
          name: 'Medication Initiation',
          description: 'Start antihypertensive if BP remains elevated',
          actions: ['ACE-I/ARB first line', 'Consider diuretic', 'Titrate to goal'],
          timeline: 'Week 6',
          decisionPoint: true
        }
      ],
      decisionPoints: [
        {
          id: 'medication_choice',
          step: 'pharmacotherapy',
          criteria: 'BP ≥140/90 after lifestyle intervention',
          options: ['ACE inhibitor', 'ARB', 'Thiazide diuretic', 'CCB']
        }
      ],
      evidenceLevel: 'A',
      outcomes: ['BP reduction', 'CV event reduction', 'Stroke prevention'],
      version: '2024.1'
    };

    this.protocolLibrary.set('diabetes_t2_mgmt', diabetesProtocol);
    this.protocolLibrary.set('hypertension_mgmt', hypertensionProtocol);
  }

  async loadEvidenceDatabase() {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'load-evidence-database',
        practiceId: 'global'
      };

      const secureDataAccess = this.getSecureDataAccess();
      const evidenceEntries = await secureDataAccess.query(
        'clinical_evidence',
        { active: true },
        { limit: 1000 },
        context
      );

      evidenceEntries.forEach(entry => {
        this.evidenceDatabase.set(entry.studyId, {
          title: entry.title,
          authors: entry.authors,
          journal: entry.journal,
          year: entry.year,
          evidenceLevel: entry.evidenceLevel,
          populationSize: entry.populationSize,
          findings: entry.findings,
          relevantConditions: entry.relevantConditions
        });
      });

      console.log(`📚 Loaded ${this.evidenceDatabase.size} evidence entries`);
    } catch (error) {
      console.error('Failed to load evidence database:', error);
    }
  }

  async createTreatmentPlan(patientId, diagnosis, practiceId, patientContext = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const planId = crypto.randomUUID();
      const recommendedProtocols = await this.getRecommendedProtocols(diagnosis, patientContext);
      
      if (recommendedProtocols.length === 0) {
        throw new Error(`No treatment protocols found for diagnosis: ${diagnosis}`);
      }

      const selectedProtocol = recommendedProtocols[0];
      
      const treatmentPlan = {
        planId,
        patientId,
        diagnosis,
        protocolId: selectedProtocol.protocolId,
        protocolName: selectedProtocol.name,
        steps: selectedProtocol.steps || [],
        currentStep: 0,
        status: 'active',
        createdAt: new Date(),
        createdBy: patientContext.providerId || 'system',
        targetOutcomes: selectedProtocol.outcomes || [],
        notes: `Treatment plan generated based on ${selectedProtocol.evidenceLevel} level evidence`
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'create-treatment-plan',
        practiceId
      };

      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create('treatment_plans', treatmentPlan, context);

      console.log(`📋 Created treatment plan ${planId} for patient ${patientId}`);
      return treatmentPlan;
    } catch (error) {
      console.error('Failed to create treatment plan:', error);
      throw error;
    }
  }

  async updateTreatmentPlan(planId, updates, practiceId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'update-treatment-plan',
        practiceId
      };

      const secureDataAccess = this.getSecureDataAccess();
      const result = await secureDataAccess.update(
        'treatment_plans',
        { planId },
        updateData,
        context
      );

      if (updates.currentStep !== undefined) {
        await this.logStepProgression(planId, updates.currentStep, practiceId);
      }

      console.log(`📝 Updated treatment plan ${planId}`);
      return result;
    } catch (error) {
      console.error('Failed to update treatment plan:', error);
      throw error;
    }
  }

  async logStepProgression(planId, stepIndex, practiceId) {
    try {
      const progressEntry = {
        planId,
        stepIndex,
        completedAt: new Date(),
        notes: `Progressed to step ${stepIndex + 1}`
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'log-step-progression',
        practiceId
      };

      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create('treatment_plan_progress', progressEntry, context);
    } catch (error) {
      console.error('Failed to log step progression:', error);
    }
  }

  async getTreatmentPlan(planId, practiceId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'get-treatment-plan',
        practiceId
      };

      const secureDataAccess = this.getSecureDataAccess();
      const plans = await secureDataAccess.query(
        'treatment_plans',
        { planId },
        { limit: 1 },
        context
      );

      return plans[0] || null;
    } catch (error) {
      console.error('Failed to get treatment plan:', error);
      throw error;
    }
  }

  async getPatientTreatmentPlans(patientId, practiceId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'get-patient-treatment-plans',
        practiceId
      };

      const secureDataAccess = this.getSecureDataAccess();
      const plans = await secureDataAccess.query(
        'treatment_plans',
        { patientId },
        { sort: { createdAt: -1 } },
        context
      );

      return plans;
    } catch (error) {
      console.error('Failed to get patient treatment plans:', error);
      throw error;
    }
  }

  async getRecommendedProtocols(diagnosis, patientContext = {}) {
    try {
      const recommendations = [];

      for (const [protocolId, protocol] of this.protocolLibrary.entries()) {
        const relevanceScore = this.calculateProtocolRelevance(protocol, diagnosis, patientContext);
        
        if (relevanceScore > 0.5) {
          const effectiveness = this.outcomeMetrics.get(protocolId);
          
          recommendations.push({
            protocolId,
            name: protocol.name,
            condition: protocol.condition,
            relevanceScore,
            evidenceLevel: protocol.evidenceLevel,
            successRate: effectiveness?.successRate || 'No data',
            averageAdherence: effectiveness?.averageAdherence || 'No data',
            steps: protocol.steps,
            outcomes: protocol.outcomes
          });
        }
      }

      recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);

      return recommendations.slice(0, 5);
    } catch (error) {
      console.error('Failed to get recommended protocols:', error);
      throw error;
    }
  }

  calculateProtocolRelevance(protocol, diagnosis, patientContext) {
    let score = 0;

    // Exact condition match
    if (protocol.condition.toLowerCase().includes(diagnosis.toLowerCase())) {
      score += 0.5;
    }

    // ICD-10 code match
    if (protocol.icd10Codes.some(code => diagnosis.includes(code))) {
      score += 0.3;
    }

    // Age-specific protocols
    if (patientContext.age > 65 && protocol.name.includes('elderly')) {
      score += 0.1;
    }

    // Complex patient considerations
    if (patientContext.comorbidities && patientContext.comorbidities.length > 2) {
      if (protocol.name.includes('complex') || protocol.name.includes('multi')) {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  async getProtocolOutcomes(protocolId, practiceId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'get-protocol-outcomes',
        practiceId
      };

      const secureDataAccess = this.getSecureDataAccess();
      const outcomes = await secureDataAccess.query(
        'protocol_outcomes',
        { protocolId },
        { sort: { completedAt: -1 } },
        context
      );

      return outcomes;
    } catch (error) {
      console.error('Failed to get protocol outcomes:', error);
      throw error;
    }
  }

  getServiceStatus() {
    return {
      initialized: this.initialized,
      protocolsLoaded: this.protocolLibrary.size,
      evidenceEntriesLoaded: this.evidenceDatabase.size,
      serviceId: this.serviceId
    };
  }
}

// Create and export singleton instance
const treatmentPlanningService = new TreatmentPlanningService();

// Register service with proxy manager - CRITICAL for treatment planning
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('treatmentPlanningService', () => treatmentPlanningService);
}

module.exports = treatmentPlanningService;