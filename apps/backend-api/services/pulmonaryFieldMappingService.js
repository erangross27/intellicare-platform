const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class PulmonaryFieldMappingService {
  constructor() {
    this.serviceName = 'PulmonaryFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[PulmonaryFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_PULMONARYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for PulmonaryFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[PulmonaryFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[PulmonaryFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async savePulmonaryFunctionTests(pulmonaryFunctionTests, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const pftData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        preBronchodilator: pulmonaryFunctionTests.preBronchodilator || {},
        postBronchodilator: pulmonaryFunctionTests.postBronchodilator || {},
        reversibility: pulmonaryFunctionTests.reversibility || '',
        interpretation: pulmonaryFunctionTests.interpretation || '',
        dlco: pulmonaryFunctionTests.dlco || '',
        lungVolumes: pulmonaryFunctionTests.lungVolumes || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pulmonary_function_tests', pftData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAsthmaAssessment(asthmaAssessment, patientId, documentId, extractedData, context) {
    try {
      const asthmaData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        severity: asthmaAssessment.severity || '',
        control: asthmaAssessment.control || '',
        actScore: asthmaAssessment.actScore || '',
        ginaStep: asthmaAssessment.ginaStep || '',
        exacerbationHistory: asthmaAssessment.exacerbationHistory || [],
        triggers: asthmaAssessment.triggers || [],
        nocturnal: asthmaAssessment.nocturnal || '',
        exerciseLimitation: asthmaAssessment.exerciseLimitation || '',
        rescueUseFrequency: asthmaAssessment.rescueUseFrequency || '',
        peakFlowPersonalBest: asthmaAssessment.peakFlowPersonalBest || '',
        fenoLevel: asthmaAssessment.fenoLevel || '',
        sputumEosinophils: asthmaAssessment.sputumEosinophils || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('asthma_assessments', asthmaData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAsthmaActionPlan(asthmaActionPlan, patientId, documentId, extractedData, context) {
    try {
      const actionPlanData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        planDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        greenZone: asthmaActionPlan.greenZone || {},
        yellowZone: asthmaActionPlan.yellowZone || {},
        redZone: asthmaActionPlan.redZone || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('asthma_action_plans', actionPlanData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRespiratoryMedications(respiratoryMedications, patientId, documentId, extractedData, context) {
    try {
      const medicationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        controllers: respiratoryMedications.controllers || [],
        relievers: respiratoryMedications.relievers || [],
        biologics: respiratoryMedications.biologics || {},
        nebulizers: respiratoryMedications.nebulizers || [],
        oralCorticosteroids: respiratoryMedications.oralCorticosteroids || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('respiratory_medications', medicationData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAllergyAssessment(allergyAssessment, patientId, documentId, extractedData, context) {
    try {
      const allergyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        environmentalAllergens: allergyAssessment.environmentalAllergens || [],
        totalIge: allergyAssessment.totalIge || '',
        specificIge: allergyAssessment.specificIge || [],
        eosinophilCount: allergyAssessment.eosinophilCount || '',
        aspergillusSpecific: allergyAssessment.aspergillusSpecific || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('allergy_assessments', allergyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveEnvironmentalExposures(environmentalExposures, patientId, documentId, extractedData, context) {
    try {
      const exposureData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        housing: environmentalExposures.housing || {},
        occupational: environmentalExposures.occupational || [],
        smoking: environmentalExposures.smoking || {},
        airQuality: environmentalExposures.airQuality || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('environmental_exposures', exposureData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCopdAssessment(copdAssessment, patientId, documentId, extractedData, context) {
    try {
      const copdData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        goldStage: copdAssessment.goldStage || '',
        goldGroup: copdAssessment.goldGroup || '',
        catScore: copdAssessment.catScore || '',
        mmrcDyspneaScale: copdAssessment.mmrcDyspneaScale || '',
        exacerbationsPerYear: copdAssessment.exacerbationsPerYear || 0,
        bodePlexIndex: copdAssessment.bodePlexIndex || '',
        sixMinuteWalkDistance: copdAssessment.sixMinuteWalkDistance || '',
        oxygenRequirement: copdAssessment.oxygenRequirement || {},
        emphysemaDistribution: copdAssessment.emphysemaDistribution || '',
        chronicBronchitisFeatures: copdAssessment.chronicBronchitisFeatures || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('copd_assessments', copdData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSleepStudy(sleepStudy, patientId, documentId, extractedData, context) {
    try {
      const sleepData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        studyType: sleepStudy.studyType || '',
        ahi: sleepStudy.ahi || '',
        rdi: sleepStudy.rdi || '',
        lowestO2: sleepStudy.lowestO2 || '',
        time88Below: sleepStudy.time88Below || '',
        arousalIndex: sleepStudy.arousalIndex || '',
        sleepEfficiency: sleepStudy.sleepEfficiency || '',
        remPercentage: sleepStudy.remPercentage || '',
        cpapTitration: sleepStudy.cpapTitration || {},
        diagnosis: sleepStudy.diagnosis || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('sleep_studies', sleepData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePulmonaryImaging(pulmonaryImaging, patientId, documentId, extractedData, context) {
    try {
      const imagingData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chestXray: pulmonaryImaging.chestXray || {},
        ctChest: pulmonaryImaging.ctChest || {},
        ventilationPerfusion: pulmonaryImaging.ventilationPerfusion || {},
        pulmonaryAngiography: pulmonaryImaging.pulmonaryAngiography || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pulmonary_imaging', imagingData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRespiratoryInfections(respiratoryInfections, patientId, documentId, extractedData, context) {
    try {
      const infectionData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        currentInfection: respiratoryInfections.currentInfection || {},
        recurrentInfections: respiratoryInfections.recurrentInfections || [],
        pneumoniaHistory: respiratoryInfections.pneumoniaHistory || [],
        tuberculosisRisk: respiratoryInfections.tuberculosisRisk || '',
        immunizations: respiratoryInfections.immunizations || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('respiratory_infections', infectionData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePulmonaryRehabilitation(pulmonaryRehabilitation, patientId, documentId, extractedData, context) {
    try {
      const rehabData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        enrollmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        enrolled: pulmonaryRehabilitation.enrolled || false,
        program: pulmonaryRehabilitation.program || '',
        components: pulmonaryRehabilitation.components || [],
        exerciseCapacity: pulmonaryRehabilitation.exerciseCapacity || '',
        breathingTechniques: pulmonaryRehabilitation.breathingTechniques || [],
        nutritionalCounseling: pulmonaryRehabilitation.nutritionalCounseling || false,
        psychosocialSupport: pulmonaryRehabilitation.psychosocialSupport || false,
        outcomes: pulmonaryRehabilitation.outcomes || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pulmonary_rehabilitation', rehabData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRespiratoryDevices(respiratoryDevices, patientId, documentId, extractedData, context) {
    try {
      const deviceData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        homeNebulizer: respiratoryDevices.homeNebulizer || false,
        peakFlowMeter: respiratoryDevices.peakFlowMeter || false,
        spacerDevice: respiratoryDevices.spacerDevice || '',
        cpapBipap: respiratoryDevices.cpapBipap || {},
        oxygenConcentrator: respiratoryDevices.oxygenConcentrator || false,
        hepaFilter: respiratoryDevices.hepaFilter || false,
        airPurifier: respiratoryDevices.airPurifier || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('respiratory_devices', deviceData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PulmonaryFieldMappingService();
