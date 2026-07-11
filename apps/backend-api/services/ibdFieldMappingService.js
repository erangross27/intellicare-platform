const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class IbdFieldMappingService {
  constructor() {
    this.serviceName = 'IbdFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[IbdFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_IBDFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for IbdFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[IbdFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[IbdFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveIbdAssessment(ibdAssessment, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const assessmentData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        visitDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diseaseType: ibdAssessment.diseaseType || '',
        diseaseExtent: ibdAssessment.diseaseExtent || '',
        diseaseLocation: ibdAssessment.diseaseLocation || '',
        diseaseBehavior: ibdAssessment.diseaseBehavior || '',
        dateOfDiagnosis: ibdAssessment.dateOfDiagnosis || '',
        currentFlare: ibdAssessment.currentFlare || {},
        previousHospitalizations: ibdAssessment.previousHospitalizations || [],
        previousSurgeries: ibdAssessment.previousSurgeries || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('ibd_assessments', assessmentData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDiseaseActivityScores(diseaseActivityScores, patientId, documentId, extractedData, context) {
    try {
      const scoresData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        scoreDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        mayoScore: diseaseActivityScores.mayoScore || {},
        harveyBradshaw: diseaseActivityScores.harveyBradshaw || {},
        cdai: diseaseActivityScores.cdai || {},
        partialMayo: diseaseActivityScores.partialMayo || {},
        simpleClinicaCcolitis: diseaseActivityScores.simpleClinicaCcolitis || {},
        pucai: diseaseActivityScores.pucai || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('disease_activity_scores', scoresData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveEndoscopyFindings(endoscopyFindings, patientId, documentId, extractedData, context) {
    try {
      const endoscopyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        procedureType: endoscopyFindings.procedureType || '',
        extent: endoscopyFindings.extent || '',
        mayoEndoscopicScore: endoscopyFindings.mayoEndoscopicScore || '',
        rutgeerts: endoscopyFindings.rutgeerts || '',
        findings: endoscopyFindings.findings || [],
        biopsies: endoscopyFindings.biopsies || {},
        complications: endoscopyFindings.complications || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('endoscopy_findings', endoscopyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveIbdBiomarkers(ibdBiomarkers, patientId, documentId, extractedData, context) {
    try {
      const biomarkerData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        labDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        fecalCalprotectin: ibdBiomarkers.fecalCalprotectin || '',
        fecalLactoferrin: ibdBiomarkers.fecalLactoferrin || '',
        crp: ibdBiomarkers.crp || '',
        esr: ibdBiomarkers.esr || '',
        albumin: ibdBiomarkers.albumin || '',
        hemoglobin: ibdBiomarkers.hemoglobin || '',
        platelets: ibdBiomarkers.platelets || '',
        pANCA: ibdBiomarkers.pANCA || '',
        ASCA: ibdBiomarkers.ASCA || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('ibd_biomarkers', biomarkerData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveBiologicTherapy(biologicTherapy, patientId, documentId, extractedData, context) {
    try {
      const biologicData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        updateDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        currentBiologic: biologicTherapy.currentBiologic || '',
        dose: biologicTherapy.dose || '',
        frequency: biologicTherapy.frequency || '',
        lastDose: biologicTherapy.lastDose || '',
        drugLevel: biologicTherapy.drugLevel || '',
        antibodies: biologicTherapy.antibodies || '',
        previousBiologics: biologicTherapy.previousBiologics || [],
        concomitantImmunosuppression: biologicTherapy.concomitantImmunosuppression || '',
        optimization: biologicTherapy.optimization || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('biologic_therapy', biologicData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveExtraintestinalManifestations(extraintestinalManifestations, patientId, documentId, extractedData, context) {
    try {
      const manifestationsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        articular: extraintestinalManifestations.articular || [],
        dermatologic: extraintestinalManifestations.dermatologic || [],
        ocular: extraintestinalManifestations.ocular || [],
        hepatobiliary: extraintestinalManifestations.hepatobiliary || [],
        renal: extraintestinalManifestations.renal || [],
        pulmonary: extraintestinalManifestations.pulmonary || [],
        hematologic: extraintestinalManifestations.hematologic || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('extraintestinal_manifestations', manifestationsData, context);
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
        bmi: nutritionalAssessment.bmi || '',
        weightChange: nutritionalAssessment.weightChange || '',
        albumin: nutritionalAssessment.albumin || '',
        prealbumin: nutritionalAssessment.prealbumin || '',
        vitaminDeficiencies: nutritionalAssessment.vitaminDeficiencies || [],
        mineralDeficiencies: nutritionalAssessment.mineralDeficiencies || [],
        nutritionalSupport: nutritionalAssessment.nutritionalSupport || '',
        dietaryRestrictions: nutritionalAssessment.dietaryRestrictions || [],
        malabsorption: nutritionalAssessment.malabsorption || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('nutritional_assessments', nutritionData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveIbdSurgicalPlanning(ibdSurgicalPlanning, patientId, documentId, extractedData, context) {
    try {
      const surgicalData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        planningDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        surgeryDiscussed: ibdSurgicalPlanning.surgeryDiscussed || false,
        surgeryType: ibdSurgicalPlanning.surgeryType || '',
        urgency: ibdSurgicalPlanning.urgency || '',
        indications: ibdSurgicalPlanning.indications || [],
        risks: ibdSurgicalPlanning.risks || [],
        pouchOption: ibdSurgicalPlanning.pouchOption || '',
        patientPreference: ibdSurgicalPlanning.patientPreference || '',
        consultationScheduled: ibdSurgicalPlanning.consultationScheduled || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('ibd_surgical_planning', surgicalData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveFlareManagement(flareManagement, patientId, documentId, extractedData, context) {
    try {
      const flareData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        flareDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        currentFlareWeek: flareManagement.currentFlareWeek || '',
        steroidResponse: flareManagement.steroidResponse || '',
        rescueTherapy: flareManagement.rescueTherapy || [],
        admissionCriteria: flareManagement.admissionCriteria || [],
        outpatientMonitoring: flareManagement.outpatientMonitoring || {},
        escalationPlan: flareManagement.escalationPlan || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('flare_management', flareData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCancerSurveillance(cancerSurveillance, patientId, documentId, extractedData, context) {
    try {
      const surveillanceData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        riskFactors: cancerSurveillance.riskFactors || [],
        surveillanceInterval: cancerSurveillance.surveillanceInterval || '',
        lastColonoscopy: cancerSurveillance.lastColonoscopy || '',
        nextDue: cancerSurveillance.nextDue || '',
        chromoendoscopy: cancerSurveillance.chromoendoscopy || false,
        randomBiopsies: cancerSurveillance.randomBiopsies || false,
        dysplasiaHistory: cancerSurveillance.dysplasiaHistory || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('cancer_surveillance', surveillanceData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new IbdFieldMappingService();
