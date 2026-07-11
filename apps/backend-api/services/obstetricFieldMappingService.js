const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class ObstetricFieldMappingService {
  constructor() {
    this.serviceName = 'ObstetricFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[ObstetricFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_OBSTETRICFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for ObstetricFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[ObstetricFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[ObstetricFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async savePrenatalVisit(prenatalVisit, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const visitData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        visitDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        visitType: prenatalVisit.visitType || '',
        gestationalAgeAtVisit: prenatalVisit.gestationalAgeAtVisit || '',
        visitNumber: prenatalVisit.visitNumber || '',
        nextVisitScheduled: prenatalVisit.nextVisitScheduled || '',
        provider: prenatalVisit.provider || '',
        visitCompliance: prenatalVisit.visitCompliance || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('prenatal_visits', visitData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMaternalWeightMonitoring(maternalWeightMonitoring, patientId, documentId, extractedData, context) {
    try {
      const weightData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        prePregnancyWeight: maternalWeightMonitoring.prePregnancyWeight || '',
        currentWeight: maternalWeightMonitoring.currentWeight || '',
        totalWeightGain: maternalWeightMonitoring.totalWeightGain || '',
        weeklyGainRate: maternalWeightMonitoring.weeklyGainRate || '',
        bmi: maternalWeightMonitoring.bmi || '',
        weightGainAppropriate: maternalWeightMonitoring.weightGainAppropriate || false,
        nutritionalCounseling: maternalWeightMonitoring.nutritionalCounseling || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('maternal_weight_monitoring', weightData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveFetalAssessment(fetalAssessment, patientId, documentId, extractedData, context) {
    try {
      const fetalData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        fetalHeartRate: fetalAssessment.fetalHeartRate || '',
        fetalMovement: fetalAssessment.fetalMovement || {},
        fundalHeight: fetalAssessment.fundalHeight || '',
        fundalHeightPercentile: fetalAssessment.fundalHeightPercentile || '',
        fetalPosition: fetalAssessment.fetalPosition || '',
        fetalPresentation: fetalAssessment.fetalPresentation || '',
        estimatedFetalWeight: fetalAssessment.estimatedFetalWeight || '',
        leopoldManeuvers: fetalAssessment.leopoldManeuvers || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('fetal_assessments', fetalData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveContractionMonitoring(contractionMonitoring, patientId, documentId, extractedData, context) {
    try {
      const contractionData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        monitoringDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        braxtonHicks: contractionMonitoring.braxtonHicks || {},
        trueLabor: contractionMonitoring.trueLabor || {},
        pretermLaborRisk: contractionMonitoring.pretermLaborRisk || '',
        tocolytics: contractionMonitoring.tocolytics || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('contraction_monitoring', contractionData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePregnancySymptoms(pregnancySymptoms, patientId, documentId, extractedData, context) {
    try {
      const symptomsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        nausea: pregnancySymptoms.nausea || '',
        vomiting: pregnancySymptoms.vomiting || '',
        heartburn: pregnancySymptoms.heartburn || '',
        constipation: pregnancySymptoms.constipation || '',
        hemorrhoids: pregnancySymptoms.hemorrhoids || '',
        backPain: pregnancySymptoms.backPain || '',
        roundLigamentPain: pregnancySymptoms.roundLigamentPain || '',
        edema: pregnancySymptoms.edema || '',
        varicoseVeins: pregnancySymptoms.varicoseVeins || '',
        sleepDisturbance: pregnancySymptoms.sleepDisturbance || '',
        urinaryFrequency: pregnancySymptoms.urinaryFrequency || '',
        vaginalDischarge: pregnancySymptoms.vaginalDischarge || '',
        skinChanges: pregnancySymptoms.skinChanges || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pregnancy_symptoms', symptomsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePrenatalEducation(prenatalEducation, patientId, documentId, extractedData, context) {
    try {
      const educationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        educationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        topicsDiscussed: prenatalEducation.topicsDiscussed || [],
        childbirtClassesEnrolled: prenatalEducation.childbirtClassesEnrolled || false,
        classesAttended: prenatalEducation.classesAttended || [],
        breastfeedingEducation: prenatalEducation.breastfeedingEducation || false,
        pretermLaborPrecautions: prenatalEducation.pretermLaborPrecautions || false,
        nutritionCounseling: prenatalEducation.nutritionCounseling || false,
        exerciseGuidance: prenatalEducation.exerciseGuidance || false,
        travelRestrictions: prenatalEducation.travelRestrictions || '',
        workModifications: prenatalEducation.workModifications || [],
        warningSignsReviewed: prenatalEducation.warningSignsReviewed || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('prenatal_education', educationData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveBirthPlan(birthPlan, patientId, documentId, extractedData, context) {
    try {
      const birthPlanData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        planDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        deliveryPreference: birthPlan.deliveryPreference || '',
        painManagement: birthPlan.painManagement || [],
        laborSupport: birthPlan.laborSupport || [],
        immediatePostpartum: birthPlan.immediatePostpartum || {},
        feedingPlan: birthPlan.feedingPlan || '',
        circumcisionPreference: birthPlan.circumcisionPreference || '',
        visitorsPolicy: birthPlan.visitorsPolicy || '',
        religiousCulturalPreferences: birthPlan.religiousCulturalPreferences || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('birth_plans', birthPlanData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePostpartumPlanning(postpartumPlanning, patientId, documentId, extractedData, context) {
    try {
      const postpartumData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        planningDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        pediatricianSelected: postpartumPlanning.pediatricianSelected || '',
        contraceptionPlan: postpartumPlanning.contraceptionPlan || '',
        maternityLeave: postpartumPlanning.maternityLeave || {},
        postpartumSupport: postpartumPlanning.postpartumSupport || [],
        lactationSupport: postpartumPlanning.lactationSupport || false,
        mentalHealthScreening: postpartumPlanning.mentalHealthScreening || false,
        homePreparations: postpartumPlanning.homePreparations || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('postpartum_planning', postpartumData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePregnancyRiskAssessment(pregnancyRiskAssessment, patientId, documentId, extractedData, context) {
    try {
      const riskData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        riskFactors: pregnancyRiskAssessment.riskFactors || [],
        riskLevel: pregnancyRiskAssessment.riskLevel || '',
        consultationsNeeded: pregnancyRiskAssessment.consultationsNeeded || [],
        surveillancePlan: pregnancyRiskAssessment.surveillancePlan || '',
        hospitalOfDelivery: pregnancyRiskAssessment.hospitalOfDelivery || '',
        antenatalTesting: pregnancyRiskAssessment.antenatalTesting || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pregnancy_risk_assessments', riskData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePsychosocialAssessment(psychosocialAssessment, patientId, documentId, extractedData, context) {
    try {
      const psychosocialData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        edinburghScore: psychosocialAssessment.edinburghScore || '',
        anxietyScreening: psychosocialAssessment.anxietyScreening || '',
        domesticViolenceScreen: psychosocialAssessment.domesticViolenceScreen || '',
        socialSupport: psychosocialAssessment.socialSupport || '',
        substanceUseScreen: psychosocialAssessment.substanceUseScreen || {},
        housingStability: psychosocialAssessment.housingStability || '',
        financialConcerns: psychosocialAssessment.financialConcerns || false,
        relationshipStress: psychosocialAssessment.relationshipStress || '',
        previousPostpartumDepression: psychosocialAssessment.previousPostpartumDepression || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('psychosocial_assessments', psychosocialData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCervicalAssessment(cervicalAssessment, patientId, documentId, extractedData, context) {
    try {
      const cervicalData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        examDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        cervicalLength: cervicalAssessment.cervicalLength || '',
        cervicalDilation: cervicalAssessment.cervicalDilation || '',
        cervicalEffacement: cervicalAssessment.cervicalEffacement || '',
        cervicalConsistency: cervicalAssessment.cervicalConsistency || '',
        cervicalPosition: cervicalAssessment.cervicalPosition || '',
        bishopScore: cervicalAssessment.bishopScore || '',
        cervicalCerclage: cervicalAssessment.cervicalCerclage || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('cervical_assessments', cervicalData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveImmunizationRecord(immunizationRecord, patientId, documentId, extractedData, context) {
    try {
      const immunizationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        influenza: immunizationRecord.influenza || {},
        tdap: immunizationRecord.tdap || {},
        covid19: immunizationRecord.covid19 || {},
        rhogam: immunizationRecord.rhogam || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pregnancy_immunizations', immunizationData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Note: These methods already exist in medicalFieldMappingService.js but are included for completeness
  async saveObstetricHistory(obstetricHistory, patientId, documentId, extractedData, context) {
    try {
      const historyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        gravida: obstetricHistory.gravida || '',
        para: obstetricHistory.para || '',
        gpNotation: obstetricHistory.gpNotation || '',
        livingChildren: obstetricHistory.livingChildren || '',
        miscarriages: obstetricHistory.miscarriages || '',
        abortions: obstetricHistory.abortions || '',
        ectopicPregnancies: obstetricHistory.ectopicPregnancies || '',
        previousDeliveries: obstetricHistory.previousDeliveries || [],
        pregnancyLosses: obstetricHistory.pregnancyLosses || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('obstetric_histories', historyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCurrentPregnancy(currentPregnancy, patientId, documentId, extractedData, context) {
    try {
      const pregnancyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        gestationalAge: currentPregnancy.gestationalAge || '',
        edd: currentPregnancy.edd || '',
        lmp: currentPregnancy.lmp || '',
        conceptionMethod: currentPregnancy.conceptionMethod || '',
        singleton: currentPregnancy.singleton || false,
        multipleGestation: currentPregnancy.multipleGestation || {},
        pregnancyComplications: currentPregnancy.pregnancyComplications || [],
        highRiskFactors: currentPregnancy.highRiskFactors || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('current_pregnancies', pregnancyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ObstetricFieldMappingService();
