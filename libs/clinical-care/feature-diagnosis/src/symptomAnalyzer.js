/**
 * Symptom Analysis and Triage Service
 * Uses Gemini AI for comprehensive symptom analysis instead of hardcoded rules
 * Migrated to DDD NX architecture - Clinical Care Context - Diagnosis Feature
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class SymptomAnalyzer {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
    
    // Keep minimal fallback data for when API is unavailable
    // This is NOT for medical decisions, just basic categorization
    this.redFlags = {
      'chest pain': {
        urgency: 'critical',
        conditions: ['MI', 'PE', 'aortic dissection'],
        questions: ['radiating?', 'shortness of breath?', 'sweating?', 'duration?'],
        triageLevel: 1
      },
      'difficulty breathing': {
        urgency: 'critical',
        conditions: ['PE', 'pneumonia', 'anaphylaxis', 'asthma'],
        questions: ['sudden onset?', 'chest pain?', 'fever?', 'wheezing?'],
        triageLevel: 1
      },
      'severe headache': {
        urgency: 'high',
        conditions: ['subarachnoid hemorrhage', 'meningitis', 'migraine'],
        questions: ['sudden onset?', 'worst ever?', 'neck stiffness?', 'fever?'],
        triageLevel: 2
      },
      'altered mental status': {
        urgency: 'critical',
        conditions: ['stroke', 'hypoglycemia', 'sepsis', 'overdose'],
        questions: ['sudden onset?', 'weakness?', 'fever?', 'medications?'],
        triageLevel: 1
      },
      'severe abdominal pain': {
        urgency: 'high',
        conditions: ['appendicitis', 'perforation', 'ectopic pregnancy', 'AAA'],
        questions: ['location?', 'radiation?', 'vomiting?', 'fever?'],
        triageLevel: 2
      },
      'unilateral weakness': {
        urgency: 'critical',
        conditions: ['stroke', 'TIA'],
        questions: ['face drooping?', 'arm weakness?', 'speech difficulty?', 'time of onset?'],
        triageLevel: 1
      },
      'seizure': {
        urgency: 'high',
        conditions: ['epilepsy', 'hypoglycemia', 'withdrawal', 'eclampsia'],
        questions: ['first time?', 'duration?', 'pregnant?', 'alcohol use?'],
        triageLevel: 2
      },
      'severe bleeding': {
        urgency: 'critical',
        conditions: ['trauma', 'GI bleed', 'coagulopathy'],
        questions: ['location?', 'amount?', 'duration?', 'anticoagulants?'],
        triageLevel: 1
      }
    };

    // Common symptom patterns and their differential diagnoses
    this.symptomPatterns = {
      'fever + cough': {
        conditions: ['pneumonia', 'COVID-19', 'bronchitis', 'influenza'],
        urgency: 'moderate',
        triageLevel: 3
      },
      'fever + headache + neck stiffness': {
        conditions: ['meningitis', 'encephalitis'],
        urgency: 'critical',
        triageLevel: 1
      },
      'chest pain + shortness of breath': {
        conditions: ['MI', 'PE', 'pneumothorax'],
        urgency: 'critical',
        triageLevel: 1
      },
      'abdominal pain + vomiting': {
        conditions: ['appendicitis', 'cholecystitis', 'gastroenteritis', 'obstruction'],
        urgency: 'high',
        triageLevel: 2
      },
      'rash + fever': {
        conditions: ['meningococcemia', 'viral exanthem', 'drug reaction'],
        urgency: 'high',
        triageLevel: 2
      }
    };

    // ESI (Emergency Severity Index) triage levels
    this.triageLevels = {
      1: {
        name: 'Resuscitation',
        waitTime: 'Immediate',
        color: 'red',
        description: 'Life-threatening, requires immediate intervention'
      },
      2: {
        name: 'Emergent',
        waitTime: '10 minutes',
        color: 'orange',
        description: 'High risk, severe pain/distress'
      },
      3: {
        name: 'Urgent',
        waitTime: '30 minutes',
        color: 'yellow',
        description: 'Stable, multiple resources needed'
      },
      4: {
        name: 'Less Urgent',
        waitTime: '60 minutes',
        color: 'green',
        description: 'Stable, single resource needed'
      },
      5: {
        name: 'Non-Urgent',
        waitTime: '120 minutes',
        color: 'blue',
        description: 'Stable, no resources needed'
      }
    };

    // Pediatric-specific considerations
    this.pediatricRedFlags = [
      'lethargy', 'inconsolable crying', 'bulging fontanelle', 
      'petechial rash', 'severe dehydration', 'stridor'
    ];
  }
  
  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      
      // Authenticate service with serviceAccountManager
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('symptom-analyzer');
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'symptomAnalyzer',
        timestamp: new Date()
      }, this.getServiceContext());
      
      console.log('✅ SymptomAnalyzer initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize SymptomAnalyzer:', error);
      throw new Error(`Failed to initialize SymptomAnalyzer: ${error.message}`);
    }
  }

  /**
   * Get service context for database operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'symptom-analyzer',
      operation: 'database-access',
      practiceId: practiceId
    };
  }

  /**
   * Analyze symptoms and provide triage recommendation - now uses Gemini AI
   */
  async analyzeSymptoms(symptoms, patientData = {}) {
    try {
      // Use Gemini AI for symptom analysis
      const proxy = getServiceProxy();
      const geminiMedicalService = proxy.getService('geminiMedicalService');
      const geminiResult = await geminiMedicalService.analyzeSymptoms(symptoms, patientData);
      
      // Format the response to match expected structure
      const analysis = {
        symptoms: symptoms,
        redFlagsDetected: geminiResult.redFlags || [],
        triageLevel: this.mapUrgencyToTriageLevel(geminiResult.urgency),
        urgency: geminiResult.urgency || 'routine',
        possibleConditions: geminiResult.differentialDiagnosis || [],
        recommendedActions: geminiResult.recommendations || [],
        followUpQuestions: geminiResult.followUpQuestions || [],
        estimatedWaitTime: this.getWaitTimeForUrgency(geminiResult.urgency),
        triageCategory: this.triageLevels[this.mapUrgencyToTriageLevel(geminiResult.urgency)],
        differentialDiagnosis: geminiResult.differentialDiagnosis || [],
        primaryDifferentialDiagnoses: geminiResult.primaryDifferentialDiagnoses || [],
        secondaryDifferentialDiagnoses: geminiResult.secondaryDifferentialDiagnoses || [],
        confidenceScore: geminiResult.confidenceScore || 0.7,
        aiAnalysis: geminiResult // Keep raw AI analysis for reference
      };

      return analysis;
      
    } catch (error) {
      console.error('Gemini API error, using fallback symptom analysis:', error);
      // Fallback to basic analysis without medical decisions
      return this.basicFallbackAnalysis(symptoms, patientData);
    }
  }
  
  /**
   * Basic fallback analysis when API is unavailable
   * NO medical decisions - just data formatting
   */
  basicFallbackAnalysis(symptoms, patientData = {}) {
    return {
      symptoms: symptoms,
      redFlagsDetected: [],
      triageLevel: 3,
      urgency: 'moderate',
      possibleConditions: ['Medical evaluation required'],
      recommendedActions: ['Please consult with a healthcare provider'],
      followUpQuestions: [],
      estimatedWaitTime: 'Variable',
      triageCategory: this.triageLevels[3],
      differentialDiagnosis: ['Unable to analyze - system temporarily unavailable'],
      fallbackMode: true
    };
  }
  
  /**
   * Map Gemini urgency to triage level
   */
  mapUrgencyToTriageLevel(urgency) {
    const urgencyMap = {
      'critical': 1,
      'emergency': 1,
      'urgent': 2,
      'high': 2,
      'moderate': 3,
      'low': 4,
      'routine': 5
    };
    return urgencyMap[urgency] || 3;
  }
  
  /**
   * Get wait time for urgency level
   */
  getWaitTimeForUrgency(urgency) {
    const waitTimes = {
      'critical': 'Immediate',
      'emergency': 'Immediate',
      'urgent': '< 15 minutes',
      'high': '< 30 minutes',
      'moderate': '< 1 hour',
      'low': '< 2 hours',
      'routine': '< 4 hours'
    };
    return waitTimes[urgency] || '< 2 hours';
  }

  /**
   * Check if symptom is a red flag
   */
  checkRedFlag(symptom) {
    for (const [key, value] of Object.entries(this.redFlags)) {
      if (symptom.toLowerCase().includes(key)) {
        return {
          symptom: key,
          ...value
        };
      }
    }
    return null;
  }

  /**
   * Match symptom combination to known patterns
   */
  matchSymptomPattern(symptoms) {
    const symptomString = symptoms.join(' + ').toLowerCase();
    
    for (const [pattern, data] of Object.entries(this.symptomPatterns)) {
      const patternParts = pattern.split(' + ');
      const hasAllParts = patternParts.every(part => 
        symptoms.some(symptom => symptom.toLowerCase().includes(part))
      );
      
      if (hasAllParts) {
        return data;
      }
    }
    
    return null;
  }

  /**
   * Apply age-specific considerations
   */
  applyAgeConsiderations(analysis, age, symptoms) {
    // Pediatric considerations (< 18)
    if (age < 18) {
      symptoms.forEach(symptom => {
        if (this.pediatricRedFlags.includes(symptom.toLowerCase())) {
          analysis.triageLevel = Math.min(analysis.triageLevel, 2);
          analysis.urgency = 'high';
          analysis.recommendedActions.push('Pediatric emergency evaluation');
        }
      });
    }
    
    // Elderly considerations (> 65)
    if (age > 65) {
      // Elderly patients may present atypically
      if (symptoms.some(s => s.toLowerCase().includes('confusion'))) {
        analysis.possibleConditions.push('UTI', 'dehydration', 'medication side effect');
      }
      if (symptoms.some(s => s.toLowerCase().includes('fall'))) {
        analysis.possibleConditions.push('subdural hematoma', 'fracture');
        analysis.triageLevel = Math.min(analysis.triageLevel, 3);
      }
    }
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.triageLevel === 1) {
      recommendations.push('Call 911 immediately');
      recommendations.push('Do not drive yourself to hospital');
      recommendations.push('Prepare list of current medications');
    } else if (analysis.triageLevel === 2) {
      recommendations.push('Seek emergency care within 10 minutes');
      recommendations.push('Have someone drive you to ER');
    } else if (analysis.triageLevel === 3) {
      recommendations.push('Visit urgent care or ER within 30 minutes');
      recommendations.push('Monitor symptoms closely');
    } else if (analysis.triageLevel === 4) {
      recommendations.push('Schedule appointment with primary care');
      recommendations.push('Can wait if symptoms stable');
    } else {
      recommendations.push('Self-care measures appropriate');
      recommendations.push('Follow up if symptoms worsen');
    }
    
    return recommendations;
  }

  /**
   * Generate differential diagnosis
   */
  generateDifferential(conditions, symptoms, patientData) {
    const differential = {};
    
    // Remove duplicates and score conditions
    const uniqueConditions = [...new Set(conditions)];
    
    uniqueConditions.forEach(condition => {
      differential[condition] = {
        likelihood: this.calculateLikelihood(condition, symptoms, patientData),
        supportingSymptoms: symptoms.filter(s => this.isRelatedSymptom(s, condition)),
        missingSymptoms: this.getMissingSymptoms(condition, symptoms),
        nextSteps: this.getNextSteps(condition)
      };
    });
    
    // Sort by likelihood
    return Object.entries(differential)
      .sort((a, b) => b[1].likelihood - a[1].likelihood)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
  }

  /**
   * Calculate likelihood score for a condition
   */
  calculateLikelihood(condition, symptoms, patientData) {
    let score = 50; // Base score
    
    // Adjust based on symptom match
    const typicalSymptoms = this.getTypicalSymptoms(condition);
    const matchedSymptoms = symptoms.filter(s => 
      typicalSymptoms.some(ts => s.toLowerCase().includes(ts))
    );
    
    score += matchedSymptoms.length * 10;
    
    // Adjust for age
    if (patientData.age) {
      const ageRisk = this.getAgeRisk(condition, patientData.age);
      score += ageRisk;
    }
    
    // Cap at 95 (never 100% certain without tests)
    return Math.min(score, 95);
  }

  /**
   * Get typical symptoms for a condition
   */
  getTypicalSymptoms(condition) {
    const symptomMap = {
      'MI': ['chest pain', 'shortness of breath', 'sweating', 'nausea'],
      'PE': ['chest pain', 'shortness of breath', 'leg swelling', 'cough'],
      'pneumonia': ['fever', 'cough', 'chest pain', 'shortness of breath'],
      'appendicitis': ['abdominal pain', 'nausea', 'vomiting', 'fever'],
      'stroke': ['weakness', 'speech difficulty', 'vision changes', 'headache'],
      'meningitis': ['headache', 'fever', 'neck stiffness', 'photophobia']
    };
    
    return symptomMap[condition] || [];
  }

  /**
   * Check if symptom is related to condition
   */
  isRelatedSymptom(symptom, condition) {
    const symptoms = this.getTypicalSymptoms(condition);
    return symptoms.some(s => symptom.toLowerCase().includes(s));
  }

  /**
   * Get missing symptoms for a condition
   */
  getMissingSymptoms(condition, presentSymptoms) {
    const typical = this.getTypicalSymptoms(condition);
    return typical.filter(s => 
      !presentSymptoms.some(ps => ps.toLowerCase().includes(s))
    );
  }

  /**
   * Get next diagnostic steps
   */
  getNextSteps(condition) {
    const steps = {
      'MI': ['ECG', 'Troponin', 'Chest X-ray'],
      'PE': ['D-dimer', 'CT angiography', 'V/Q scan'],
      'pneumonia': ['Chest X-ray', 'CBC', 'Blood cultures'],
      'appendicitis': ['CBC', 'Abdominal CT', 'Ultrasound'],
      'stroke': ['CT head', 'MRI brain', 'Carotid ultrasound'],
      'meningitis': ['Lumbar puncture', 'Blood cultures', 'CT head']
    };
    
    return steps[condition] || ['Clinical evaluation'];
  }

  /**
   * Get age-specific risk adjustment
   */
  getAgeRisk(condition, age) {
    if (condition === 'MI' && age > 50) return 20;
    if (condition === 'stroke' && age > 65) return 25;
    if (condition === 'appendicitis' && age < 30) return 15;
    return 0;
  }

  /**
   * Compare urgency levels
   */
  getHigherUrgency(current, new_urgency) {
    const levels = { 'low': 1, 'moderate': 2, 'high': 3, 'critical': 4 };
    return levels[new_urgency] > levels[current] ? new_urgency : current;
  }

  /**
   * Normalize symptom descriptions
   */
  normalizeSymptoms(symptoms) {
    if (typeof symptoms === 'string') {
      symptoms = [symptoms];
    }
    
    return symptoms.map(s => s.toLowerCase().trim());
  }

  /**
   * Generate formatted report
   */
  generateReport(analysis, language = 'en') {
    const isHebrew = language === 'he';
    
    const report = {
      summary: isHebrew 
        ? `רמת דחיפות: ${analysis.triageCategory.name}` 
        : `Triage Level: ${analysis.triageCategory.name}`,
      urgency: analysis.urgency,
      waitTime: analysis.estimatedWaitTime,
      redFlags: analysis.redFlagsDetected.length > 0,
      topConditions: Object.keys(analysis.differentialDiagnosis).slice(0, 3),
      immediateAction: analysis.recommendedActions[0],
      requiresEmergency: analysis.triageLevel <= 2
    };
    
    return report;
  }
}

// Create and export singleton
const symptomAnalyzer = new SymptomAnalyzer();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('symptomAnalyzer', () => symptomAnalyzer);
}

module.exports = symptomAnalyzer;