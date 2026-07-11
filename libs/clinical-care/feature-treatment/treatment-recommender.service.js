/**
 * 💊 TREATMENT RECOMMENDER SERVICE
 * 
 * Evidence-based treatment recommendation system providing clinical decision
 * support with medication protocols, patient-specific adjustments, and
 * comprehensive monitoring guidelines for optimal patient care.
 * 
 * FEATURES: Evidence-based protocols, contraindication checking, dose adjustments
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

class TreatmentRecommenderService {
  constructor() {
    this.serviceId = 'treatment-recommender';
    this.serviceToken = null;
    this.initialized = false;
    
    // Evidence-based treatment protocols
    this.treatmentProtocols = {
      // Cardiovascular
      'hypertension': {
        firstLine: [
          { drug: 'lisinopril', class: 'ACE-I', dose: '10mg daily', monitoring: 'K+, Cr' },
          { drug: 'amlodipine', class: 'CCB', dose: '5mg daily', monitoring: 'BP, edema' },
          { drug: 'hydrochlorothiazide', class: 'diuretic', dose: '25mg daily', monitoring: 'K+, Na+' }
        ],
        secondLine: [
          { drug: 'losartan', class: 'ARB', dose: '50mg daily', monitoring: 'K+, Cr' },
          { drug: 'metoprolol', class: 'BB', dose: '50mg BID', monitoring: 'HR, BP' }
        ],
        lifestyle: ['Low sodium diet', 'Exercise 30min/day', 'Weight loss', 'Limit alcohol'],
        targets: { systolic: '<130', diastolic: '<80' }
      },
      
      'diabetes_type2': {
        firstLine: [
          { drug: 'metformin', class: 'biguanide', dose: '500mg BID', monitoring: 'Cr, B12' }
        ],
        secondLine: [
          { drug: 'glipizide', class: 'sulfonylurea', dose: '5mg daily', monitoring: 'glucose' },
          { drug: 'sitagliptin', class: 'DPP-4', dose: '100mg daily', monitoring: 'glucose' },
          { drug: 'empagliflozin', class: 'SGLT2', dose: '10mg daily', monitoring: 'Cr, UTI' }
        ],
        lifestyle: ['Carb counting', 'Exercise', 'Weight loss', 'Glucose monitoring'],
        targets: { HbA1c: '<7%', fasting: '80-130', postprandial: '<180' }
      },
      
      // Respiratory
      'asthma': {
        controller: [
          { drug: 'budesonide', class: 'ICS', dose: '180mcg BID', monitoring: 'PFT' },
          { drug: 'fluticasone/salmeterol', class: 'ICS/LABA', dose: '250/50 BID', monitoring: 'PFT' }
        ],
        rescue: [
          { drug: 'albuterol', class: 'SABA', dose: '2 puffs PRN', monitoring: 'usage frequency' }
        ],
        lifestyle: ['Avoid triggers', 'Peak flow monitoring', 'Action plan'],
        targets: { control: 'ACT>20', exacerbations: '<2/year' }
      },
      
      'pneumonia_community': {
        outpatient: [
          { drug: 'amoxicillin', class: 'penicillin', dose: '1g TID', duration: '5-7 days' },
          { drug: 'azithromycin', class: 'macrolide', dose: '500mg x1, then 250mg', duration: '5 days' }
        ],
        inpatient: [
          { drug: 'ceftriaxone', class: 'cephalosporin', dose: '1g daily', duration: '7-10 days' },
          { drug: 'levofloxacin', class: 'fluoroquinolone', dose: '750mg daily', duration: '5 days' }
        ],
        supportive: ['Oxygen if SpO2<92%', 'Fluids', 'Antipyretics'],
        monitoring: ['Chest X-ray', 'CBC', 'O2 saturation']
      },
      
      // GI
      'gerd': {
        firstLine: [
          { drug: 'omeprazole', class: 'PPI', dose: '20mg daily', duration: '8 weeks' },
          { drug: 'esomeprazole', class: 'PPI', dose: '40mg daily', duration: '8 weeks' }
        ],
        secondLine: [
          { drug: 'ranitidine', class: 'H2RA', dose: '150mg BID', duration: 'ongoing' }
        ],
        lifestyle: ['Elevate head of bed', 'Avoid triggers', 'Weight loss', 'Small meals'],
        redFlags: ['Dysphagia', 'Weight loss', 'Anemia', 'Age >50 new onset']
      },
      
      // Musculoskeletal
      'osteoarthritis': {
        firstLine: [
          { drug: 'acetaminophen', class: 'analgesic', dose: '650mg QID', maxDose: '3g/day' },
          { drug: 'topical diclofenac', class: 'NSAID', dose: '1% gel QID', monitoring: 'renal' }
        ],
        secondLine: [
          { drug: 'ibuprofen', class: 'NSAID', dose: '400mg TID', monitoring: 'GI, renal' },
          { drug: 'celecoxib', class: 'COX-2', dose: '200mg daily', monitoring: 'CV risk' }
        ],
        nonPharm: ['Physical therapy', 'Weight loss', 'Exercise', 'Heat/cold'],
        injections: ['Corticosteroid', 'Hyaluronic acid']
      },
      
      // Infections
      'uti_uncomplicated': {
        firstLine: [
          { drug: 'nitrofurantoin', class: 'antibiotic', dose: '100mg BID', duration: '5 days' },
          { drug: 'trimethoprim-sulfamethoxazole', class: 'antibiotic', dose: 'DS BID', duration: '3 days' }
        ],
        secondLine: [
          { drug: 'ciprofloxacin', class: 'fluoroquinolone', dose: '250mg BID', duration: '3 days' }
        ],
        supportive: ['Increase fluids', 'Cranberry products', 'Void after intercourse'],
        followUp: ['Urine culture if recurrent', 'Post-treatment UA if symptoms persist']
      },
      
      // Mental Health
      'depression_major': {
        firstLine: [
          { drug: 'sertraline', class: 'SSRI', dose: '50mg daily', titration: 'increase by 50mg q1-2wk' },
          { drug: 'escitalopram', class: 'SSRI', dose: '10mg daily', titration: 'increase to 20mg' }
        ],
        secondLine: [
          { drug: 'venlafaxine', class: 'SNRI', dose: '37.5mg BID', titration: 'increase by 75mg/wk' },
          { drug: 'bupropion', class: 'NDRI', dose: '150mg daily', titration: 'increase to 300mg' }
        ],
        nonPharm: ['CBT', 'Exercise', 'Sleep hygiene', 'Mindfulness'],
        monitoring: ['PHQ-9 q2-4wk', 'Suicide risk', 'Side effects']
      },
      
      'anxiety_generalized': {
        firstLine: [
          { drug: 'escitalopram', class: 'SSRI', dose: '10mg daily', duration: 'long-term' },
          { drug: 'sertraline', class: 'SSRI', dose: '25mg daily', titration: 'increase weekly' }
        ],
        acute: [
          { drug: 'lorazepam', class: 'benzodiazepine', dose: '0.5mg PRN', caution: 'dependence risk' }
        ],
        nonPharm: ['CBT', 'Relaxation techniques', 'Exercise', 'Avoid caffeine'],
        monitoring: ['GAD-7', 'Substance use', 'Sleep']
      }
    };

    // Contraindications database
    this.contraindications = {
      'ACE-I': ['pregnancy', 'angioedema history', 'bilateral renal artery stenosis'],
      'NSAID': ['GI bleed history', 'severe renal disease', 'anticoagulation'],
      'metformin': ['eGFR<30', 'acute illness', 'contrast dye procedure'],
      'SSRI': ['MAOI use', 'bleeding disorder', 'bipolar (without mood stabilizer)']
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      await this.logAuditEvent('SERVICE_INITIALIZED', 'global');
      this.initialized = true;
      console.log('✅ Treatment Recommender Service initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize Treatment Recommender Service:', error);
      throw error;
    }
  }

  // Helper methods for service access - CRITICAL for treatment recommendation operations
  getSecureDataAccess() {
    return getServiceProxy().getService('secureDataAccess');
  }

  getGeminiMedicalService() {
    return getServiceProxy().getService('geminiMedicalService');
  }

  getDrugInteractionService() {
    return getServiceProxy().getService('drugInteractionService');
  }

  async logAuditEvent(action, practiceId, details = {}) {
    try {
      const auditEntry = {
        action,
        service: this.serviceId,
        timestamp: new Date(),
        details
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'audit-logging',
        practiceId
      };

      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create('audit_logs', auditEntry, context);
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  async recommendTreatment(condition, patientData = {}, practiceId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const recommendations = {
        condition: condition,
        medications: [],
        nonPharmacological: [],
        monitoring: [],
        contraindications: [],
        alternatives: [],
        followUp: '2-4 weeks',
        referrals: []
      };

      // Normalize condition name
      const normalizedCondition = this.normalizeCondition(condition);
      
      // Get protocol if available
      const protocol = this.treatmentProtocols[normalizedCondition];
      
      if (!protocol) {
        const genericRecommendations = this.getGenericRecommendations(condition);
        await this.logAuditEvent('GENERIC_RECOMMENDATIONS_GENERATED', practiceId, { condition });
        return genericRecommendations;
      }

      // Select medications based on patient factors
      recommendations.medications = this.selectMedications(protocol, patientData);

      // Add non-pharmacological treatments
      if (protocol.lifestyle) {
        recommendations.nonPharmacological = [...protocol.lifestyle];
      }
      if (protocol.nonPharm) {
        recommendations.nonPharmacological.push(...protocol.nonPharm);
      }

      // Add monitoring requirements
      recommendations.monitoring = this.getMonitoringRequirements(
        recommendations.medications,
        protocol
      );

      // Check contraindications
      recommendations.contraindications = this.checkContraindications(
        recommendations.medications,
        patientData
      );

      // Get alternatives if contraindications exist
      if (recommendations.contraindications.length > 0) {
        recommendations.alternatives = this.getAlternatives(
          protocol,
          recommendations.contraindications
        );
      }

      // Add treatment targets
      if (protocol.targets) {
        recommendations.targets = protocol.targets;
      }

      // Determine follow-up and referrals
      recommendations.followUp = this.determineFollowUp(normalizedCondition, patientData);
      recommendations.referrals = this.determineReferrals(normalizedCondition, patientData);

      // Save recommendation to database
      const recommendationRecord = {
        condition,
        patientId: patientData.patientId,
        recommendations,
        timestamp: new Date(),
        providerId: patientData.providerId
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'save-treatment-recommendation',
        practiceId
      };

      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create('treatment_recommendations', recommendationRecord, context);

      await this.logAuditEvent('TREATMENT_RECOMMENDED', practiceId, { 
        condition, 
        medicationCount: recommendations.medications.length 
      });

      return recommendations;
    } catch (error) {
      console.error('Failed to recommend treatment:', error);
      throw error;
    }
  }

  selectMedications(protocol, patientData) {
    const selected = [];
    
    // Start with first-line unless contraindicated
    if (protocol.firstLine) {
      const firstLine = protocol.firstLine[0];
      
      // Check if suitable for patient
      if (this.isSuitableForPatient(firstLine, patientData)) {
        selected.push(this.adjustDoseForPatient(firstLine, patientData));
      } else if (protocol.secondLine) {
        // Try second-line if first-line not suitable
        const secondLine = protocol.secondLine[0];
        if (this.isSuitableForPatient(secondLine, patientData)) {
          selected.push(this.adjustDoseForPatient(secondLine, patientData));
        }
      }
    }

    // Add rescue/acute medications if available
    if (protocol.rescue) {
      selected.push(...protocol.rescue);
    }
    if (protocol.acute) {
      selected.push(...protocol.acute);
    }
    if (protocol.controller) {
      selected.push(...protocol.controller);
    }

    return selected;
  }

  isSuitableForPatient(medication, patientData) {
    // Check age restrictions
    if (patientData.age) {
      if (patientData.age < 18 && medication.drug === 'ciprofloxacin') return false;
      if (patientData.age > 65 && medication.class === 'benzodiazepine') return false;
    }

    // Check pregnancy
    if (patientData.pregnant && medication.class === 'ACE-I') return false;

    // Check renal function
    if (patientData.eGFR && patientData.eGFR < 30) {
      if (['metformin', 'NSAID'].includes(medication.drug)) return false;
    }

    // Check allergies
    if (patientData.allergies) {
      const allergies = patientData.allergies.map(a => a.toLowerCase());
      if (allergies.includes(medication.drug.toLowerCase())) return false;
      if (allergies.includes(medication.class.toLowerCase())) return false;
    }

    return true;
  }

  adjustDoseForPatient(medication, patientData) {
    const adjusted = { ...medication };
    
    // Age adjustments
    if (patientData.age) {
      if (patientData.age > 75) {
        // Reduce dose for elderly
        if (medication.drug === 'lisinopril') {
          adjusted.dose = '5mg daily';
          adjusted.note = 'Reduced dose for elderly';
        }
      }
      if (patientData.age < 12) {
        // Pediatric dosing
        if (patientData.weight) {
          adjusted.dose = this.calculatePediatricDose(medication, patientData.weight);
          adjusted.note = 'Pediatric weight-based dosing';
        }
      }
    }

    // Renal adjustments
    if (patientData.eGFR && patientData.eGFR < 60) {
      if (medication.drug === 'metformin') {
        adjusted.dose = '500mg daily';
        adjusted.note = 'Reduced dose for renal impairment';
      }
    }

    // Hepatic adjustments
    if (patientData.hepaticImpairment) {
      if (medication.class === 'statin') {
        adjusted.dose = this.reduceStatinDose(medication.dose);
        adjusted.note = 'Reduced dose for hepatic impairment';
      }
    }

    return adjusted;
  }

  calculatePediatricDose(medication, weightKg) {
    const pediatricDoses = {
      'amoxicillin': `${Math.round(weightKg * 25)}mg TID`,
      'ibuprofen': `${Math.round(weightKg * 10)}mg TID`,
      'acetaminophen': `${Math.round(weightKg * 15)}mg QID`
    };
    
    return pediatricDoses[medication.drug] || medication.dose;
  }

  getMonitoringRequirements(medications, protocol) {
    const monitoring = new Set();
    
    // Add medication-specific monitoring
    medications.forEach(med => {
      if (med.monitoring) {
        med.monitoring.split(',').forEach(m => monitoring.add(m.trim()));
      }
    });

    // Add protocol-specific monitoring
    if (protocol.monitoring) {
      protocol.monitoring.forEach(m => monitoring.add(m));
    }

    // Add class-specific monitoring
    medications.forEach(med => {
      if (med.class === 'ACE-I' || med.class === 'ARB') {
        monitoring.add('Potassium');
        monitoring.add('Creatinine');
      }
      if (med.class === 'statin') {
        monitoring.add('LFTs');
        monitoring.add('CPK if muscle symptoms');
      }
      if (med.class === 'SSRI') {
        monitoring.add('Mood/suicidality');
      }
    });

    return Array.from(monitoring);
  }

  checkContraindications(medications, patientData) {
    const issues = [];
    
    medications.forEach(med => {
      const classContraindications = this.contraindications[med.class] || [];
      
      classContraindications.forEach(contraindication => {
        if (this.hasContraindication(contraindication, patientData)) {
          issues.push({
            medication: med.drug,
            issue: contraindication,
            severity: 'high'
          });
        }
      });
    });
    
    return issues;
  }

  hasContraindication(contraindication, patientData) {
    if (contraindication === 'pregnancy' && patientData.pregnant) return true;
    if (contraindication === 'GI bleed history' && patientData.history?.includes('GI bleed')) return true;
    if (contraindication === 'eGFR<30' && patientData.eGFR < 30) return true;
    return false;
  }

  getAlternatives(protocol, contraindications) {
    const alternatives = [];
    
    // Try second-line options
    if (protocol.secondLine) {
      protocol.secondLine.forEach(med => {
        const suitable = !contraindications.some(c => 
          c.medication === med.drug
        );
        if (suitable) {
          alternatives.push(med);
        }
      });
    }
    
    return alternatives;
  }

  determineFollowUp(condition, patientData) {
    // Acute conditions need sooner follow-up
    const acuteConditions = ['pneumonia', 'uti', 'cellulitis'];
    if (acuteConditions.some(c => condition.includes(c))) {
      return '48-72 hours if not improving';
    }
    
    // New chronic disease diagnosis
    const chronicConditions = ['diabetes', 'hypertension', 'depression'];
    if (chronicConditions.some(c => condition.includes(c))) {
      return '2-4 weeks';
    }
    
    return '4-6 weeks or as needed';
  }

  determineReferrals(condition, patientData) {
    const referrals = [];
    
    // Condition-specific referrals
    if (condition.includes('diabetes')) {
      referrals.push('Endocrinology if HbA1c >9%');
      referrals.push('Ophthalmology annual exam');
      referrals.push('Podiatry if neuropathy');
    }
    
    if (condition.includes('depression') && patientData.severity === 'severe') {
      referrals.push('Psychiatry for severe depression');
    }
    
    if (condition.includes('asthma') && patientData.control === 'poor') {
      referrals.push('Pulmonology for uncontrolled asthma');
    }
    
    return referrals;
  }

  normalizeCondition(condition) {
    return condition.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w_]/g, '');
  }

  getGenericRecommendations(condition) {
    return {
      condition: condition,
      medications: [],
      nonPharmacological: [
        'Rest as needed',
        'Stay hydrated',
        'Healthy diet',
        'Regular exercise as tolerated'
      ],
      monitoring: ['Symptom progression', 'Response to treatment'],
      followUp: '1-2 weeks if not improving',
      referrals: ['Specialist evaluation if symptoms persist'],
      note: 'No specific protocol available - general supportive care recommended'
    };
  }

  reduceStatinDose(originalDose) {
    const doseValue = parseInt(originalDose);
    return `${Math.floor(doseValue / 2)}mg daily`;
  }

  async generateSummary(recommendations, language = 'en', practiceId) {
    try {
      const isHebrew = language === 'he';
      
      const summary = {
        primaryMedication: recommendations.medications[0] || null,
        totalMedications: recommendations.medications.length,
        hasContraindications: recommendations.contraindications.length > 0,
        requiresMonitoring: recommendations.monitoring.length > 0,
        lifestyleChanges: recommendations.nonPharmacological.length,
        followUpRequired: recommendations.followUp,
        specialistReferral: recommendations.referrals.length > 0,
        generatedAt: new Date()
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'save-treatment-summary',
        practiceId
      };

      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create('treatment_summaries', summary, context);
      
      return summary;
    } catch (error) {
      console.error('Failed to generate treatment summary:', error);
      throw error;
    }
  }

  getServiceStatus() {
    return {
      initialized: this.initialized,
      protocolsLoaded: Object.keys(this.treatmentProtocols).length,
      contraindicationsLoaded: Object.keys(this.contraindications).length,
      serviceId: this.serviceId
    };
  }
}

// Create and export singleton instance
const treatmentRecommenderService = new TreatmentRecommenderService();

// Register service with proxy manager - CRITICAL for treatment recommendations
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('treatmentRecommenderService', () => treatmentRecommenderService);
}

module.exports = treatmentRecommenderService;