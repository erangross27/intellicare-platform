// Migrated to DDD NX architecture - Clinical Care Context - Diagnosis Feature
// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

const crypto = require('crypto');

class DiagnosisSupportService {
  constructor() {
    this.serviceId = 'diagnosis-support-service';
    this.serviceToken = null;
    this.initialized = false;
    this.icd10Database = new Map();
    this.symptomOntology = new Map();
    this.differentialCache = new Map();
    this.confidenceThresholds = {
      high: 0.85,
      medium: 0.60,
      low: 0.30
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      await this.loadMedicalDatabases();
      this.initialized = true;
      console.log('✅ DiagnosisSupportService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize DiagnosisSupportService:', error);
      throw error;
    }
  }

  async loadMedicalDatabases() {
    try {
      const icd10Data = await SecureDataAccess.query(
        'icd10_codes',
        { active: true },
        { limit: 50000 },
        { 
          serviceId: this.serviceId, 
          operation: 'load-icd10-codes',
          practiceId: 'global' 
        }
      );

      const symptomData = await SecureDataAccess.query(
        'symptom_ontology',
        { active: true },
        { limit: 10000 },
        { 
          serviceId: this.serviceId, 
          operation: 'load-symptom-ontology',
          practiceId: 'global' 
        }
      );

      icd10Data.forEach(code => {
        this.icd10Database.set(code.code, {
          description: code.description,
          category: code.category,
          symptoms: code.associatedSymptoms || [],
          riskFactors: code.riskFactors || [],
          diagnosticCriteria: code.diagnosticCriteria || []
        });
      });

      symptomData.forEach(symptom => {
        this.symptomOntology.set(symptom.id, {
          name: symptom.name,
          synonyms: symptom.synonyms || [],
          category: symptom.category,
          severity: symptom.severity,
          associatedConditions: symptom.associatedConditions || []
        });
      });
    } catch (error) {
      console.error('Failed to load medical databases:', error);
      this.icd10Database = new Map();
      this.symptomOntology = new Map();
    }
  }

  async generateDifferentialDiagnosis(symptomData, patientHistory, context) {
    await this.initialize();

    try {
      const {
        patientId,
        symptoms,
        duration,
        severity,
        onset,
        aggravatingFactors,
        relievingFactors,
        associatedSymptoms
      } = symptomData;

      const patient = await SecureDataAccess.findOne(
        'patients',
        { _id: patientId },
        { 
          serviceId: this.serviceId, 
          operation: 'get-patient-for-diagnosis',
          practiceId: context.practiceId 
        }
      );

      if (!patient) {
        throw new Error('Patient not found');
      }

      const cacheKey = this.generateCacheKey(symptoms, patient.age, patient.gender);
      if (this.differentialCache.has(cacheKey)) {
        const cached = this.differentialCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 3600000) {
          return cached.data;
        }
      }

      const normalizedSymptoms = this.normalizeSymptoms(symptoms);
      const patientContext = this.buildPatientContext(patient, patientHistory);

      const aiPrompt = this.buildDiagnosisPrompt(
        normalizedSymptoms,
        patientContext,
        { duration, severity, onset, aggravatingFactors, relievingFactors, associatedSymptoms }
      );

      const aiResponse = await geminiMedicalService.generateMedicalResponse(aiPrompt, {
        temperature: 0.3,
        maxTokens: 2000,
        responseType: 'differential_diagnosis'
      });

      const differentialList = this.parseDifferentialDiagnosis(aiResponse);
      
      const rankedDiagnoses = await this.rankDiagnoses(
        differentialList,
        normalizedSymptoms,
        patientContext
      );

      const enrichedDiagnoses = await this.enrichWithEvidence(rankedDiagnoses);

      const diagnosticPlan = await this.suggestDiagnosticTests(
        enrichedDiagnoses.slice(0, 3),
        patientContext
      );

      const differentialResult = {
        differentialId: crypto.randomBytes(16).toString('hex'),
        patientId,
        symptoms: normalizedSymptoms,
        diagnoses: enrichedDiagnoses,
        diagnosticPlan,
        confidence: this.calculateOverallConfidence(enrichedDiagnoses),
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      await SecureDataAccess.create(
        'differential_diagnoses',
        differentialResult,
        { 
          serviceId: this.serviceId, 
          operation: 'create-differential-diagnosis',
          practiceId: context.practiceId 
        }
      );

      this.differentialCache.set(cacheKey, {
        data: differentialResult,
        timestamp: Date.now()
      });

      await AuditLog.create({
        action: 'DIFFERENTIAL_DIAGNOSIS_GENERATED',
        category: 'clinical',
        patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: {
          differentialId: differentialResult.differentialId,
          topDiagnosis: enrichedDiagnoses[0]?.icd10Code,
          confidence: differentialResult.confidence
        },
        timestamp: new Date()
      });

      return differentialResult;
    } catch (error) {
      console.error('Failed to generate differential diagnosis:', error);
      throw error;
    }
  }

  normalizeSymptoms(symptoms) {
    return symptoms.map(symptom => {
      const normalized = {
        original: symptom,
        standardized: null,
        category: null,
        severity: null
      };

      for (const [id, ontologyEntry] of this.symptomOntology) {
        if (
          ontologyEntry.name.toLowerCase() === symptom.toLowerCase() ||
          ontologyEntry.synonyms.some(syn => syn.toLowerCase() === symptom.toLowerCase())
        ) {
          normalized.standardized = ontologyEntry.name;
          normalized.category = ontologyEntry.category;
          normalized.severity = ontologyEntry.severity;
          break;
        }
      }

      if (!normalized.standardized) {
        normalized.standardized = symptom;
        normalized.category = 'unclassified';
      }

      return normalized;
    });
  }

  buildPatientContext(patient, history) {
    const age = this.calculateAge(patient.dateOfBirth);
    
    return {
      demographics: {
        age,
        ageGroup: this.getAgeGroup(age),
        gender: patient.gender,
        ethnicity: patient.ethnicity
      },
      medicalHistory: {
        chronicConditions: history?.chronicConditions || [],
        surgeries: history?.surgeries || [],
        allergies: patient.allergies || [],
        medications: history?.currentMedications || [],
        familyHistory: history?.familyHistory || []
      },
      riskFactors: this.identifyRiskFactors(patient, history),
      vitals: history?.recentVitals || {}
    };
  }

  calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  getAgeGroup(age) {
    if (age < 2) return 'infant';
    if (age < 12) return 'child';
    if (age < 18) return 'adolescent';
    if (age < 65) return 'adult';
    return 'elderly';
  }

  identifyRiskFactors(patient, history) {
    const riskFactors = [];

    const bmi = this.calculateBMI(patient.height, patient.weight);
    if (bmi > 30) riskFactors.push('obesity');
    if (bmi < 18.5) riskFactors.push('underweight');

    if (history?.smoking) riskFactors.push('smoking');
    if (history?.alcohol === 'heavy') riskFactors.push('alcohol_use');
    if (history?.sedentary) riskFactors.push('sedentary_lifestyle');

    if (history?.familyHistory?.some(h => h.includes('diabetes'))) {
      riskFactors.push('family_history_diabetes');
    }
    if (history?.familyHistory?.some(h => h.includes('heart'))) {
      riskFactors.push('family_history_cardiac');
    }

    return riskFactors;
  }

  calculateBMI(height, weight) {
    if (!height || !weight) return null;
    const heightInMeters = height / 100;
    return weight / (heightInMeters * heightInMeters);
  }

  buildDiagnosisPrompt(symptoms, patientContext, additionalInfo) {
    return `
      As a medical diagnostic AI, analyze the following case and provide a differential diagnosis:

      PATIENT PROFILE:
      - Age: ${patientContext.demographics.age} years (${patientContext.demographics.ageGroup})
      - Gender: ${patientContext.demographics.gender}
      - Chronic Conditions: ${patientContext.medicalHistory.chronicConditions.join(', ') || 'None'}
      - Current Medications: ${patientContext.medicalHistory.medications.join(', ') || 'None'}
      - Risk Factors: ${patientContext.riskFactors.join(', ') || 'None identified'}

      PRESENTING SYMPTOMS:
      ${symptoms.map(s => `- ${s.standardized} (${s.category})`).join('\n')}

      SYMPTOM DETAILS:
      - Duration: ${additionalInfo.duration}
      - Severity: ${additionalInfo.severity}
      - Onset: ${additionalInfo.onset}
      - Aggravating Factors: ${additionalInfo.aggravatingFactors || 'None reported'}
      - Relieving Factors: ${additionalInfo.relievingFactors || 'None reported'}
      - Associated Symptoms: ${additionalInfo.associatedSymptoms?.join(', ') || 'None'}

      Please provide:
      1. Top 5-7 differential diagnoses with ICD-10 codes
      2. For each diagnosis, provide:
         - Probability/confidence score (0-1)
         - Key supporting evidence from the presentation
         - Red flags or concerning features to monitor
      3. Recommended diagnostic tests to confirm or rule out diagnoses
      4. Immediate management considerations if applicable

      Format the response as structured JSON for processing.
    `;
  }

  parseDifferentialDiagnosis(aiResponse) {
    try {
      const parsed = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;
      
      return parsed.diagnoses.map(dx => ({
        icd10Code: dx.icd10Code,
        name: dx.name,
        probability: dx.probability || 0.5,
        supportingEvidence: dx.supportingEvidence || [],
        redFlags: dx.redFlags || [],
        differentiatingFeatures: dx.differentiatingFeatures || []
      }));
    } catch (error) {
      console.error('Failed to parse AI differential diagnosis:', error);
      return [];
    }
  }

  async rankDiagnoses(diagnoses, symptoms, patientContext) {
    const rankedDiagnoses = diagnoses.map(diagnosis => {
      let score = diagnosis.probability;

      const icd10Entry = this.icd10Database.get(diagnosis.icd10Code);
      if (icd10Entry) {
        const symptomMatch = this.calculateSymptomMatch(
          symptoms.map(s => s.standardized),
          icd10Entry.symptoms
        );
        score = (score * 0.7) + (symptomMatch * 0.3);

        const riskFactorBonus = this.calculateRiskFactorBonus(
          patientContext.riskFactors,
          icd10Entry.riskFactors
        );
        score += riskFactorBonus * 0.1;
      }

      const ageAppropriateness = this.assessAgeAppropriateness(
        diagnosis.icd10Code,
        patientContext.demographics.ageGroup
      );
      score *= ageAppropriateness;

      return {
        ...diagnosis,
        confidenceScore: Math.min(score, 1.0),
        confidenceLevel: this.getConfidenceLevel(score)
      };
    });

    return rankedDiagnoses.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  calculateSymptomMatch(patientSymptoms, conditionSymptoms) {
    if (!conditionSymptoms || conditionSymptoms.length === 0) return 0.5;

    const matches = patientSymptoms.filter(symptom =>
      conditionSymptoms.some(cs => 
        cs.toLowerCase().includes(symptom.toLowerCase()) ||
        symptom.toLowerCase().includes(cs.toLowerCase())
      )
    );

    return matches.length / Math.max(patientSymptoms.length, conditionSymptoms.length);
  }

  calculateRiskFactorBonus(patientRiskFactors, conditionRiskFactors) {
    if (!conditionRiskFactors || conditionRiskFactors.length === 0) return 0;

    const matches = patientRiskFactors.filter(rf =>
      conditionRiskFactors.includes(rf)
    );

    return matches.length / conditionRiskFactors.length;
  }

  assessAgeAppropriateness(icd10Code, ageGroup) {
    const pediatricConditions = ['J12', 'J13', 'J20', 'K59.0'];
    const geriatricConditions = ['I50', 'N39.0', 'F03', 'M80'];

    if (pediatricConditions.some(code => icd10Code.startsWith(code))) {
      return ageGroup === 'infant' || ageGroup === 'child' ? 1.2 : 0.6;
    }

    if (geriatricConditions.some(code => icd10Code.startsWith(code))) {
      return ageGroup === 'elderly' ? 1.2 : 0.7;
    }

    return 1.0;
  }

  getConfidenceLevel(score) {
    if (score >= this.confidenceThresholds.high) return 'high';
    if (score >= this.confidenceThresholds.medium) return 'medium';
    if (score >= this.confidenceThresholds.low) return 'low';
    return 'very_low';
  }

  async enrichWithEvidence(diagnoses) {
    const enriched = [];

    for (const diagnosis of diagnoses) {
      const icd10Entry = this.icd10Database.get(diagnosis.icd10Code);
      
      const clinicalGuidelines = await this.fetchClinicalGuidelines(diagnosis.icd10Code);
      
      enriched.push({
        ...diagnosis,
        description: icd10Entry?.description || diagnosis.name,
        diagnosticCriteria: icd10Entry?.diagnosticCriteria || [],
        clinicalGuidelines,
        evidenceLevel: this.determineEvidenceLevel(clinicalGuidelines),
        workupRecommendations: this.generateWorkupRecommendations(diagnosis)
      });
    }

    return enriched;
  }

  async fetchClinicalGuidelines(icd10Code) {
    try {
      const guidelines = await SecureDataAccess.query(
        'clinical_guidelines',
        { icd10Code, active: true },
        { limit: 5 },
        { 
          serviceId: this.serviceId, 
          operation: 'fetch-clinical-guidelines',
          practiceId: 'global'
        }
      );

      return guidelines.map(g => ({
        source: g.source,
        title: g.title,
        recommendationLevel: g.recommendationLevel,
        keyPoints: g.keyPoints || [],
        lastUpdated: g.lastUpdated
      }));
    } catch (error) {
      console.error('Failed to fetch clinical guidelines:', error);
      return [];
    }
  }

  determineEvidenceLevel(guidelines) {
    if (!guidelines || guidelines.length === 0) return 'expert_opinion';

    const levels = guidelines.map(g => g.recommendationLevel);
    if (levels.includes('1A') || levels.includes('1B')) return 'high';
    if (levels.includes('2A') || levels.includes('2B')) return 'moderate';
    if (levels.includes('2C')) return 'low';
    return 'very_low';
  }

  generateWorkupRecommendations(diagnosis) {
    const recommendations = [];

    const commonTests = {
      cardiac: ['ECG', 'Troponin', 'BNP', 'Echocardiogram', 'Stress test'],
      respiratory: ['Chest X-ray', 'CT chest', 'Spirometry', 'ABG', 'D-dimer'],
      gastrointestinal: ['CBC', 'LFTs', 'Lipase', 'Abdominal CT', 'Endoscopy'],
      neurological: ['Head CT', 'MRI brain', 'EEG', 'Lumbar puncture', 'Nerve conduction'],
      infectious: ['CBC with diff', 'Blood cultures', 'Urinalysis', 'CRP', 'Procalcitonin'],
      metabolic: ['BMP', 'HbA1c', 'TSH', 'Lipid panel', 'Uric acid']
    };

    const category = this.categorizeCondition(diagnosis.icd10Code);
    if (commonTests[category]) {
      recommendations.push(...commonTests[category].slice(0, 3));
    }

    return recommendations;
  }

  categorizeCondition(icd10Code) {
    if (icd10Code.startsWith('I')) return 'cardiac';
    if (icd10Code.startsWith('J')) return 'respiratory';
    if (icd10Code.startsWith('K')) return 'gastrointestinal';
    if (icd10Code.startsWith('G')) return 'neurological';
    if (icd10Code.startsWith('A') || icd10Code.startsWith('B')) return 'infectious';
    if (icd10Code.startsWith('E')) return 'metabolic';
    return 'general';
  }

  async suggestDiagnosticTests(topDiagnoses, patientContext) {
    const testRecommendations = {
      immediate: [],
      routine: [],
      conditional: []
    };

    for (const diagnosis of topDiagnoses) {
      const urgency = this.assessUrgency(diagnosis);
      const tests = diagnosis.workupRecommendations || [];

      tests.forEach(test => {
        const testPriority = this.prioritizeTest(test, diagnosis, urgency);
        
        if (testPriority === 'immediate' && !testRecommendations.immediate.includes(test)) {
          testRecommendations.immediate.push(test);
        } else if (testPriority === 'routine' && !testRecommendations.routine.includes(test)) {
          testRecommendations.routine.push(test);
        } else if (!testRecommendations.conditional.includes(test)) {
          testRecommendations.conditional.push(test);
        }
      });
    }

    return {
      immediate: testRecommendations.immediate.slice(0, 3),
      routine: testRecommendations.routine.slice(0, 5),
      conditional: testRecommendations.conditional.slice(0, 3),
      rationale: this.generateTestRationale(topDiagnoses)
    };
  }

  assessUrgency(diagnosis) {
    const urgentConditions = ['I21', 'I63', 'J80', 'K92', 'G93'];
    
    if (diagnosis.redFlags && diagnosis.redFlags.length > 0) return 'high';
    if (urgentConditions.some(code => diagnosis.icd10Code.startsWith(code))) return 'high';
    if (diagnosis.confidenceScore > 0.8) return 'medium';
    return 'low';
  }

  prioritizeTest(test, diagnosis, urgency) {
    const immediateTests = ['ECG', 'Troponin', 'Head CT', 'ABG', 'Blood cultures'];
    
    if (urgency === 'high' && immediateTests.includes(test)) return 'immediate';
    if (diagnosis.confidenceScore > 0.7) return 'routine';
    return 'conditional';
  }

  generateTestRationale(diagnoses) {
    return diagnoses.slice(0, 2).map(dx => ({
      diagnosis: dx.name,
      tests: dx.workupRecommendations?.slice(0, 2) || [],
      purpose: `Confirm or exclude ${dx.name} based on clinical presentation`
    }));
  }

  calculateOverallConfidence(diagnoses) {
    if (diagnoses.length === 0) return 0;
    
    const topDiagnosis = diagnoses[0];
    const secondDiagnosis = diagnoses[1];
    
    if (!secondDiagnosis) return topDiagnosis.confidenceScore;
    
    const separation = topDiagnosis.confidenceScore - secondDiagnosis.confidenceScore;
    const adjustedConfidence = topDiagnosis.confidenceScore * (1 + separation);
    
    return Math.min(adjustedConfidence, 1.0);
  }

  generateCacheKey(symptoms, age, gender) {
    const symptomString = symptoms.sort().join(',');
    return crypto
      .createHash('sha256')
      .update(`${symptomString}-${age}-${gender}`)
      .digest('hex');
  }

  async updateDiagnosisConfidence(differentialId, newEvidence, context) {
    await this.initialize();

    try {
      const differential = await SecureDataAccess.findOne(
        'differential_diagnoses',
        { differentialId },
        { 
          serviceId: this.serviceId, 
          operation: 'get-differential-diagnosis',
          practiceId: context.practiceId 
        }
      );

      if (!differential) {
        throw new Error('Differential diagnosis not found');
      }

      const { testResults, clinicalFindings, treatmentResponse } = newEvidence;

      for (const diagnosis of differential.diagnoses) {
        let confidenceAdjustment = 0;

        if (testResults) {
          confidenceAdjustment += this.evaluateTestResults(testResults, diagnosis.icd10Code);
        }

        if (clinicalFindings) {
          confidenceAdjustment += this.evaluateClinicalFindings(clinicalFindings, diagnosis);
        }

        if (treatmentResponse) {
          confidenceAdjustment += this.evaluateTreatmentResponse(treatmentResponse, diagnosis);
        }

        diagnosis.confidenceScore = Math.max(0, Math.min(1, 
          diagnosis.confidenceScore + confidenceAdjustment
        ));
        diagnosis.confidenceLevel = this.getConfidenceLevel(diagnosis.confidenceScore);
        diagnosis.lastUpdated = new Date();
      }

      differential.diagnoses.sort((a, b) => b.confidenceScore - a.confidenceScore);

      await SecureDataAccess.update(
        'differential_diagnoses',
        { differentialId },
        { 
          diagnoses: differential.diagnoses,
          lastUpdated: new Date()
        },
        { 
          serviceId: this.serviceId, 
          operation: 'update-differential-diagnosis',
          practiceId: context.practiceId 
        }
      );

      await AuditLog.create({
        action: 'DIAGNOSIS_CONFIDENCE_UPDATED',
        category: 'clinical',
        patientId: differential.patientId,
        userId: context.userId,
        practiceId: context.practiceId,
        metadata: {
          differentialId,
          newTopDiagnosis: differential.diagnoses[0]?.icd10Code,
          evidenceType: Object.keys(newEvidence).join(', ')
        },
        timestamp: new Date()
      });

      return differential;
    } catch (error) {
      console.error('Failed to update diagnosis confidence:', error);
      throw error;
    }
  }

  evaluateTestResults(testResults, icd10Code) {
    let adjustment = 0;

    for (const test of testResults) {
      if (test.abnormal) {
        const relevance = this.assessTestRelevance(test.name, icd10Code);
        adjustment += relevance * (test.critical ? 0.2 : 0.1);
      }
    }

    return adjustment;
  }

  assessTestRelevance(testName, icd10Code) {
    const relevanceMap = {
      'I21': ['Troponin', 'ECG', 'CK-MB'],
      'J44': ['Spirometry', 'ABG', 'Chest X-ray'],
      'E11': ['HbA1c', 'Glucose', 'C-peptide'],
      'K70': ['LFTs', 'PT/INR', 'Albumin']
    };

    for (const [codePrefix, tests] of Object.entries(relevanceMap)) {
      if (icd10Code.startsWith(codePrefix) && tests.includes(testName)) {
        return 0.8;
      }
    }

    return 0.3;
  }

  evaluateClinicalFindings(findings, diagnosis) {
    let adjustment = 0;

    if (findings.physicalExam) {
      const relevantFindings = this.identifyRelevantFindings(findings.physicalExam, diagnosis);
      adjustment += relevantFindings * 0.05;
    }

    if (findings.symptomProgression === 'improving' && diagnosis.confidenceScore < 0.5) {
      adjustment -= 0.1;
    } else if (findings.symptomProgression === 'worsening' && diagnosis.confidenceScore > 0.7) {
      adjustment += 0.1;
    }

    return adjustment;
  }

  identifyRelevantFindings(physicalExam, diagnosis) {
    let relevantCount = 0;

    for (const finding of physicalExam) {
      if (diagnosis.supportingEvidence?.some(evidence => 
        evidence.toLowerCase().includes(finding.toLowerCase())
      )) {
        relevantCount++;
      }
    }

    return relevantCount;
  }

  evaluateTreatmentResponse(response, diagnosis) {
    if (response.improved && diagnosis.confidenceScore > 0.6) {
      return 0.15;
    } else if (!response.improved && diagnosis.confidenceScore > 0.7) {
      return -0.2;
    }
    return 0;
  }

  async explainDiagnosisReasoning(differentialId, diagnosisCode, context) {
    await this.initialize();

    try {
      const differential = await SecureDataAccess.findOne(
        'differential_diagnoses',
        { differentialId },
        { 
          serviceId: this.serviceId, 
          operation: 'get-differential-for-explanation',
          practiceId: context.practiceId 
        }
      );

      if (!differential) {
        throw new Error('Differential diagnosis not found');
      }

      const diagnosis = differential.diagnoses.find(d => d.icd10Code === diagnosisCode);
      if (!diagnosis) {
        throw new Error('Diagnosis not found in differential');
      }

      const explanation = {
        diagnosis: diagnosis.name,
        icd10Code: diagnosis.icd10Code,
        confidence: {
          score: diagnosis.confidenceScore,
          level: diagnosis.confidenceLevel
        },
        reasoning: {
          supportingEvidence: diagnosis.supportingEvidence || [],
          symptomAlignment: this.explainSymptomAlignment(differential.symptoms, diagnosis),
          epidemiologicalFactors: this.explainEpidemiologicalFactors(diagnosis),
          differentiatingFeatures: diagnosis.differentiatingFeatures || [],
          clinicalGuidelines: diagnosis.clinicalGuidelines || []
        },
        alternativeConsiderations: this.explainAlternatives(differential.diagnoses, diagnosisCode),
        nextSteps: {
          diagnosticTests: diagnosis.workupRecommendations || [],
          clinicalMonitoring: this.suggestMonitoring(diagnosis),
          referrals: this.suggestReferrals(diagnosis)
        }
      };

      return explanation;
    } catch (error) {
      console.error('Failed to explain diagnosis reasoning:', error);
      throw error;
    }
  }

  explainSymptomAlignment(symptoms, diagnosis) {
    return symptoms.map(symptom => {
      const alignment = diagnosis.supportingEvidence?.some(evidence =>
        evidence.toLowerCase().includes(symptom.standardized.toLowerCase())
      );

      return {
        symptom: symptom.standardized,
        alignsWithDiagnosis: alignment,
        explanation: alignment 
          ? `This symptom is commonly associated with ${diagnosis.name}`
          : `This symptom is less specific for ${diagnosis.name} but may occur`
      };
    });
  }

  explainEpidemiologicalFactors(diagnosis) {
    const factors = [];

    if (diagnosis.icd10Code.startsWith('I')) {
      factors.push('Cardiovascular conditions are more common in older adults');
    }

    if (diagnosis.confidenceScore > 0.7) {
      factors.push('This condition has high prevalence in the general population');
    }

    return factors;
  }

  explainAlternatives(allDiagnoses, primaryCode) {
    return allDiagnoses
      .filter(d => d.icd10Code !== primaryCode)
      .slice(0, 3)
      .map(alt => ({
        diagnosis: alt.name,
        icd10Code: alt.icd10Code,
        confidence: alt.confidenceScore,
        whyLessLikely: `Lower confidence (${(alt.confidenceScore * 100).toFixed(0)}%) based on symptom presentation`
      }));
  }

  suggestMonitoring(diagnosis) {
    const monitoring = [];

    if (diagnosis.redFlags && diagnosis.redFlags.length > 0) {
      monitoring.push('Monitor for red flag symptoms: ' + diagnosis.redFlags.join(', '));
    }

    if (diagnosis.confidenceLevel === 'low') {
      monitoring.push('Close follow-up recommended due to diagnostic uncertainty');
    }

    monitoring.push('Track symptom progression and treatment response');

    return monitoring;
  }

  suggestReferrals(diagnosis) {
    const specialtyMap = {
      'I': 'Cardiology',
      'J': 'Pulmonology',
      'K': 'Gastroenterology',
      'G': 'Neurology',
      'M': 'Rheumatology',
      'N': 'Nephrology',
      'E': 'Endocrinology'
    };

    const prefix = diagnosis.icd10Code.charAt(0);
    const specialty = specialtyMap[prefix];

    if (specialty && diagnosis.confidenceScore > 0.6) {
      return [`Consider ${specialty} referral for specialized evaluation`];
    }

    return [];
  }

  async findSimilarCases(differentialId, context) {
    await this.initialize();

    try {
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const currentDifferential = await SecureDataAccess.findOne(
        'differential_diagnoses',
        { differentialId },
        { 
          serviceId: this.serviceId, 
          operation: 'get-differential-for-similar-cases',
          practiceId: context.practiceId 
        }
      );

      if (!currentDifferential) {
        throw new Error('Differential diagnosis not found');
      }

      const symptomSignature = currentDifferential.symptoms
        .map(s => s.standardized)
        .sort()
        .join(',');

      const similarCases = await SecureDataAccess.query(
        'differential_diagnoses',
        {
          practiceId: context.practiceId,
          differentialId: { $ne: differentialId }
        },
        { limit: 100 },
        { 
          serviceId: this.serviceId, 
          operation: 'find-similar-cases',
          practiceId: context.practiceId 
        }
      );

      const scoredCases = similarCases.map(case_ => {
        const caseSymptomsString = case_.symptoms
          .map(s => s.standardized)
          .sort()
          .join(',');

        const similarity = this.calculateSimilarity(symptomSignature, caseSymptomsString);

        return {
          caseId: case_.differentialId,
          patientId: case_.patientId,
          similarity,
          topDiagnosis: case_.diagnoses[0],
          outcome: case_.outcome || 'Unknown',
          date: case_.timestamp
        };
      });

      const topSimilarCases = scoredCases
        .filter(c => c.similarity > 0.5)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);

      return {
        currentCase: differentialId,
        similarCases: topSimilarCases,
        insights: this.generateSimilarCaseInsights(topSimilarCases)
      };
    } catch (error) {
      console.error('Failed to find similar cases:', error);
      throw error;
    }
  }

  calculateSimilarity(symptoms1, symptoms2) {
    const set1 = new Set(symptoms1.split(','));
    const set2 = new Set(symptoms2.split(','));
    
    const intersection = [...set1].filter(x => set2.has(x));
    const union = new Set([...set1, ...set2]);
    
    return intersection.length / union.size;
  }

  generateSimilarCaseInsights(similarCases) {
    if (similarCases.length === 0) {
      return { message: 'No similar cases found in the database' };
    }

    const diagnoses = similarCases.map(c => c.topDiagnosis?.icd10Code).filter(Boolean);
    const diagnosisFrequency = {};
    
    diagnoses.forEach(dx => {
      diagnosisFrequency[dx] = (diagnosisFrequency[dx] || 0) + 1;
    });

    const mostCommonDiagnosis = Object.entries(diagnosisFrequency)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalSimilarCases: similarCases.length,
      averageSimilarity: similarCases.reduce((sum, c) => sum + c.similarity, 0) / similarCases.length,
      mostCommonDiagnosis: mostCommonDiagnosis ? {
        code: mostCommonDiagnosis[0],
        frequency: (mostCommonDiagnosis[1] / similarCases.length * 100).toFixed(1) + '%'
      } : null
    };
  }
}

// Create and export singleton
const diagnosisSupportService = new DiagnosisSupportService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('diagnosisSupportService', () => diagnosisSupportService);
}

module.exports = diagnosisSupportService;