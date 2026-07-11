const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class RheumatologyFieldMappingService {
  constructor() {
    this.serviceName = 'RheumatologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[RheumatologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_RHEUMATOLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for RheumatologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[RheumatologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[RheumatologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveRheumatologicAssessment(rheumatologicAssessment, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const assessmentData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: rheumatologicAssessment.chiefComplaint || '',
        symptomDuration: rheumatologicAssessment.symptomDuration || '',
        morningStiffness: rheumatologicAssessment.morningStiffness || {},
        jointInvolvement: rheumatologicAssessment.jointInvolvement || {},
        systemicSymptoms: rheumatologicAssessment.systemicSymptoms || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('rheumatologic_assessments', assessmentData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAutoantibodyProfile(autoantibodyProfile, patientId, documentId, extractedData, context) {
    try {
      const antibodyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        ana: autoantibodyProfile.ana || {},
        antiDsDna: autoantibodyProfile.antiDsDna || '',
        antiSmith: autoantibodyProfile.antiSmith || '',
        antiSsaRo: autoantibodyProfile.antiSsaRo || '',
        antiSsbLa: autoantibodyProfile.antiSsbLa || '',
        antiRnp: autoantibodyProfile.antiRnp || '',
        antiScl70: autoantibodyProfile.antiScl70 || '',
        antiCentromere: autoantibodyProfile.antiCentromere || '',
        antiJo1: autoantibodyProfile.antiJo1 || '',
        antiCcp: autoantibodyProfile.antiCcp || '',
        rheumatoidFactor: autoantibodyProfile.rheumatoidFactor || '',
        antiphospholipidAntibodies: autoantibodyProfile.antiphospholipidAntibodies || {},
        anca: autoantibodyProfile.anca || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('autoantibody_profiles', antibodyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveInflammatoryMarkers(inflammatoryMarkers, patientId, documentId, extractedData, context) {
    try {
      const markerData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        esr: inflammatoryMarkers.esr || '',
        crp: inflammatoryMarkers.crp || '',
        ferritin: inflammatoryMarkers.ferritin || '',
        complement: inflammatoryMarkers.complement || {},
        immunoglobulins: inflammatoryMarkers.immunoglobulins || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('inflammatory_markers', markerData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveConnectiveTissueDiseaseAssessment(connectiveTissueDiseaseAssessment, patientId, documentId, extractedData, context) {
    try {
      const ctdData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diagnosis: connectiveTissueDiseaseAssessment.diagnosis || '',
        classificationCriteria: connectiveTissueDiseaseAssessment.classificationCriteria || [],
        diseaseActivity: connectiveTissueDiseaseAssessment.diseaseActivity || {},
        organInvolvement: connectiveTissueDiseaseAssessment.organInvolvement || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('connective_tissue_diseases', ctdData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveLupusAssessment(lupusAssessment, patientId, documentId, extractedData, context) {
    try {
      const lupusData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        sledaiScore: lupusAssessment.sledaiScore || '',
        acr1997Criteria: lupusAssessment.acr1997Criteria || [],
        eularCriteria: lupusAssessment.eularCriteria || [],
        cutaneousManifestations: lupusAssessment.cutaneousManifestations || {},
        renalInvolvement: lupusAssessment.renalInvolvement || {},
        neurologicalInvolvement: lupusAssessment.neurologicalInvolvement || [],
        hematologicalInvolvement: lupusAssessment.hematologicalInvolvement || {},
        serositis: lupusAssessment.serositis || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('lupus_assessments', lupusData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRheumatoidArthritisAssessment(rheumatoidArthritisAssessment, patientId, documentId, extractedData, context) {
    try {
      const raData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        das28Score: rheumatoidArthritisAssessment.das28Score || '',
        cdaiScore: rheumatoidArthritisAssessment.cdaiScore || '',
        sdaiScore: rheumatoidArthritisAssessment.sdaiScore || '',
        acr20Response: rheumatoidArthritisAssessment.acr20Response || '',
        jointCounts: rheumatoidArthritisAssessment.jointCounts || {},
        functionalStatus: rheumatoidArthritisAssessment.functionalStatus || '',
        radiographicProgression: rheumatoidArthritisAssessment.radiographicProgression || '',
        extraarticularManifestations: rheumatoidArthritisAssessment.extraarticularManifestations || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('rheumatoid_arthritis_assessments', raData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveVasculitisAssessment(vasculitisAssessment, patientId, documentId, extractedData, context) {
    try {
      const vasculitisData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: vasculitisAssessment.type || '',
        bvasScore: vasculitisAssessment.bvasScore || '',
        vdiScore: vasculitisAssessment.vdiScore || '',
        organSystems: vasculitisAssessment.organSystems || [],
        biopsyResults: vasculitisAssessment.biopsyResults || '',
        angiographicFindings: vasculitisAssessment.angiographicFindings || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('vasculitis_assessments', vasculitisData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSpondyloarthritisAssessment(spondyloarthritisAssessment, patientId, documentId, extractedData, context) {
    try {
      const spaData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: spondyloarthritisAssessment.type || '',
        basdaiScore: spondyloarthritisAssessment.basdaiScore || '',
        basfiScore: spondyloarthritisAssessment.basfiScore || '',
        asdas: spondyloarthritisAssessment.asdas || '',
        hlab27: spondyloarthritisAssessment.hlab27 || '',
        sacroiliitis: spondyloarthritisAssessment.sacroiliitis || '',
        spinalMobility: spondyloarthritisAssessment.spinalMobility || {},
        enthesitis: spondyloarthritisAssessment.enthesitis || [],
        dactylitis: spondyloarthritisAssessment.dactylitis || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('spondyloarthritis_assessments', spaData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMyositisAssessment(myositisAssessment, patientId, documentId, extractedData, context) {
    try {
      const myositisData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: myositisAssessment.type || '',
        muscleWeakness: myositisAssessment.muscleWeakness || {},
        skinManifestations: myositisAssessment.skinManifestations || {},
        muscleEnzymes: myositisAssessment.muscleEnzymes || {},
        emgFindings: myositisAssessment.emgFindings || '',
        muscleBiopsy: myositisAssessment.muscleBiopsy || '',
        myositisAntibodies: myositisAssessment.myositisAntibodies || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('myositis_assessments', myositisData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSjogrensSyndromeAssessment(sjogrensSyndromeAssessment, patientId, documentId, extractedData, context) {
    try {
      const sjogrensData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        sicca: sjogrensSyndromeAssessment.sicca || {},
        salivarGlandBiopsy: sjogrensSyndromeAssessment.salivarGlandBiopsy || '',
        sialography: sjogrensSyndromeAssessment.sialography || '',
        systemicManifestations: sjogrensSyndromeAssessment.systemicManifestations || [],
        essdaiScore: sjogrensSyndromeAssessment.essdaiScore || '',
        esspriScore: sjogrensSyndromeAssessment.esspriScore || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('sjogrens_syndrome_assessments', sjogrensData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSclerodermaAssessment(sclerodermaAssessment, patientId, documentId, extractedData, context) {
    try {
      const sclerodermaData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: sclerodermaAssessment.type || '',
        skinThickness: sclerodermaAssessment.skinThickness || {},
        raynaudsPhenomenon: sclerodermaAssessment.raynaudsPhenomenon || {},
        internalOrganInvolvement: sclerodermaAssessment.internalOrganInvolvement || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('scleroderma_assessments', sclerodermaData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveGoutAssessment(goutAssessment, patientId, documentId, extractedData, context) {
    try {
      const goutData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        uricAcidLevel: goutAssessment.uricAcidLevel || '',
        jointAspirate: goutAssessment.jointAspirate || {},
        tophiPresent: goutAssessment.tophiPresent || false,
        tophiLocations: goutAssessment.tophiLocations || [],
        flareFrequency: goutAssessment.flareFrequency || '',
        renalInvolvement: goutAssessment.renalInvolvement || '',
        dualEnergyCtFindings: goutAssessment.dualEnergyCtFindings || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('gout_assessments', goutData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRheumatologicTreatment(rheumatologicTreatment, patientId, documentId, extractedData, context) {
    try {
      const treatmentData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        treatmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        dmards: rheumatologicTreatment.dmards || [],
        biologics: rheumatologicTreatment.biologics || [],
        corticosteroids: rheumatologicTreatment.corticosteroids || {},
        nsaids: rheumatologicTreatment.nsaids || [],
        adjunctTherapies: rheumatologicTreatment.adjunctTherapies || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('rheumatologic_treatments', treatmentData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRheumatologicMonitoring(rheumatologicMonitoring, patientId, documentId, extractedData, context) {
    try {
      const monitoringData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diseaseActivityMonitoring: rheumatologicMonitoring.diseaseActivityMonitoring || {},
        medicationMonitoring: rheumatologicMonitoring.medicationMonitoring || [],
        immunizationStatus: rheumatologicMonitoring.immunizationStatus || {},
        screeningProtocols: rheumatologicMonitoring.screeningProtocols || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('rheumatologic_monitoring', monitoringData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new RheumatologyFieldMappingService();
