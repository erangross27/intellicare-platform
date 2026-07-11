const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class PathologyFieldMappingService {
  constructor() {
    this.serviceName = 'PathologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[PathologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_PATHOLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for PathologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[PathologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[PathologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveSpecimenAnalysis(specimenData, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const specimen = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        collectionDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        specimenType: specimenData.specimenType || '',
        source: specimenData.source || '',
        clinicalHistory: specimenData.clinicalHistory || '',
        grossDescription: specimenData.grossDescription || '',
        microscopic: specimenData.microscopic || '',
        diagnosis: specimenData.diagnosis || '',
        staging: specimenData.staging || {},
        margins: specimenData.margins || {},
        synopticReport: specimenData.synopticReport || {},
        dataSource: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('specimen_analyses', specimen, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveImmunohistochemistry(ihcData, patientId, documentId, extractedData, context) {
    try {
      const ihc = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        specimenId: ihcData.specimenId || '',
        antibodies: ihcData.antibodies || [],
        results: ihcData.results || {},
        tumorMarkers: ihcData.tumorMarkers || {},
        interpretation: ihcData.interpretation || '',
        diagnosticImplication: ihcData.diagnosticImplication || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('immunohistochemistry', ihc, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveFlowCytometry(flowData, patientId, documentId, extractedData, context) {
    try {
      const flow = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        specimenType: flowData.specimenType || '',
        cellCount: flowData.cellCount || '',
        viability: flowData.viability || '',
        markers: flowData.markers || [],
        populations: flowData.populations || {},
        immunophenotype: flowData.immunophenotype || '',
        interpretation: flowData.interpretation || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('flow_cytometry', flow, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCytology(cytologyData, patientId, documentId, extractedData, context) {
    try {
      const cytology = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        collectionDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        specimenType: cytologyData.specimenType || '',
        adequacy: cytologyData.adequacy || '',
        cellularity: cytologyData.cellularity || '',
        findings: cytologyData.findings || '',
        bethesdaCategory: cytologyData.bethesdaCategory || '',
        diagnosis: cytologyData.diagnosis || '',
        recommendations: cytologyData.recommendations || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('cytology', cytology, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMolecularPathology(molecularData, patientId, documentId, extractedData, context) {
    try {
      const molecular = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        testType: molecularData.testType || '',
        methodology: molecularData.methodology || '',
        genes: molecularData.genes || [],
        mutations: molecularData.mutations || [],
        variantAlleleFrequency: molecularData.variantAlleleFrequency || {},
        microsatelliteStatus: molecularData.microsatelliteStatus || '',
        tumorMutationalBurden: molecularData.tumorMutationalBurden || '',
        therapeuticImplications: molecularData.therapeuticImplications || [],
        interpretation: molecularData.interpretation || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('molecular_pathology', molecular, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAutopsy(autopsyData, patientId, documentId, extractedData, context) {
    try {
      const autopsy = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        autopsyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: autopsyData.type || '',
        externalExamination: autopsyData.externalExamination || '',
        internalExamination: autopsyData.internalExamination || {},
        organWeights: autopsyData.organWeights || {},
        histopathology: autopsyData.histopathology || {},
        causeOfDeath: autopsyData.causeOfDeath || '',
        mannerOfDeath: autopsyData.mannerOfDeath || '',
        contributingFactors: autopsyData.contributingFactors || [],
        toxicology: autopsyData.toxicology || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('autopsies', autopsy, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePathologyConsultation(consultation, patientId, documentId, extractedData, context) {
    try {
      const consultData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        referringDiagnosis: consultation.referringDiagnosis || '',
        materialReviewed: consultation.materialReviewed || [],
        additionalStudies: consultation.additionalStudies || [],
        consultantOpinion: consultation.consultantOpinion || '',
        finalDiagnosis: consultation.finalDiagnosis || extractedData.diagnoses || [],
        recommendations: consultation.recommendations || extractedData.recommendations || '',
        concordance: consultation.concordance || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('pathology_consultations', consultData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PathologyFieldMappingService();
