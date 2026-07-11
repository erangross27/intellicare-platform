const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class GeriatricFieldMappingService {
  constructor() {
    this.serviceName = 'GeriatricFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[GeriatricFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_GERIATRICFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for GeriatricFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[GeriatricFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[GeriatricFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveFunctionalStatus(functionalStatus, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const functionalData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        adlScore: functionalStatus.adlScore || '',
        adlItems: functionalStatus.adlItems || {},
        iadlScore: functionalStatus.iadlScore || '',
        iadlItems: functionalStatus.iadlItems || {},
        mobilityAids: functionalStatus.mobilityAids || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('functional_status', functionalData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveGeriatricCognitiveAssessment(cognitiveAssessment, patientId, documentId, extractedData, context) {
    try {
      const cognitiveData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        mmseScore: cognitiveAssessment.mmseScore || '',
        mmseBreakdown: cognitiveAssessment.mmseBreakdown || {},
        clockDrawing: cognitiveAssessment.clockDrawing || '',
        cdrScore: cognitiveAssessment.cdrScore || '',
        mocaScore: cognitiveAssessment.mocaScore || '',
        behavioralSymptoms: cognitiveAssessment.behavioralSymptoms || [],
        sundowning: cognitiveAssessment.sundowning || false,
        wandering: cognitiveAssessment.wandering || false,
        cognitivePattern: cognitiveAssessment.cognitivePattern || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('geriatric_cognitive_assessments', cognitiveData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveFallsRiskAssessment(fallsAssessment, patientId, documentId, extractedData, context) {
    try {
      const fallsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        fallsHistory: fallsAssessment.fallsHistory || [],
        tugTest: fallsAssessment.tugTest || '',
        bergBalance: fallsAssessment.bergBalance || '',
        chairStand: fallsAssessment.chairStand || '',
        gaitSpeed: fallsAssessment.gaitSpeed || '',
        gaitPattern: fallsAssessment.gaitPattern || '',
        fallRiskFactors: fallsAssessment.fallRiskFactors || [],
        interventions: fallsAssessment.interventions || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('falls_risk_assessments', fallsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePolypharmacyReview(polypharmacyReview, patientId, documentId, extractedData, context) {
    try {
      const polypharmacyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        reviewDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        totalMedications: polypharmacyReview.totalMedications || '',
        beersCriteria: polypharmacyReview.beersCriteria || [],
        medicationsDiscontinued: polypharmacyReview.medicationsDiscontinued || [],
        medicationsModified: polypharmacyReview.medicationsModified || [],
        drugInteractions: polypharmacyReview.drugInteractions || [],
        adverseEffects: polypharmacyReview.adverseEffects || [],
        adherenceIssues: polypharmacyReview.adherenceIssues || [],
        pillBurden: polypharmacyReview.pillBurden || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('polypharmacy_reviews', polypharmacyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveGeriatricNutritionalAssessment(nutritionalAssessment, patientId, documentId, extractedData, context) {
    try {
      const nutritionData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        mnaScore: nutritionalAssessment.mnaScore || '',
        bmi: nutritionalAssessment.bmi || '',
        weightChange: nutritionalAssessment.weightChange || '',
        albumin: nutritionalAssessment.albumin || '',
        prealbumin: nutritionalAssessment.prealbumin || '',
        appetiteChanges: nutritionalAssessment.appetiteChanges || '',
        dysphagia: nutritionalAssessment.dysphagia || false,
        dietaryRestrictions: nutritionalAssessment.dietaryRestrictions || [],
        supplementation: nutritionalAssessment.supplementation || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('geriatric_nutritional_assessments', nutritionData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMoodPsychologicalAssessment(moodAssessment, patientId, documentId, extractedData, context) {
    try {
      const moodData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        gdsScore: moodAssessment.gdsScore || '',
        gadScore: moodAssessment.gadScore || '',
        phq9Score: moodAssessment.phq9Score || '',
        sleepPattern: moodAssessment.sleepPattern || {},
        socialIsolation: moodAssessment.socialIsolation || '',
        griefLoss: moodAssessment.griefLoss || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('mood_psychological_assessments', moodData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSocialFunctionalAssessment(socialAssessment, patientId, documentId, extractedData, context) {
    try {
      const socialData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        livingSituation: socialAssessment.livingSituation || '',
        supportSystem: socialAssessment.supportSystem || {},
        financialStatus: socialAssessment.financialStatus || '',
        transportation: socialAssessment.transportation || '',
        drivingStatus: socialAssessment.drivingStatus || '',
        socialActivities: socialAssessment.socialActivities || [],
        communityResources: socialAssessment.communityResources || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('social_functional_assessments', socialData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveFrailtyAssessment(frailtyAssessment, patientId, documentId, extractedData, context) {
    try {
      const frailtyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        frailtyIndex: frailtyAssessment.frailtyIndex || '',
        gripStrength: frailtyAssessment.gripStrength || '',
        walkingSpeed: frailtyAssessment.walkingSpeed || '',
        exhaustion: frailtyAssessment.exhaustion || '',
        physicalActivity: frailtyAssessment.physicalActivity || '',
        unintentionalWeightLoss: frailtyAssessment.unintentionalWeightLoss || '',
        clinicalFrailtyScale: frailtyAssessment.clinicalFrailtyScale || '',
        sarcopenia: frailtyAssessment.sarcopenia || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('frailty_assessments', frailtyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveGeriatricCarePlanning(geriatricCarePlanning, patientId, documentId, extractedData, context) {
    try {
      const planningData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        planningDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        codeStatus: geriatricCarePlanning.codeStatus || '',
        advancedDirectives: geriatricCarePlanning.advancedDirectives || {},
        goalsOfCare: geriatricCarePlanning.goalsOfCare || [],
        prognosisDiscussion: geriatricCarePlanning.prognosisDiscussion || '',
        palliativeCareInvolvement: geriatricCarePlanning.palliativeCareInvolvement || false,
        hospiceDiscussion: geriatricCarePlanning.hospiceDiscussion || false,
        transitionPlanning: geriatricCarePlanning.transitionPlanning || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('geriatric_care_planning', planningData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCaregiverAssessment(caregiverAssessment, patientId, documentId, extractedData, context) {
    try {
      const caregiverData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        primaryCaregiver: caregiverAssessment.primaryCaregiver || '',
        caregiverBurden: caregiverAssessment.caregiverBurden || '',
        caregiverHealth: caregiverAssessment.caregiverHealth || '',
        respiteNeeds: caregiverAssessment.respiteNeeds || false,
        supportServices: caregiverAssessment.supportServices || [],
        educationProvided: caregiverAssessment.educationProvided || [],
        financialStrain: caregiverAssessment.financialStrain || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('caregiver_assessments', caregiverData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new GeriatricFieldMappingService();
