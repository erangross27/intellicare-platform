const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class PediatricFieldMappingService {
  constructor() {
    this.serviceName = 'PediatricFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[PediatricFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_PEDIATRICFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for PediatricFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[PediatricFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[PediatricFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveBirthHistory(birthHistory, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const birthData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        gestationalAge: birthHistory.gestationalAge || '',
        deliveryType: birthHistory.deliveryType || '',
        birthWeight: birthHistory.birthWeight || '',
        birthLength: birthHistory.birthLength || '',
        headCircumference: birthHistory.headCircumference || '',
        apgarScores: birthHistory.apgarScores || {},
        complications: birthHistory.complications || [],
        nicuStay: birthHistory.nicuStay || false,
        nicuDuration: birthHistory.nicuDuration || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('birth_histories', birthData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveGrowthParameters(growthParameters, patientId, documentId, extractedData, context) {
    try {
      const growthData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        measurementDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        height: growthParameters.height || {},
        weight: growthParameters.weight || {},
        headCircumference: growthParameters.headCircumference || {},
        bmi: growthParameters.bmi || {},
        growthVelocity: growthParameters.growthVelocity || '',
        pubertalStage: growthParameters.pubertalStage || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('growth_parameters', growthData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDevelopmentalMilestones(developmentalMilestones, patientId, documentId, extractedData, context) {
    try {
      const milestonesData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        grossMotor: developmentalMilestones.grossMotor || [],
        fineMotor: developmentalMilestones.fineMotor || [],
        language: developmentalMilestones.language || [],
        socialEmotional: developmentalMilestones.socialEmotional || [],
        cognitive: developmentalMilestones.cognitive || [],
        concerns: developmentalMilestones.concerns || [],
        referrals: developmentalMilestones.referrals || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('developmental_milestones', milestonesData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePediatricScreening(pediatricScreening, patientId, documentId, extractedData, context) {
    try {
      const screeningData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        screeningDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        visionScreening: pediatricScreening.visionScreening || {},
        hearingScreening: pediatricScreening.hearingScreening || {},
        leadLevel: pediatricScreening.leadLevel || {},
        tuberculosisRisk: pediatricScreening.tuberculosisRisk || '',
        developmentalScreening: pediatricScreening.developmentalScreening || {},
        behavioralScreening: pediatricScreening.behavioralScreening || {},
        dentalScreening: pediatricScreening.dentalScreening || '',
        cholesterolScreening: pediatricScreening.cholesterolScreening || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pediatric_screenings', screeningData, context);
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
        upToDate: immunizationRecord.upToDate || false,
        givenToday: immunizationRecord.givenToday || [],
        previousVaccines: immunizationRecord.previousVaccines || [],
        nextDue: immunizationRecord.nextDue || [],
        contraindications: immunizationRecord.contraindications || [],
        catchUpNeeded: immunizationRecord.catchUpNeeded || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('immunization_records', immunizationData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSchoolPerformance(schoolPerformance, patientId, documentId, extractedData, context) {
    try {
      const schoolData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        grade: schoolPerformance.grade || '',
        school: schoolPerformance.school || '',
        academicPerformance: schoolPerformance.academicPerformance || '',
        behaviorInClass: schoolPerformance.behaviorInClass || '',
        peerInteractions: schoolPerformance.peerInteractions || '',
        specialEducation: schoolPerformance.specialEducation || false,
        iepOr504Plan: schoolPerformance.iepOr504Plan || '',
        concerns: schoolPerformance.concerns || [],
        strengths: schoolPerformance.strengths || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('school_performance', schoolData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveNutritionalAssessment(nutritionalAssessment, patientId, documentId, extractedData, context) {
    try {
      const nutritionData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        dietType: nutritionalAssessment.dietType || '',
        breastfeedingHistory: nutritionalAssessment.breastfeedingHistory || {},
        formulaFeeding: nutritionalAssessment.formulaFeeding || {},
        solidFoods: nutritionalAssessment.solidFoods || {},
        dietaryRestrictions: nutritionalAssessment.dietaryRestrictions || [],
        supplements: nutritionalAssessment.supplements || [],
        feedingDifficulties: nutritionalAssessment.feedingDifficulties || [],
        weightStatus: nutritionalAssessment.weightStatus || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pediatric_nutrition', nutritionData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAnticipatoryGuidance(anticipatoryGuidance, patientId, documentId, extractedData, context) {
    try {
      const guidanceData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        guidanceDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        nutrition: anticipatoryGuidance.nutrition || [],
        physicalActivity: anticipatoryGuidance.physicalActivity || [],
        screenTime: anticipatoryGuidance.screenTime || '',
        sleep: anticipatoryGuidance.sleep || {},
        safety: anticipatoryGuidance.safety || [],
        dental: anticipatoryGuidance.dental || [],
        socialDevelopment: anticipatoryGuidance.socialDevelopment || [],
        toileting: anticipatoryGuidance.toileting || '',
        discipline: anticipatoryGuidance.discipline || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('anticipatory_guidance', guidanceData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveBehavioralAssessment(behavioralAssessment, patientId, documentId, extractedData, context) {
    try {
      const behavioralData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        temperament: behavioralAssessment.temperament || '',
        attentionSpan: behavioralAssessment.attentionSpan || '',
        activityLevel: behavioralAssessment.activityLevel || '',
        socialSkills: behavioralAssessment.socialSkills || '',
        emotionalRegulation: behavioralAssessment.emotionalRegulation || '',
        tantrums: behavioralAssessment.tantrums || {},
        anxietySymptoms: behavioralAssessment.anxietySymptoms || [],
        adhdSymptoms: behavioralAssessment.adhdSymptoms || [],
        autismRedFlags: behavioralAssessment.autismRedFlags || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pediatric_behavioral_assessments', behavioralData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveParentalConcerns(parentalConcerns, patientId, documentId, extractedData, context) {
    try {
      const concernsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        visitDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        concerns: parentalConcerns.concerns || [],
        parentingStress: parentalConcerns.parentingStress || '',
        familySupport: parentalConcerns.familySupport || '',
        homeEnvironment: parentalConcerns.homeEnvironment || '',
        siblingRelationships: parentalConcerns.siblingRelationships || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('parental_concerns', concernsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveWellChildSummary(wellChildSummary, patientId, documentId, extractedData, context) {
    try {
      const summaryData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        visitDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        ageInMonths: wellChildSummary.ageInMonths || 0,
        ageInYears: wellChildSummary.ageInYears || '',
        visitType: wellChildSummary.visitType || '',
        overallHealth: wellChildSummary.overallHealth || '',
        chronicConditions: wellChildSummary.chronicConditions || [],
        nextVisit: wellChildSummary.nextVisit || '',
        callReasons: wellChildSummary.callReasons || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('well_child_summaries', summaryData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveEarlyChildhoodDevelopment(earlyChildhoodDevelopment, patientId, documentId, extractedData, context) {
    try {
      const developmentData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        playSkills: earlyChildhoodDevelopment.playSkills || '',
        separationAnxiety: earlyChildhoodDevelopment.separationAnxiety || '',
        toiletTraining: earlyChildhoodDevelopment.toiletTraining || {},
        speechDevelopment: earlyChildhoodDevelopment.speechDevelopment || {},
        selfCareSkills: earlyChildhoodDevelopment.selfCareSkills || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('early_childhood_development', developmentData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAdhdAssessment(adhdAssessment, patientId, documentId, extractedData, context) {
    try {
      const adhdData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        screeningTool: adhdAssessment.screeningTool || '',
        parentForm: adhdAssessment.parentForm || {},
        teacherForm: adhdAssessment.teacherForm || {},
        symptoms: adhdAssessment.symptoms || {},
        dsmCriteriaMet: adhdAssessment.dsmCriteriaMet || '',
        differentialDiagnosis: adhdAssessment.differentialDiagnosis || [],
        comorbidities: adhdAssessment.comorbidities || [],
        familyHistory: adhdAssessment.familyHistory || [],
        recommendations: adhdAssessment.recommendations || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('adhd_assessments', adhdData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PediatricFieldMappingService();
