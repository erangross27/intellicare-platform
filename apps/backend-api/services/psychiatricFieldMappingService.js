const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class PsychiatricFieldMappingService {
  constructor() {
    this.serviceName = 'PsychiatricFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[PsychiatricFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_PSYCHIATRICFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for PsychiatricFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[PsychiatricFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[PsychiatricFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async savePsychiatricHistory(psychiatricHistory, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const historyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        previousEpisodes: psychiatricHistory.previousEpisodes || [],
        hospitalizations: psychiatricHistory.hospitalizations || [],
        suicideAttempts: psychiatricHistory.suicideAttempts || [],
        substanceAbuse: psychiatricHistory.substanceAbuse || {},
        familyPsychHistory: psychiatricHistory.familyPsychHistory || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('psychiatric_histories', historyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMentalStatusExam(mentalStatusExam, patientId, documentId, extractedData, context) {
    try {
      const mseData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        examDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        appearance: mentalStatusExam.appearance || {},
        behavior: mentalStatusExam.behavior || {},
        speech: mentalStatusExam.speech || {},
        mood: mentalStatusExam.mood || '',
        affect: mentalStatusExam.affect || {},
        thoughtProcess: mentalStatusExam.thoughtProcess || {},
        thoughtContent: mentalStatusExam.thoughtContent || {},
        perceptualDisturbances: mentalStatusExam.perceptualDisturbances || {},
        cognition: mentalStatusExam.cognition || {},
        insight: mentalStatusExam.insight || '',
        judgment: mentalStatusExam.judgment || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('mental_status_exams', mseData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSuicideRiskAssessment(suicideRiskAssessment, patientId, documentId, extractedData, context) {
    try {
      const riskData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        ideation: suicideRiskAssessment.ideation || {},
        plan: suicideRiskAssessment.plan || {},
        intent: suicideRiskAssessment.intent || '',
        previousAttempts: suicideRiskAssessment.previousAttempts || false,
        riskFactors: suicideRiskAssessment.riskFactors || [],
        protectiveFactors: suicideRiskAssessment.protectiveFactors || [],
        riskLevel: suicideRiskAssessment.riskLevel || '',
        columbiaScale: suicideRiskAssessment.columbiaScale || '',
        interventions: suicideRiskAssessment.interventions || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('suicide_risk_assessments', riskData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePsychiatricAssessmentScales(psychiatricAssessmentScales, patientId, documentId, extractedData, context) {
    try {
      const scalesData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        phq9: psychiatricAssessmentScales.phq9 || {},
        gad7: psychiatricAssessmentScales.gad7 || {},
        phq15: psychiatricAssessmentScales.phq15 || {},
        mdq: psychiatricAssessmentScales.mdq || {},
        pcl5: psychiatricAssessmentScales.pcl5 || {},
        audit: psychiatricAssessmentScales.audit || {},
        mmse: psychiatricAssessmentScales.mmse || {},
        moca: psychiatricAssessmentScales.moca || {},
        customScales: psychiatricAssessmentScales.customScales || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('psychiatric_assessment_scales', scalesData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSubstanceUseAssessment(substanceUseAssessment, patientId, documentId, extractedData, context) {
    try {
      const substanceData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        currentUse: substanceUseAssessment.currentUse || [],
        pastUse: substanceUseAssessment.pastUse || [],
        withdrawalSymptoms: substanceUseAssessment.withdrawalSymptoms || [],
        treatmentHistory: substanceUseAssessment.treatmentHistory || [],
        duidHistory: substanceUseAssessment.duidHistory || false,
        cageScore: substanceUseAssessment.cageScore || null,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('substance_use_assessments', substanceData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePsychotropicMedications(psychotropicMedications, patientId, documentId, extractedData, context) {
    try {
      const medicationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        current: psychotropicMedications.current || [],
        past: psychotropicMedications.past || [],
        allergiesAdverse: psychotropicMedications.allergiesAdverse || [],
        medicationChanges: psychotropicMedications.medicationChanges || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('psychotropic_medications', medicationData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePsychiatricTreatmentPlan(psychiatricTreatmentPlan, patientId, documentId, extractedData, context) {
    try {
      const treatmentData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        planDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diagnoses: psychiatricTreatmentPlan.diagnoses || [],
        pharmacological: psychiatricTreatmentPlan.pharmacological || [],
        psychotherapy: psychiatricTreatmentPlan.psychotherapy || {},
        supportGroups: psychiatricTreatmentPlan.supportGroups || [],
        lifestyleModifications: psychiatricTreatmentPlan.lifestyleModifications || [],
        safetyPlan: psychiatricTreatmentPlan.safetyPlan || {},
        followUpPlan: psychiatricTreatmentPlan.followUpPlan || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('psychiatric_treatment_plans', treatmentData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePsychosocialFactors(psychosocialFactors, patientId, documentId, extractedData, context) {
    try {
      const psychosocialData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        stressors: psychosocialFactors.stressors || [],
        supportSystem: psychosocialFactors.supportSystem || {},
        livingEnvironment: psychosocialFactors.livingEnvironment || '',
        financialStatus: psychosocialFactors.financialStatus || '',
        legalIssues: psychosocialFactors.legalIssues || [],
        culturalFactors: psychosocialFactors.culturalFactors || [],
        spiritualBeliefs: psychosocialFactors.spiritualBeliefs || '',
        copingMechanisms: psychosocialFactors.copingMechanisms || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('psychosocial_assessments', psychosocialData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveHomicideRiskAssessment(homicideRiskAssessment, patientId, documentId, extractedData, context) {
    try {
      const homicideData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        ideation: homicideRiskAssessment.ideation || false,
        target: homicideRiskAssessment.target || '',
        plan: homicideRiskAssessment.plan || '',
        means: homicideRiskAssessment.means || '',
        intent: homicideRiskAssessment.intent || '',
        riskFactors: homicideRiskAssessment.riskFactors || [],
        interventions: homicideRiskAssessment.interventions || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('homicide_risk_assessments', homicideData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveBiopsychosocialFormulation(biopsychosocialFormulation, patientId, documentId, extractedData, context) {
    try {
      const formData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        biologicalFactors: biopsychosocialFormulation.biologicalFactors || {},
        psychologicalFactors: biopsychosocialFormulation.psychologicalFactors || {},
        socialFactors: biopsychosocialFormulation.socialFactors || {},
        strengths: biopsychosocialFormulation.strengths || [],
        vulnerabilities: biopsychosocialFormulation.vulnerabilities || [],
        perpetuatingFactors: biopsychosocialFormulation.perpetuatingFactors || [],
        protectiveFactors: biopsychosocialFormulation.protectiveFactors || [],
        integratedFormulation: biopsychosocialFormulation.integratedFormulation || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('biopsychosocial_formulations', formData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDiagnosticImpression(diagnosticImpression, patientId, documentId, extractedData, context) {
    try {
      const diagnosticData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        diagnosisDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        primaryDiagnosis: diagnosticImpression.primaryDiagnosis || {},
        differentialDiagnoses: diagnosticImpression.differentialDiagnoses || [],
        comorbidities: diagnosticImpression.comorbidities || [],
        provisionalDiagnoses: diagnosticImpression.provisionalDiagnoses || [],
        ruleOutDiagnoses: diagnosticImpression.ruleOutDiagnoses || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('diagnostic_impressions', diagnosticData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveTreatmentGoals(treatmentGoals, patientId, documentId, extractedData, context) {
    try {
      const goalsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        goalDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        immediateGoals: treatmentGoals.immediateGoals || [],
        shortTermGoals: treatmentGoals.shortTermGoals || [],
        longTermGoals: treatmentGoals.longTermGoals || [],
        patientGoals: treatmentGoals.patientGoals || [],
        familyGoals: treatmentGoals.familyGoals || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('treatment_goals', goalsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCareCoordination(careCoordination, patientId, documentId, extractedData, context) {
    try {
      const coordinationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        coordinationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        primaryCareProvider: careCoordination.primaryCareProvider || {},
        specialists: careCoordination.specialists || [],
        therapist: careCoordination.therapist || {},
        caseManager: careCoordination.caseManager || {},
        familyInvolvement: careCoordination.familyInvolvement || {},
        communityResources: careCoordination.communityResources || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('care_coordination', coordinationData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePsychiatricReview(psychiatricReview, patientId, documentId, extractedData, context) {
    try {
      const reviewData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        reviewDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        lastPsychiatristVisit: psychiatricReview.lastPsychiatristVisit || '',
        medicationCompliance: psychiatricReview.medicationCompliance || '',
        medicationSideEffects: psychiatricReview.medicationSideEffects || [],
        therapeuticResponse: psychiatricReview.therapeuticResponse || '',
        bloodLevels: psychiatricReview.bloodLevels || [],
        metabolicMonitoring: psychiatricReview.metabolicMonitoring || {},
        ekg: psychiatricReview.ekg || '',
        geneticTesting: psychiatricReview.geneticTesting || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('psychiatric_reviews', reviewData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveFunctionalAssessment(functionalAssessment, patientId, documentId, extractedData, context) {
    try {
      const functionalData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        globalAssessment: functionalAssessment.globalAssessment || '',
        occupationalFunctioning: functionalAssessment.occupationalFunctioning || '',
        socialFunctioning: functionalAssessment.socialFunctioning || '',
        academicFunctioning: functionalAssessment.academicFunctioning || '',
        selfCare: functionalAssessment.selfCare || '',
        independentLiving: functionalAssessment.independentLiving || '',
        financialManagement: functionalAssessment.financialManagement || '',
        medicationManagement: functionalAssessment.medicationManagement || '',
        transportationAccess: functionalAssessment.transportationAccess || '',
        legalIssues: functionalAssessment.legalIssues || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('functional_assessments', functionalData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PsychiatricFieldMappingService();
