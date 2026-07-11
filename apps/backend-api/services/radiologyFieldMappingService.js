const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class RadiologyFieldMappingService {
  constructor() {
    this.serviceName = 'RadiologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[RadiologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_RADIOLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for RadiologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[RadiologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[RadiologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveImagingStudy(imagingData, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const study = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        modality: imagingData.modality || '',
        bodyPart: imagingData.bodyPart || '',
        indication: imagingData.indication || '',
        technique: imagingData.technique || '',
        contrast: imagingData.contrast || {},
        findings: imagingData.findings || '',
        impression: imagingData.impression || '',
        comparison: imagingData.comparison || '',
        biRadsScore: imagingData.biRadsScore || null,
        recommendations: imagingData.recommendations || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('imaging_studies', study, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCTScan(ctData, patientId, documentId, extractedData, context) {
    try {
      const ctScan = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        anatomicRegion: ctData.anatomicRegion || '',
        protocol: ctData.protocol || '',
        sliceThickness: ctData.sliceThickness || '',
        contrastPhases: ctData.contrastPhases || [],
        doseLength: ctData.doseLength || '',
        findings: ctData.findings || {},
        measurements: ctData.measurements || [],
        impression: ctData.impression || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('ct_scans', ctScan, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMRIScan(mriData, patientId, documentId, extractedData, context) {
    try {
      const mriScan = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        anatomicRegion: mriData.anatomicRegion || '',
        sequences: mriData.sequences || [],
        fieldStrength: mriData.fieldStrength || '',
        gadolinium: mriData.gadolinium || false,
        findings: mriData.findings || {},
        signalAbnormalities: mriData.signalAbnormalities || [],
        measurements: mriData.measurements || [],
        impression: mriData.impression || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('mri_scans', mriScan, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveUltrasound(ultrasoundData, patientId, documentId, extractedData, context) {
    try {
      const ultrasound = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        examType: ultrasoundData.examType || '',
        transducer: ultrasoundData.transducer || '',
        doppler: ultrasoundData.doppler || false,
        findings: ultrasoundData.findings || {},
        measurements: ultrasoundData.measurements || [],
        vascularity: ultrasoundData.vascularity || '',
        echogenicity: ultrasoundData.echogenicity || '',
        impression: ultrasoundData.impression || '',
        tiradsScore: ultrasoundData.tiradsScore || null,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('ultrasounds', ultrasound, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveInterventionalProcedure(procedureData, patientId, documentId, extractedData, context) {
    try {
      const procedure = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        procedureType: procedureData.procedureType || '',
        indication: procedureData.indication || '',
        approach: procedureData.approach || '',
        guidanceMethod: procedureData.guidanceMethod || '',
        sedation: procedureData.sedation || '',
        findings: procedureData.findings || '',
        specimens: procedureData.specimens || [],
        complications: procedureData.complications || [],
        technicalSuccess: procedureData.technicalSuccess || false,
        followUp: procedureData.followUp || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('interventional_procedures', procedure, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveNuclearMedicine(nuclearData, patientId, documentId, extractedData, context) {
    try {
      const nuclear = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        examType: nuclearData.examType || '',
        radiopharmaceutical: nuclearData.radiopharmaceutical || {},
        dose: nuclearData.dose || '',
        protocol: nuclearData.protocol || '',
        findings: nuclearData.findings || {},
        suvValues: nuclearData.suvValues || [],
        impression: nuclearData.impression || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('nuclear_medicine_studies', nuclear, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRadiologyReport(report, patientId, documentId, extractedData, context) {
    try {
      const reportData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        reportDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        examType: report.examType || '',
        clinicalIndication: report.clinicalIndication || extractedData.chiefComplaint || '',
        comparison: report.comparison || '',
        technique: report.technique || '',
        findings: report.findings || '',
        impression: report.impression || '',
        recommendations: report.recommendations || extractedData.recommendations || '',
        criticalFindings: report.criticalFindings || [],
        reportingStandard: report.reportingStandard || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('radiology_reports', reportData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new RadiologyFieldMappingService();
