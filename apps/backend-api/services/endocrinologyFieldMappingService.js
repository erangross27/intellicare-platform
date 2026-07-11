const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class EndocrinologyFieldMappingService {
  constructor() {
    this.serviceName = 'EndocrinologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[EndocrinologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_ENDOCRINOLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for EndocrinologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[EndocrinologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[EndocrinologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveThyroidFunction(thyroidFunction, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const thyroidData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        tsh: thyroidFunction.tsh || '',
        freeT4: thyroidFunction.freeT4 || '',
        freeT3: thyroidFunction.freeT3 || '',
        thyroidAntibodies: thyroidFunction.thyroidAntibodies || {},
        thyroidUltrasound: thyroidFunction.thyroidUltrasound || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('thyroid_function_tests', thyroidData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAdrenalFunction(adrenalFunction, patientId, documentId, extractedData, context) {
    try {
      const adrenalData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        cortisol: adrenalFunction.cortisol || '',
        acth: adrenalFunction.acth || '',
        dexamethasoneSuppression: adrenalFunction.dexamethasoneSuppression || '',
        aldosterone: adrenalFunction.aldosterone || '',
        renin: adrenalFunction.renin || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('adrenal_function_tests', adrenalData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePituitaryFunction(pituitaryFunction, patientId, documentId, extractedData, context) {
    try {
      const pituitaryData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        prolactin: pituitaryFunction.prolactin || '',
        igf1: pituitaryFunction.igf1 || '',
        growthHormone: pituitaryFunction.growthHormone || '',
        lh: pituitaryFunction.lh || '',
        fsh: pituitaryFunction.fsh || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pituitary_function_tests', pituitaryData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMetabolicPanel(metabolicPanel, patientId, documentId, extractedData, context) {
    try {
      const metabolicData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        fastingGlucose: metabolicPanel.fastingGlucose || '',
        ogtt: metabolicPanel.ogtt || {},
        lipidPanel: metabolicPanel.lipidPanel || {},
        uricAcid: metabolicPanel.uricAcid || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('metabolic_panels', metabolicData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDiabetesManagement(diabetesData, patientId, documentId, extractedData, context) {
    try {
      const managementData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diabetesType: diabetesData.diabetesType || extractedData.diabetesManagement?.diabetesType || '',
        hba1c: diabetesData.currentHbA1c || extractedData.diabetesManagement?.currentHbA1c || '',
        cPeptide: diabetesData.cPeptide || extractedData.diabetesManagement?.cPeptide || '',
        antibodies: diabetesData.antibodies || extractedData.diabetesManagement?.antibodies || [],
        complications: diabetesData.complications || extractedData.diabetesManagement?.complications || {},
        cgmData: extractedData.cgmData || {},
        insulinRegimen: extractedData.insulinRegimen || {},
        insulinPumpSettings: extractedData.insulinPumpSettings || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('diabetes_management', managementData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveEndocrinologyConsultation(consultation, patientId, documentId, extractedData, context) {
    try {
      const consultData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: consultation.chiefComplaint || extractedData.chiefComplaint || '',
        diagnoses: consultation.diagnoses || extractedData.diagnoses || [],
        hormoneProfile: consultation.hormoneProfile || {},
        medications: consultation.medications || extractedData.medications || [],
        recommendations: consultation.recommendations || extractedData.recommendations || '',
        followUp: consultation.followUp || extractedData.followUpAppointments || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('endocrinology_consultations', consultData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveOsteoporosisAssessment(assessment, patientId, documentId, extractedData, context) {
    try {
      const osteoData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        dexaResults: assessment.dexaResults || {},
        tScores: assessment.tScores || {},
        fraxScore: assessment.fraxScore || {},
        boneMarkers: assessment.boneMarkers || {},
        treatments: assessment.treatments || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('osteoporosis_assessments', osteoData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EndocrinologyFieldMappingService();
