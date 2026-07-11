const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class AnesthesiologyFieldMappingService {
  constructor() {
    this.serviceName = 'AnesthesiologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[AnesthesiologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_ANESTHESIOLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for AnesthesiologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[AnesthesiologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[AnesthesiologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async savePreoperativeAssessment(preOpData, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const assessment = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        asaClassification: preOpData.asaClassification || '',
        mallampati: preOpData.mallampati || '',
        airwayAssessment: preOpData.airwayAssessment || {},
        medicalHistory: preOpData.medicalHistory || [],
        allergies: preOpData.allergies || extractedData.allergies || [],
        medications: preOpData.medications || extractedData.medications || [],
        npoStatus: preOpData.npoStatus || '',
        labResults: preOpData.labResults || {},
        cardiacRisk: preOpData.cardiacRisk || {},
        plannedProcedure: preOpData.plannedProcedure || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('preoperative_assessments', assessment, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveIntraoperativeRecord(intraOpData, patientId, documentId, extractedData, context) {
    try {
      const record = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        anesthesiaType: intraOpData.anesthesiaType || '',
        induction: intraOpData.induction || {},
        maintenance: intraOpData.maintenance || {},
        airwayManagement: intraOpData.airwayManagement || {},
        monitoring: intraOpData.monitoring || {},
        vitalSigns: intraOpData.vitalSigns || [],
        fluids: intraOpData.fluids || [],
        bloodProducts: intraOpData.bloodProducts || [],
        medications: intraOpData.medications || [],
        complications: intraOpData.complications || [],
        emergence: intraOpData.emergence || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('intraoperative_records', record, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePostAnesthesiaRecord(pacuData, patientId, documentId, extractedData, context) {
    try {
      const pacuRecord = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recoveryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        aldretteScore: pacuData.aldretteScore || [],
        painScores: pacuData.painScores || [],
        vitalSigns: pacuData.vitalSigns || [],
        medications: pacuData.medications || [],
        nausea: pacuData.nausea || '',
        complications: pacuData.complications || [],
        dischargeReadiness: pacuData.dischargeReadiness || '',
        duration: pacuData.duration || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pacu_records', pacuRecord, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePainManagement(painData, patientId, documentId, extractedData, context) {
    try {
      const painManagement = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        painType: painData.painType || '',
        painScores: painData.painScores || {},
        painLocation: painData.painLocation || [],
        characteristics: painData.characteristics || '',
        interventions: painData.interventions || [],
        medications: painData.medications || [],
        procedures: painData.procedures || [],
        response: painData.response || '',
        functionalImprovement: painData.functionalImprovement || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pain_management', painManagement, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAnesthesiaConsultation(consultation, patientId, documentId, extractedData, context) {
    try {
      const consultData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        reason: consultation.reason || extractedData.chiefComplaint || '',
        assessment: consultation.assessment || {},
        recommendations: consultation.recommendations || extractedData.recommendations || '',
        riskStratification: consultation.riskStratification || {},
        optimizations: consultation.optimizations || [],
        plannedAnesthesia: consultation.plannedAnesthesia || '',
        followUp: consultation.followUp || extractedData.followUpAppointments || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('anesthesia_consultations', consultData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AnesthesiologyFieldMappingService();
