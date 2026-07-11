// Clinical Decision Support Service
// Migrated to DDD NX architecture - Clinical Care Context - Diagnosis Feature
// Provides risk calculators, clinical guidelines, and screening reminders

// Service proxy for lazy loading (prevents circular dependencies)
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Clinical Decision Support Service
 * Provides risk calculators, clinical guidelines, and screening reminders
 */
class ClinicalDecisionSupport {
  constructor() {
    this.serviceId = 'clinical-decision-support';
    this.serviceToken = null;
    this.initialized = false;
    
    // Risk calculator definitions
    this.riskCalculators = {
      'CHADS2_VASc': {
        name: 'CHA₂DS₂-VASc Score',
        purpose: 'Stroke risk in atrial fibrillation',
        factors: [
          { name: 'Congestive heart failure', points: 1 },
          { name: 'Hypertension', points: 1 },
          { name: 'Age ≥75 years', points: 2 },
          { name: 'Diabetes mellitus', points: 1 },
          { name: 'Stroke/TIA/TE', points: 2 },
          { name: 'Vascular disease', points: 1 },
          { name: 'Age 65-74 years', points: 1 },
          { name: 'Sex category (female)', points: 1 }
        ],
        interpretation: {
          0: { risk: '0%', recommendation: 'No anticoagulation' },
          1: { risk: '1.3%', recommendation: 'Consider anticoagulation' },
          2: { risk: '2.2%', recommendation: 'Anticoagulation recommended' },
          3: { risk: '3.2%', recommendation: 'Anticoagulation recommended' },
          4: { risk: '4.0%', recommendation: 'Anticoagulation recommended' },
          5: { risk: '6.7%', recommendation: 'Anticoagulation strongly recommended' },
          6: { risk: '9.8%', recommendation: 'Anticoagulation strongly recommended' },
          7: { risk: '9.6%', recommendation: 'Anticoagulation strongly recommended' },
          8: { risk: '12.5%', recommendation: 'Anticoagulation strongly recommended' },
          9: { risk: '15.2%', recommendation: 'Anticoagulation strongly recommended' }
        }
      },
      
      'Wells_DVT': {
        name: 'Wells Score for DVT',
        purpose: 'Probability of deep vein thrombosis',
        factors: [
          { name: 'Active cancer', points: 1 },
          { name: 'Paralysis/recent plaster immobilization', points: 1 },
          { name: 'Bedridden >3 days or surgery <4 weeks', points: 1 },
          { name: 'Localized tenderness', points: 1 },
          { name: 'Entire leg swollen', points: 1 },
          { name: 'Calf swelling >3cm', points: 1 },
          { name: 'Pitting edema', points: 1 },
          { name: 'Collateral superficial veins', points: 1 },
          { name: 'Previous DVT', points: 1 },
          { name: 'Alternative diagnosis likely', points: -2 }
        ],
        interpretation: {
          low: { range: '0-1', probability: '5%', action: 'D-dimer' },
          moderate: { range: '2', probability: '17%', action: 'D-dimer or ultrasound' },
          high: { range: '≥3', probability: '53%', action: 'Ultrasound recommended' }
        }
      },
      
      'HEART': {
        name: 'HEART Score',
        purpose: 'Risk of major cardiac events',
        factors: [
          { name: 'History (highly suspicious)', points: [0, 1, 2] },
          { name: 'ECG (abnormal)', points: [0, 1, 2] },
          { name: 'Age', points: [0, 1, 2] },
          { name: 'Risk factors', points: [0, 1, 2] },
          { name: 'Troponin', points: [0, 1, 2] }
        ],
        interpretation: {
          low: { range: '0-3', risk: '0.9-1.7%', disposition: 'Discharge' },
          moderate: { range: '4-6', risk: '12-16.6%', disposition: 'Admit for observation' },
          high: { range: '7-10', risk: '50-65%', disposition: 'Early invasive strategy' }
        }
      }
    };

    // Clinical guidelines
    this.guidelines = {
      'hypertension': {
        name: 'JNC 8 Hypertension Guidelines',
        criteria: {
          stage1: { systolic: '130-139', diastolic: '80-89' },
          stage2: { systolic: '≥140', diastolic: '≥90' }
        },
        treatment: {
          lifestyle: ['DASH diet', 'Exercise', 'Weight loss', 'Sodium restriction'],
          firstLine: ['ACE-I/ARB', 'Thiazide', 'CCB'],
          targets: {
            general: '<130/80',
            elderly: '<140/90'
          }
        }
      }
    };

    // Screening recommendations
    this.screeningSchedule = {
      'colonoscopy': {
        startAge: 45,
        frequency: 10,
        higherRisk: ['Family history', 'IBD', 'Previous polyps']
      },
      'mammogram': {
        startAge: 40,
        frequency: 1,
        notes: 'Annual or biennial based on risk'
      }
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service with serviceAccountManager
      const initProxy = getServiceProxy();
      const serviceAccountManager = initProxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      const auditProxy = getServiceProxy();
      const secureDataAccess = auditProxy.getService('secureDataAccess');
      await secureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'clinicalDecisionSupport',
        timestamp: new Date()
      }, context);
      
      console.log('✅ ClinicalDecisionSupport service initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize ClinicalDecisionSupport:', error);
      throw error;
    }
  }

  /**
   * Calculate risk score
   */
  async calculateRiskScore(calculatorName, patientData, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const calculator = this.riskCalculators[calculatorName];
      if (!calculator) {
        return { error: 'Calculator not found' };
      }

      let score = 0;
      const appliedFactors = [];

      // Calculate based on calculator type
      switch (calculatorName) {
        case 'CHADS2_VASc':
          score = this.calculateCHADS2VASc(patientData);
          break;
        case 'Wells_DVT':
          score = this.calculateWellsDVT(patientData);
          break;
        case 'HEART':
          score = this.calculateHEART(patientData);
          break;
        default:
          // Generic point-based calculator
          calculator.factors.forEach(factor => {
            if (this.hasRiskFactor(factor.name, patientData)) {
              score += factor.points;
              appliedFactors.push(factor.name);
            }
          });
      }

      // Get interpretation
      const interpretation = this.interpretScore(calculatorName, score);

      const result = {
        calculator: calculator.name,
        score: score,
        factors: appliedFactors,
        interpretation: interpretation,
        recommendation: interpretation.recommendation || interpretation.action
      };

      // Log calculation
      const context = {
        serviceId: this.serviceId,
        operation: 'calculate-risk-score',
        practiceId: practiceContext.practiceId || 'global'
      };

      const calcProxy = getServiceProxy();
      const secureDataAccess = calcProxy.getService('secureDataAccess');
      await secureDataAccess.create('clinical_calculations', {
        calculatorName,
        score,
        patientId: patientData.patientId,
        result,
        timestamp: new Date()
      }, context);

      return result;
    } catch (error) {
      console.error('Error calculating risk score:', error);
      return { error: error.message };
    }
  }

  /**
   * Calculate CHADS2-VASc score
   */
  calculateCHADS2VASc(data) {
    let score = 0;

    if (data.chf || data.heartFailure) score += 1;
    if (data.hypertension) score += 1;
    if (data.age >= 75) score += 2;
    else if (data.age >= 65) score += 1;
    if (data.diabetes) score += 1;
    if (data.stroke || data.tia) score += 2;
    if (data.vascularDisease) score += 1;
    if (data.gender === 'F' || data.gender === 'female') score += 1;

    return score;
  }

  /**
   * Calculate Wells DVT score
   */
  calculateWellsDVT(data) {
    let score = 0;

    if (data.activeCancer) score += 1;
    if (data.paralysis || data.recentImmobilization) score += 1;
    if (data.bedridden || data.recentSurgery) score += 1;
    if (data.localizedTenderness) score += 1;
    if (data.entireLegSwollen) score += 1;
    if (data.calfSwelling) score += 1;
    if (data.pittingEdema) score += 1;
    if (data.collateralVeins) score += 1;
    if (data.previousDVT) score += 1;
    if (data.alternativeDiagnosis) score -= 2;

    return score;
  }

  /**
   * Calculate HEART score
   */
  calculateHEART(data) {
    let score = 0;

    // History
    if (data.suspiciousHistory === 'highly') score += 2;
    else if (data.suspiciousHistory === 'moderately') score += 1;

    // ECG
    if (data.ecg === 'significant ST changes') score += 2;
    else if (data.ecg === 'nonspecific changes') score += 1;

    // Age
    if (data.age >= 65) score += 2;
    else if (data.age >= 45) score += 1;

    // Risk factors
    const riskFactors = ['diabetes', 'smoking', 'hypertension', 'hyperlipidemia', 'familyHistory', 'obesity'];
    const rfCount = riskFactors.filter(rf => data[rf]).length;
    if (rfCount >= 3) score += 2;
    else if (rfCount >= 1) score += 1;

    // Troponin
    if (data.troponin === 'elevated' || data.troponin > 0.04) score += 2;
    else if (data.troponin === 'borderline') score += 1;

    return score;
  }

  /**
   * Interpret score based on calculator
   */
  interpretScore(calculatorName, score) {
    const calculator = this.riskCalculators[calculatorName];
    
    if (calculatorName === 'CHADS2_VASc') {
      return calculator.interpretation[Math.min(score, 9)];
    }
    
    if (calculatorName === 'Wells_DVT') {
      if (score >= 3) return calculator.interpretation.high;
      if (score === 2) return calculator.interpretation.moderate;
      return calculator.interpretation.low;
    }
    
    if (calculatorName === 'HEART') {
      if (score >= 7) return calculator.interpretation.high;
      if (score >= 4) return calculator.interpretation.moderate;
      return calculator.interpretation.low;
    }
    
    return { score: score };
  }

  /**
   * Get screening recommendations
   */
  async getScreeningRecommendations(patientData, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const recommendations = [];
      const age = patientData.age;

      // Check each screening type
      Object.entries(this.screeningSchedule).forEach(([screening, criteria]) => {
        if (this.isDueForScreening(screening, criteria, patientData)) {
          recommendations.push({
            screening: screening,
            test: criteria.test || screening,
            frequency: criteria.frequency,
            priority: this.getScreeningPriority(screening, patientData),
            notes: criteria.notes || ''
          });
        }
      });

      // Log screening check
      const context = {
        serviceId: this.serviceId,
        operation: 'screening-recommendations',
        practiceId: practiceContext.practiceId || 'global'
      };

      const screenProxy = getServiceProxy();
      const secureDataAccess = screenProxy.getService('secureDataAccess');
      await secureDataAccess.create('screening_checks', {
        patientId: patientData.patientId,
        recommendations,
        timestamp: new Date()
      }, context);

      return recommendations;
    } catch (error) {
      console.error('Error getting screening recommendations:', error);
      return [];
    }
  }

  /**
   * Check if due for screening
   */
  isDueForScreening(screening, criteria, patientData) {
    const age = patientData.age;
    const gender = patientData.gender;

    // Age-based screenings
    if (criteria.startAge && age < criteria.startAge) return false;
    
    // Gender-specific screenings
    if (screening === 'mammogram' && gender === 'M') return false;

    // Check last screening date
    if (patientData.lastScreenings && patientData.lastScreenings[screening]) {
      const lastDate = new Date(patientData.lastScreenings[screening]);
      const yearsSince = (new Date() - lastDate) / (365 * 24 * 60 * 60 * 1000);
      return yearsSince >= criteria.frequency;
    }

    // If no record, assume due
    return true;
  }

  /**
   * Get screening priority
   */
  getScreeningPriority(screening, patientData) {
    // High priority for cancer screenings if risk factors
    if (['colonoscopy', 'mammogram', 'lungCancer'].includes(screening)) {
      if (patientData.familyHistory?.includes('cancer')) return 'high';
    }

    return 'moderate';
  }

  /**
   * Check if has risk factor
   */
  hasRiskFactor(factor, patientData) {
    const factorMap = {
      'Congestive heart failure': patientData.chf || patientData.heartFailure,
      'Hypertension': patientData.hypertension,
      'Diabetes mellitus': patientData.diabetes,
      'Previous DVT': patientData.previousDVT,
      'Active cancer': patientData.activeCancer
    };

    return factorMap[factor] || false;
  }

  /**
   * Get available calculators
   */
  getAvailableCalculators() {
    return Object.keys(this.riskCalculators).map(key => ({
      id: key,
      name: this.riskCalculators[key].name,
      purpose: this.riskCalculators[key].purpose
    }));
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      availableCalculators: Object.keys(this.riskCalculators).length,
      availableGuidelines: Object.keys(this.guidelines).length,
      availableScreenings: Object.keys(this.screeningSchedule).length
    };
  }
}

// Create and export singleton
const clinicalDecisionSupport = new ClinicalDecisionSupport();

// Register with ServiceProxy for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('clinicalDecisionSupport', () => {
    return module.exports;
  });
}

module.exports = clinicalDecisionSupport;