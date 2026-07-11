const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class ENTFieldMappingService {
  constructor() {
    this.serviceName = 'EntFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[EntFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_ENTFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for EntFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[EntFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[EntFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveAudiometry(audiometryData, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const audiometry = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        pureTonesRight: audiometryData.pureTonesRight || {},
        pureTonesLeft: audiometryData.pureTonesLeft || {},
        boneConduction: audiometryData.boneConduction || {},
        speechAudiometry: audiometryData.speechAudiometry || {},
        tympanometry: audiometryData.tympanometry || {},
        acousticReflexes: audiometryData.acousticReflexes || {},
        hearingLossType: audiometryData.hearingLossType || '',
        degree: audiometryData.degree || '',
        configuration: audiometryData.configuration || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('audiometry', audiometry, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveLaryngoscopy(laryngoscopyData, patientId, documentId, extractedData, context) {
    try {
      const laryngoscopy = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: laryngoscopyData.type || '',
        nasalCavity: laryngoscopyData.nasalCavity || {},
        nasopharynx: laryngoscopyData.nasopharynx || {},
        oropharynx: laryngoscopyData.oropharynx || {},
        hypopharynx: laryngoscopyData.hypopharynx || {},
        larynx: laryngoscopyData.larynx || {},
        vocalCords: laryngoscopyData.vocalCords || {},
        mobility: laryngoscopyData.mobility || '',
        lesions: laryngoscopyData.lesions || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('laryngoscopy', laryngoscopy, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveNasalEndoscopy(endoscopyData, patientId, documentId, extractedData, context) {
    try {
      const endoscopy = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        septum: endoscopyData.septum || {},
        turbinates: endoscopyData.turbinates || {},
        mucosa: endoscopyData.mucosa || '',
        polyps: endoscopyData.polyps || [],
        sinusOstia: endoscopyData.sinusOstia || {},
        adenoids: endoscopyData.adenoids || '',
        findings: endoscopyData.findings || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('nasal_endoscopy', endoscopy, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveVestibularTesting(vestibularData, patientId, documentId, extractedData, context) {
    try {
      const vestibular = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        eng: vestibularData.eng || {},
        vng: vestibularData.vng || {},
        caloricTest: vestibularData.caloricTest || {},
        rotaryChair: vestibularData.rotaryChair || {},
        vemp: vestibularData.vemp || {},
        posturalStability: vestibularData.posturalStability || {},
        diagnosis: vestibularData.diagnosis || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('vestibular_testing', vestibular, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSleepStudy(sleepData, patientId, documentId, extractedData, context) {
    try {
      const sleepStudy = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        studyType: sleepData.studyType || '',
        ahi: sleepData.ahi || null,
        rdi: sleepData.rdi || null,
        lowestO2: sleepData.lowestO2 || '',
        sleepEfficiency: sleepData.sleepEfficiency || '',
        sleepStages: sleepData.sleepStages || {},
        arousalIndex: sleepData.arousalIndex || null,
        plmIndex: sleepData.plmIndex || null,
        diagnosis: sleepData.diagnosis || '',
        severity: sleepData.severity || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('sleep_studies', sleepStudy, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAllergySkinTesting(allergyData, patientId, documentId, extractedData, context) {
    try {
      const allergyTest = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        testType: allergyData.testType || '',
        allergens: allergyData.allergens || [],
        positiveReactions: allergyData.positiveReactions || [],
        controls: allergyData.controls || {},
        severity: allergyData.severity || {},
        recommendations: allergyData.recommendations || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('allergy_skin_testing', allergyTest, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSinusCTScan(ctData, patientId, documentId, extractedData, context) {
    try {
      const sinusCT = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        scanDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        maxillarySinus: ctData.maxillarySinus || {},
        ethmoidSinus: ctData.ethmoidSinus || {},
        sphenoidSinus: ctData.sphenoidSinus || {},
        frontalSinus: ctData.frontalSinus || {},
        ostiomeatalComplex: ctData.ostiomeatalComplex || {},
        lundMackayScore: ctData.lundMackayScore || null,
        anatomicVariants: ctData.anatomicVariants || [],
        impression: ctData.impression || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('sinus_ct_scans', sinusCT, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveENTConsultation(consultation, patientId, documentId, extractedData, context) {
    try {
      const consultData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: consultation.chiefComplaint || extractedData.chiefComplaint || '',
        diagnoses: consultation.diagnoses || extractedData.diagnoses || [],
        earExam: consultation.earExam || {},
        noseExam: consultation.noseExam || {},
        throatExam: consultation.throatExam || {},
        neckExam: consultation.neckExam || {},
        procedures: consultation.procedures || [],
        medications: consultation.medications || extractedData.medications || [],
        surgicalPlan: consultation.surgicalPlan || '',
        recommendations: consultation.recommendations || extractedData.recommendations || '',
        followUp: consultation.followUp || extractedData.followUpAppointments || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('ent_consultations', consultData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ENTFieldMappingService();
