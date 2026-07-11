const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class ThoracicSurgeryFieldMappingService {
  constructor() {
    this.serviceName = 'ThoracicSurgeryFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[ThoracicSurgeryFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_THORACICSURGERYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for ThoracicSurgeryFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[ThoracicSurgeryFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[ThoracicSurgeryFieldMapper] Initialization failed:', error);
      throw error;
    }
  }


  async mapAndSaveExtractedData(extractedData, patientId, documentId, sessionId, practiceSubdomain) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const context = {
      serviceId: this.serviceName,
      apiKey: this.serviceToken,
      operation: 'mapAndSaveExtractedData',
      practiceId: practiceSubdomain || global.practiceId || 'global',
      practiceSubdomain: practiceSubdomain
    };

    const results = {
      success: true,
      savedEntities: [],
      errors: []
    };

    try {
      // Map thoracic surgery-specific data
      if (extractedData.thoracicSurgeryAssessment) {
        const assessment = extractedData.thoracicSurgeryAssessment;

        // Save pulmonary function
        if (assessment.pulmonaryFunction) {
          const pulmonaryResult = await this.savePulmonaryFunction(
            assessment.pulmonaryFunction,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (pulmonaryResult.success) {
            results.savedEntities.push('pulmonary_function');
          } else {
            results.errors.push(pulmonaryResult.error);
          }
        }

        // Save tumor staging
        if (assessment.tumorStaging) {
          const stagingResult = await this.saveTumorStaging(
            assessment.tumorStaging,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (stagingResult.success) {
            results.savedEntities.push('tumor_staging');
          } else {
            results.errors.push(stagingResult.error);
          }
        }

        // Save mediastinoscopy
        if (assessment.mediastinoscopy) {
          const mediastinoscopyResult = await this.saveMediastinoscopy(
            assessment.mediastinoscopy,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (mediastinoscopyResult.success) {
            results.savedEntities.push('mediastinoscopy');
          } else {
            results.errors.push(mediastinoscopyResult.error);
          }
        }

        // Save bronchoscopy
        if (assessment.bronchoscopy) {
          const bronchoscopyResult = await this.saveBronchoscopy(
            assessment.bronchoscopy,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (bronchoscopyResult.success) {
            results.savedEntities.push('bronchoscopy');
          } else {
            results.errors.push(bronchoscopyResult.error);
          }
        }

        // Save VATS assessment
        if (assessment.vatsAssessment) {
          const vatsResult = await this.saveVATSAssessment(
            assessment.vatsAssessment,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (vatsResult.success) {
            results.savedEntities.push('vats_assessment');
          } else {
            results.errors.push(vatsResult.error);
          }
        }
      }

      // Save general thoracic surgery consultation
      const consultationResult = await this.saveThoracicSurgeryConsultation(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (consultationResult.success) {
        results.savedEntities.push('thoracic_surgery_consultation');
      } else {
        results.errors.push(consultationResult.error);
      }

    } catch (error) {
      console.error(`[${this.serviceName}] Error in mapAndSaveExtractedData:`, error);
      results.success = false;
      results.errors.push(error.message);
    }

    return results;
  }

  async savePulmonaryFunction(pulmonary, patientId, documentId, extractedData, context) {
    try {
      const pulmonaryData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        fev1: pulmonary.fev1 || '',
        fvc: pulmonary.fvc || '',
        dlco: pulmonary.dlco || '',
        predictedPostop: pulmonary.predictedPostop || {},
        ppo: pulmonary.ppo || {},
        vo2Max: pulmonary.vo2Max || '',
        interpretation: pulmonary.interpretation || '',
        operativeRisk: pulmonary.operativeRisk || '',
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('thoracic_pulmonary_function', pulmonaryData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving pulmonary function:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveTumorStaging(staging, patientId, documentId, extractedData, context) {
    try {
      const stagingData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        stagingDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        tnmStage: staging.tnmStage || '',
        tStage: staging.tStage || '',
        nStage: staging.nStage || '',
        mStage: staging.mStage || '',
        histology: staging.histology || '',
        grade: staging.grade || '',
        molecularMarkers: staging.molecularMarkers || {},
        clinicalStage: staging.clinicalStage || '',
        pathologicalStage: staging.pathologicalStage || '',
        resectability: staging.resectability || '',
        stagedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('thoracic_tumor_staging', stagingData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving tumor staging:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveMediastinoscopy(mediastinoscopy, patientId, documentId, extractedData, context) {
    try {
      const mediastinoscopyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        lymphNodes: mediastinoscopy.lymphNodes || [],
        frozen: mediastinoscopy.frozen || '',
        finalPathology: mediastinoscopy.finalPathology || '',
        complications: mediastinoscopy.complications || [],
        stations: mediastinoscopy.stations || [],
        findings: mediastinoscopy.findings || '',
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('mediastinoscopies', mediastinoscopyData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving mediastinoscopy:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveBronchoscopy(bronchoscopy, patientId, documentId, extractedData, context) {
    try {
      const bronchoscopyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        airwayPatency: bronchoscopy.airwayPatency || '',
        endobronchialLesions: bronchoscopy.endobronchialLesions || [],
        lavage: bronchoscopy.lavage || {},
        biopsies: bronchoscopy.biopsies || [],
        cytology: bronchoscopy.cytology || '',
        findings: bronchoscopy.findings || '',
        complications: bronchoscopy.complications || [],
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('thoracic_bronchoscopies', bronchoscopyData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving bronchoscopy:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveVATSAssessment(vats, patientId, documentId, extractedData, context) {
    try {
      const vatsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        feasibility: vats.feasibility || '',
        portPlacement: vats.portPlacement || {},
        adhesions: vats.adhesions || '',
        approach: vats.approach || '',
        conversionRisk: vats.conversionRisk || '',
        plannedProcedure: vats.plannedProcedure || '',
        assessedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('vats_assessments', vatsData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving VATS assessment:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveThoracicSurgeryConsultation(extractedData, patientId, documentId, sessionId, context) {
    try {
      const consultationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diagnosis: extractedData.diagnosis || [],
        proposedProcedure: extractedData.proposedProcedure || '',
        surgicalApproach: extractedData.surgicalApproach || '',
        operativeRisk: extractedData.operativeRisk || '',
        alternativeOptions: extractedData.alternativeOptions || [],
        neoadjuvantTherapy: extractedData.neoadjuvantTherapy || '',
        adjuvantTherapy: extractedData.adjuvantTherapy || '',
        prognosis: extractedData.prognosis || '',
        followUp: extractedData.followUp || '',
        surgeonName: extractedData.providerName || '',
        providerSpecialty: 'Thoracic Surgery',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('thoracic_surgery_consultations', consultationData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving thoracic surgery consultation:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ThoracicSurgeryFieldMappingService();