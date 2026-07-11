const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class NeurologyFieldMappingService {
  constructor() {
    this.serviceName = 'NeurologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[NeurologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_NEUROLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for NeurologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[NeurologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[NeurologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveMovementDisorderAssessment(movementDisorderAssessment, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const assessmentData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        visitDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diagnosis: movementDisorderAssessment.diagnosis || '',
        hoehnYahrStage: movementDisorderAssessment.hoehnYahrStage || '',
        updrsScores: movementDisorderAssessment.updrsScores || {},
        diseaseOnset: movementDisorderAssessment.diseaseOnset || '',
        diseaseDuration: movementDisorderAssessment.diseaseDuration || '',
        motorSubtype: movementDisorderAssessment.motorSubtype || '',
        laterality: movementDisorderAssessment.laterality || '',
        progressionRate: movementDisorderAssessment.progressionRate || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('movement_disorder_assessments', assessmentData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveParkinsonianFeatures(parkinsonianFeatures, patientId, documentId, extractedData, context) {
    try {
      const featuresData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        tremor: parkinsonianFeatures.tremor || {},
        bradykinesia: parkinsonianFeatures.bradykinesia || {},
        rigidity: parkinsonianFeatures.rigidity || {},
        posturalInstability: parkinsonianFeatures.posturalInstability || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('parkinsonian_features', featuresData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveGaitAnalysis(gaitAnalysis, patientId, documentId, extractedData, context) {
    try {
      const gaitData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        gaitPattern: gaitAnalysis.gaitPattern || '',
        strideLength: gaitAnalysis.strideLength || '',
        armSwing: gaitAnalysis.armSwing || '',
        turningSteps: gaitAnalysis.turningSteps || '',
        freezingOfGait: gaitAnalysis.freezingOfGait || {},
        festination: gaitAnalysis.festination || false,
        posture: gaitAnalysis.posture || '',
        assistiveDevice: gaitAnalysis.assistiveDevice || '',
        walkingSpeed: gaitAnalysis.walkingSpeed || '',
        dualTasking: gaitAnalysis.dualTasking || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('gait_analyses', gaitData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMotorComplications(motorComplications, patientId, documentId, extractedData, context) {
    try {
      const complicationsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        motorFluctuations: motorComplications.motorFluctuations || {},
        dyskinesias: motorComplications.dyskinesias || {},
        offTime: motorComplications.offTime || '',
        onTimeWithDyskinesia: motorComplications.onTimeWithDyskinesia || '',
        onTimeWithoutDyskinesia: motorComplications.onTimeWithoutDyskinesia || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('motor_complications', complicationsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveNonMotorSymptoms(nonMotorSymptoms, patientId, documentId, extractedData, context) {
    try {
      const symptomsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        cognitive: nonMotorSymptoms.cognitive || {},
        neuropsychiatric: nonMotorSymptoms.neuropsychiatric || {},
        sleep: nonMotorSymptoms.sleep || {},
        autonomic: nonMotorSymptoms.autonomic || {},
        sensory: nonMotorSymptoms.sensory || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('non_motor_symptoms', symptomsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveNeurologicalExam(neurologicalExam, patientId, documentId, extractedData, context) {
    try {
      const examData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        examDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        mentalStatus: neurologicalExam.mentalStatus || {},
        cranialNerves: neurologicalExam.cranialNerves || {},
        motor: neurologicalExam.motor || {},
        sensory: neurologicalExam.sensory || {},
        reflexes: neurologicalExam.reflexes || {},
        coordination: neurologicalExam.coordination || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('neurological_exams', examData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveParkinsonMedications(parkinsonMedications, patientId, documentId, extractedData, context) {
    try {
      const medicationsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        levodopa: parkinsonMedications.levodopa || {},
        dopamineAgonists: parkinsonMedications.dopamineAgonists || [],
        maoInhibitors: parkinsonMedications.maoInhibitors || [],
        comtInhibitors: parkinsonMedications.comtInhibitors || [],
        anticholinergics: parkinsonMedications.anticholinergics || [],
        amantadine: parkinsonMedications.amantadine || {},
        symptomatic: parkinsonMedications.symptomatic || [],
        ledEquivalent: parkinsonMedications.ledEquivalent || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('parkinson_medications', medicationsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDeepBrainStimulation(deepBrainStimulation, patientId, documentId, extractedData, context) {
    try {
      const dbsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        status: deepBrainStimulation.status || '',
        target: deepBrainStimulation.target || '',
        laterality: deepBrainStimulation.laterality || '',
        implantDate: deepBrainStimulation.implantDate || '',
        programmingSettings: deepBrainStimulation.programmingSettings || {},
        response: deepBrainStimulation.response || '',
        complications: deepBrainStimulation.complications || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('deep_brain_stimulation', dbsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveEpilepsyAssessment(epilepsyAssessment, patientId, documentId, extractedData, context) {
    try {
      const epilepsyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        seizureTypes: epilepsyAssessment.seizureTypes || [],
        seizureFrequency: epilepsyAssessment.seizureFrequency || '',
        lastSeizure: epilepsyAssessment.lastSeizure || '',
        triggers: epilepsyAssessment.triggers || [],
        auraSymptoms: epilepsyAssessment.auraSymptoms || [],
        postictalSymptoms: epilepsyAssessment.postictalSymptoms || [],
        antiEpilepticDrugs: epilepsyAssessment.antiEpilepticDrugs || [],
        eegFindings: epilepsyAssessment.eegFindings || '',
        seizureDiary: epilepsyAssessment.seizureDiary || [],
        vagusNerveStimulator: epilepsyAssessment.vagusNerveStimulator || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('epilepsy_assessments', epilepsyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveHeadacheAssessment(headacheAssessment, patientId, documentId, extractedData, context) {
    try {
      const headacheData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        headacheType: headacheAssessment.headacheType || '',
        frequency: headacheAssessment.frequency || '',
        severity: headacheAssessment.severity || '',
        duration: headacheAssessment.duration || '',
        location: headacheAssessment.location || '',
        quality: headacheAssessment.quality || '',
        triggers: headacheAssessment.triggers || [],
        associatedSymptoms: headacheAssessment.associatedSymptoms || {},
        abortiveTherapy: headacheAssessment.abortiveTherapy || [],
        preventiveTherapy: headacheAssessment.preventiveTherapy || [],
        headacheDiary: headacheAssessment.headacheDiary || [],
        midasScore: headacheAssessment.midasScore || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('headache_assessments', headacheData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMultipleSclerosisAssessment(multipleSclerosisAssessment, patientId, documentId, extractedData, context) {
    try {
      const msData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        msType: multipleSclerosisAssessment.msType || '',
        edssScore: multipleSclerosisAssessment.edssScore || '',
        relapseHistory: multipleSclerosisAssessment.relapseHistory || [],
        currentDmt: multipleSclerosisAssessment.currentDmt || {},
        mriFindings: multipleSclerosisAssessment.mriFindings || {},
        symptomManagement: multipleSclerosisAssessment.symptomManagement || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('multiple_sclerosis_assessments', msData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveStrokeAssessment(strokeAssessment, patientId, documentId, extractedData, context) {
    try {
      const strokeData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        eventDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        strokeType: strokeAssessment.strokeType || '',
        nihssScore: strokeAssessment.nihssScore || '',
        mrsScore: strokeAssessment.mrsScore || '',
        territory: strokeAssessment.territory || '',
        mechanism: strokeAssessment.mechanism || '',
        thrombolysis: strokeAssessment.thrombolysis || {},
        thrombectomy: strokeAssessment.thrombectomy || {},
        deficits: strokeAssessment.deficits || [],
        secondaryPrevention: strokeAssessment.secondaryPrevention || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('stroke_assessments', strokeData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDementiaAssessment(dementiaAssessment, patientId, documentId, extractedData, context) {
    try {
      const dementiaData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        dementiaType: dementiaAssessment.dementiaType || '',
        cdrsScore: dementiaAssessment.cdrsScore || '',
        functionalStatus: dementiaAssessment.functionalStatus || {},
        behavioralSymptoms: dementiaAssessment.behavioralSymptoms || [],
        cognitiveEnhancers: dementiaAssessment.cognitiveEnhancers || [],
        caregiverBurden: dementiaAssessment.caregiverBurden || '',
        safetyAssessment: dementiaAssessment.safetyAssessment || {},
        advanceDirectives: dementiaAssessment.advanceDirectives || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('dementia_assessments', dementiaData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePeripheralNeuropathy(peripheralNeuropathy, patientId, documentId, extractedData, context) {
    try {
      const neuropathyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        pattern: peripheralNeuropathy.pattern || '',
        distribution: peripheralNeuropathy.distribution || '',
        sensorySymptoms: peripheralNeuropathy.sensorySymptoms || [],
        motorSymptoms: peripheralNeuropathy.motorSymptoms || [],
        autonomicSymptoms: peripheralNeuropathy.autonomicSymptoms || [],
        ncvEmgFindings: peripheralNeuropathy.ncvEmgFindings || {},
        etiology: peripheralNeuropathy.etiology || '',
        neuropathicPainScale: peripheralNeuropathy.neuropathicPainScale || '',
        treatment: peripheralNeuropathy.treatment || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('peripheral_neuropathy', neuropathyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveNeuromuscularDisorder(neuromuscularDisorder, patientId, documentId, extractedData, context) {
    try {
      const neuromuscularData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diagnosis: neuromuscularDisorder.diagnosis || '',
        muscleWeakness: neuromuscularDisorder.muscleWeakness || {},
        muscleAtrophy: neuromuscularDisorder.muscleAtrophy || [],
        fasciculations: neuromuscularDisorder.fasciculations || [],
        reflexChanges: neuromuscularDisorder.reflexChanges || '',
        respiratoryFunction: neuromuscularDisorder.respiratoryFunction || {},
        bulbarFunction: neuromuscularDisorder.bulbarFunction || '',
        alsfrScore: neuromuscularDisorder.alsfrScore || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('neuromuscular_disorders', neuromuscularData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NeurologyFieldMappingService();
