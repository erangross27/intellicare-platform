const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class DermatologyFieldMappingService {
  constructor() {
    this.serviceName = 'DermatologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[DermatologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_DERMATOLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for DermatologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[DermatologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[DermatologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveSkinLesion(lesionData, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const lesion = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        examDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        location: lesionData.location || '',
        size: lesionData.size || '',
        color: lesionData.color || '',
        borders: lesionData.borders || '',
        evolution: lesionData.evolution || '',
        dermoscopyFindings: lesionData.dermoscopyFindings || {},
        diagnosis: lesionData.diagnosis || '',
        abcdeAssessment: lesionData.abcdeAssessment || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('skin_lesions', lesion, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSkinBiopsy(biopsyData, patientId, documentId, extractedData, context) {
    try {
      const biopsy = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        biopsyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        site: biopsyData.site || '',
        technique: biopsyData.technique || '',
        clinicalDiagnosis: biopsyData.clinicalDiagnosis || '',
        histopathology: biopsyData.histopathology || '',
        margins: biopsyData.margins || '',
        immunohistochemistry: biopsyData.immunohistochemistry || [],
        finalDiagnosis: biopsyData.finalDiagnosis || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('skin_biopsies', biopsy, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePatchTest(patchTestData, patientId, documentId, extractedData, context) {
    try {
      const patchTest = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        allergens: patchTestData.allergens || [],
        results: patchTestData.results || [],
        positiveReactions: patchTestData.positiveReactions || [],
        recommendations: patchTestData.recommendations || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('patch_tests', patchTest, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePhototesting(phototestData, patientId, documentId, extractedData, context) {
    try {
      const phototest = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        medProtocol: phototestData.medProtocol || '',
        uvaResponse: phototestData.uvaResponse || '',
        uvbResponse: phototestData.uvbResponse || '',
        photosensitivity: phototestData.photosensitivity || '',
        diagnosis: phototestData.diagnosis || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('phototesting', phototest, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDermatologyScoringSystem(scoringData, patientId, documentId, extractedData, context) {
    try {
      const scoring = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        pasiScore: scoringData.pasiScore || null,
        scoradIndex: scoringData.scoradIndex || null,
        dlqi: scoringData.dlqi || null,
        uasScore: scoringData.uasScore || null,
        condition: scoringData.condition || '',
        severity: scoringData.severity || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('dermatology_scoring', scoring, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDermatologyConsultation(consultation, patientId, documentId, extractedData, context) {
    try {
      const consultData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: consultation.chiefComplaint || extractedData.chiefComplaint || '',
        diagnoses: consultation.diagnoses || extractedData.diagnoses || [],
        skinExamination: consultation.skinExamination || {},
        treatments: consultation.treatments || extractedData.medications || [],
        procedures: consultation.procedures || [],
        recommendations: consultation.recommendations || extractedData.recommendations || '',
        followUp: consultation.followUp || extractedData.followUpAppointments || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('dermatology_consultations', consultData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new DermatologyFieldMappingService();
