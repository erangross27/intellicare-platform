const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class CardiologyFieldMappingService {
  constructor() {
    this.serviceName = 'CardiologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[CardiologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_CARDIOLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for CardiologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[CardiologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[CardiologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveEchocardiogram(echocardiogram, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const echoData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        ejectionFraction: echocardiogram.ejectionFraction || '',
        lvedd: echocardiogram.lvedd || '',
        lvesd: echocardiogram.lvesd || '',
        wallMotion: echocardiogram.wallMotion || '',
        valvularFunction: echocardiogram.valvularFunction || {},
        diastolicFunction: echocardiogram.diastolicFunction || '',
        rvsp: echocardiogram.rvsp || '',
        pericardialEffusion: echocardiogram.pericardialEffusion || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('echocardiograms', echoData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveElectrocardiogram(electrocardiogram, patientId, documentId, extractedData, context) {
    try {
      const ecgData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        rhythm: electrocardiogram.rhythm || '',
        rate: electrocardiogram.rate || null,
        prInterval: electrocardiogram.prInterval || '',
        qrsDuration: electrocardiogram.qrsDuration || '',
        qtInterval: electrocardiogram.qtInterval || '',
        qtcInterval: electrocardiogram.qtcInterval || '',
        axis: electrocardiogram.axis || '',
        stChanges: electrocardiogram.stChanges || '',
        tWaveChanges: electrocardiogram.tWaveChanges || '',
        interpretation: electrocardiogram.interpretation || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('electrocardiograms', ecgData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCardiacCatheterization(catheterization, patientId, documentId, extractedData, context) {
    try {
      const cathData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        coronaryAngiography: catheterization.coronaryAngiography || [],
        hemodynamics: catheterization.hemodynamics || {},
        interventions: catheterization.interventions || [],
        timiFlow: catheterization.timiFlow || '',
        ffr: catheterization.ffr || '',
        complications: catheterization.complications || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('cardiac_catheterizations', cathData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveStressTest(stressTest, patientId, documentId, extractedData, context) {
    try {
      const stressData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: stressTest.type || '',
        protocol: stressTest.protocol || '',
        duration: stressTest.duration || '',
        maxHeartRate: stressTest.maxHeartRate || '',
        targetAchieved: stressTest.targetAchieved || false,
        symptoms: stressTest.symptoms || '',
        ecgChanges: stressTest.ecgChanges || '',
        dukeTreadmillScore: stressTest.dukeTreadmillScore || null,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('stress_tests', stressData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCardiologyConsultation(consultation, patientId, documentId, extractedData, context) {
    try {
      const consultData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: consultation.chiefComplaint || extractedData.chiefComplaint || '',
        diagnoses: consultation.diagnoses || extractedData.diagnoses || [],
        riskScores: {
          CHA2DS2VASc: consultation.CHA2DS2VASc || null,
          HASBLED: consultation.HASBLED || null,
          TIMI: consultation.TIMI || null,
          GRACE: consultation.GRACE || null,
          HEART: consultation.HEART || null
        },
        medications: consultation.medications || extractedData.medications || [],
        recommendations: consultation.recommendations || extractedData.recommendations || '',
        followUp: consultation.followUp || extractedData.followUpAppointments || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('cardiology_consultations', consultData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveArrhythmiaMonitoring(monitoring, patientId, documentId, extractedData, context) {
    try {
      const monitorData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        monitoringDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        monitorType: monitoring.monitorType || '',
        duration: monitoring.duration || '',
        arrhythmiasDetected: monitoring.arrhythmiasDetected || [],
        burden: monitoring.burden || '',
        symptoms: monitoring.symptoms || [],
        correlation: monitoring.correlation || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('arrhythmia_monitoring', monitorData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCoronaryImaging(imaging, patientId, documentId, extractedData, context) {
    try {
      const imagingData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        modalityType: imaging.modalityType || '',
        calciumScore: imaging.calciumScore || null,
        plaqueBurden: imaging.plaqueBurden || '',
        stenosis: imaging.stenosis || [],
        recommendations: imaging.recommendations || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('coronary_imaging', imagingData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CardiologyFieldMappingService();
