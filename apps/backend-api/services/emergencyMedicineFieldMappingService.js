const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class EmergencyMedicineFieldMappingService {
  constructor() {
    this.serviceName = 'EmergencyMedicineFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[EmergencyMedicineFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_EMERGENCYMEDICINEFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for EmergencyMedicineFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[EmergencyMedicineFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[EmergencyMedicineFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveEmergencyVisit(emergencyData, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const visitData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        arrivalTime: extractedData.date ? new Date(extractedData.date) : new Date(),
        triageLevel: emergencyData.triageLevel || '',
        arrivalMode: emergencyData.arrivalMode || '',
        chiefComplaint: emergencyData.chiefComplaintDuration || extractedData.chiefComplaint || '',
        primarySurvey: emergencyData.primarySurvey || {},
        vitalSigns: extractedData.vitalSigns || {},
        presentingSymptoms: extractedData.symptoms || [],
        disposition: emergencyData.disposition || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('emergency_visits', visitData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveTraumaAssessment(traumaData, patientId, documentId, extractedData, context) {
    try {
      const assessmentData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        mechanism: traumaData.mechanism || '',
        injuryPattern: traumaData.injuryPattern || [],
        gcs: traumaData.gcs || null,
        rts: traumaData.rts || null,
        traumaActivation: traumaData.traumaActivation || false,
        injuries: traumaData.injuries || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('trauma_assessments', assessmentData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveResuscitation(resuscitationData, patientId, documentId, extractedData, context) {
    try {
      const resusData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        resuscitationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        ivAccess: resuscitationData.ivAccess || '',
        fluids: resuscitationData.fluids || [],
        bloodProducts: resuscitationData.bloodProducts || [],
        medications: resuscitationData.medications || [],
        procedures: resuscitationData.procedures || [],
        rosc: resuscitationData.rosc || null,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('resuscitations', resusData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveEmergencyProcedures(procedures, patientId, documentId, extractedData, context) {
    try {
      const procedureData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        procedures: procedures || extractedData.procedures || [],
        intubation: procedures.intubation || {},
        centralLine: procedures.centralLine || {},
        chestTube: procedures.chestTube || {},
        lumbarPuncture: procedures.lumbarPuncture || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('emergency_procedures', procedureData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveEmergencyDisposition(disposition, patientId, documentId, extractedData, context) {
    try {
      const dispositionData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        dispositionDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        outcome: disposition.outcome || '',
        admitTo: disposition.admitTo || '',
        transferTo: disposition.transferTo || '',
        ama: disposition.ama || false,
        lengthOfStay: disposition.lengthOfStay || '',
        condition: disposition.condition || '',
        instructions: disposition.instructions || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('emergency_dispositions', dispositionData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmergencyMedicineFieldMappingService();
