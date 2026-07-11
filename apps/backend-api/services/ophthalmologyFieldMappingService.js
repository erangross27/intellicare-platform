const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class OphthalmologyFieldMappingService {
  constructor() {
    this.serviceName = 'OphthalmologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[OphthalmologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_OPHTHALMOLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for OphthalmologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[OphthalmologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[OphthalmologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveVisualAcuity(visualData, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const visual = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        examDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        distanceOD: visualData.distanceOD || '',
        distanceOS: visualData.distanceOS || '',
        nearOD: visualData.nearOD || '',
        nearOS: visualData.nearOS || '',
        correctedOD: visualData.correctedOD || '',
        correctedOS: visualData.correctedOS || '',
        pinhole: visualData.pinhole || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('visual_acuity', visual, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRefraction(refractionData, patientId, documentId, extractedData, context) {
    try {
      const refraction = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        examDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        autorefraction: refractionData.autorefraction || {},
        manifest: refractionData.manifest || {},
        cycloplegic: refractionData.cycloplegic || {},
        keratometry: refractionData.keratometry || {},
        prescriptionOD: refractionData.prescriptionOD || '',
        prescriptionOS: refractionData.prescriptionOS || '',
        addPower: refractionData.addPower || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('refractions', refraction, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSlitLampExam(slitLampData, patientId, documentId, extractedData, context) {
    try {
      const slitLamp = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        examDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        lidsLashes: slitLampData.lidsLashes || {},
        conjunctiva: slitLampData.conjunctiva || {},
        cornea: slitLampData.cornea || {},
        anteriorChamber: slitLampData.anteriorChamber || {},
        iris: slitLampData.iris || {},
        lens: slitLampData.lens || {},
        vitreous: slitLampData.vitreous || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('slit_lamp_exams', slitLamp, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveFundoscopy(fundoscopyData, patientId, documentId, extractedData, context) {
    try {
      const fundoscopy = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        examDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        opticNerve: fundoscopyData.opticNerve || {},
        cupDiscRatio: fundoscopyData.cupDiscRatio || {},
        macula: fundoscopyData.macula || {},
        vessels: fundoscopyData.vessels || {},
        peripheralRetina: fundoscopyData.peripheralRetina || {},
        diabeticRetinopathy: fundoscopyData.diabeticRetinopathy || '',
        hypertensiveRetinopathy: fundoscopyData.hypertensiveRetinopathy || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('fundoscopy_exams', fundoscopy, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveOCT(octData, patientId, documentId, extractedData, context) {
    try {
      const oct = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        scanDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        scanType: octData.scanType || '',
        macularThickness: octData.macularThickness || {},
        rnflThickness: octData.rnflThickness || {},
        gcl: octData.gcl || {},
        findings: octData.findings || '',
        interpretation: octData.interpretation || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('oct_scans', oct, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveVisualField(visualFieldData, patientId, documentId, extractedData, context) {
    try {
      const visualField = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        testType: visualFieldData.testType || '',
        reliability: visualFieldData.reliability || {},
        meanDeviation: visualFieldData.meanDeviation || {},
        patternDeviation: visualFieldData.patternDeviation || {},
        vfi: visualFieldData.vfi || {},
        defects: visualFieldData.defects || [],
        progression: visualFieldData.progression || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('visual_fields', visualField, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveGlaucomaAssessment(glaucomaData, patientId, documentId, extractedData, context) {
    try {
      const glaucoma = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        iop: glaucomaData.iop || {},
        pachymetry: glaucomaData.pachymetry || {},
        gonioscopy: glaucomaData.gonioscopy || {},
        riskFactors: glaucomaData.riskFactors || [],
        glaucomaType: glaucomaData.glaucomaType || '',
        stage: glaucomaData.stage || '',
        targetIOP: glaucomaData.targetIOP || '',
        medications: glaucomaData.medications || extractedData.medications || [],
        procedures: glaucomaData.procedures || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('glaucoma_assessments', glaucoma, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveOphthalmologyConsultation(consultation, patientId, documentId, extractedData, context) {
    try {
      const consultData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: consultation.chiefComplaint || extractedData.chiefComplaint || '',
        diagnoses: consultation.diagnoses || extractedData.diagnoses || [],
        examination: consultation.examination || {},
        procedures: consultation.procedures || [],
        medications: consultation.medications || extractedData.medications || [],
        surgicalPlan: consultation.surgicalPlan || '',
        recommendations: consultation.recommendations || extractedData.recommendations || '',
        followUp: consultation.followUp || extractedData.followUpAppointments || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('ophthalmology_consultations', consultData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new OphthalmologyFieldMappingService();
