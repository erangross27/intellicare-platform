const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class UrologyFieldMappingService {
  constructor() {
    this.serviceName = 'UrologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[UrologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_UROLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for UrologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[UrologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[UrologyFieldMapper] Initialization failed:', error);
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
      // Map urology-specific data
      if (extractedData.urologyAssessment) {
        const assessment = extractedData.urologyAssessment;

        // Save urodynamic studies
        if (assessment.urodynamicStudies) {
          const urodynamicResult = await this.saveUrodynamicStudy(
            assessment.urodynamicStudies,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (urodynamicResult.success) {
            results.savedEntities.push('urodynamic_study');
          } else {
            results.errors.push(urodynamicResult.error);
          }
        }

        // Save cystoscopy findings
        if (assessment.cystoscopy) {
          const cystoscopyResult = await this.saveCystoscopy(
            assessment.cystoscopy,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (cystoscopyResult.success) {
            results.savedEntities.push('cystoscopy');
          } else {
            results.errors.push(cystoscopyResult.error);
          }
        }

        // Save PSA levels
        if (assessment.psaLevels) {
          const psaResult = await this.savePSALevels(
            assessment.psaLevels,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (psaResult.success) {
            results.savedEntities.push('psa_levels');
          } else {
            results.errors.push(psaResult.error);
          }
        }

        // Save renal function
        if (assessment.renalFunction) {
          const renalResult = await this.saveRenalFunction(
            assessment.renalFunction,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (renalResult.success) {
            results.savedEntities.push('renal_function');
          } else {
            results.errors.push(renalResult.error);
          }
        }

        // Save stone analysis
        if (assessment.stoneAnalysis) {
          const stoneResult = await this.saveStoneAnalysis(
            assessment.stoneAnalysis,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (stoneResult.success) {
            results.savedEntities.push('stone_analysis');
          } else {
            results.errors.push(stoneResult.error);
          }
        }
      }

      // Save general urology consultation
      const consultationResult = await this.saveUrologyConsultation(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (consultationResult.success) {
        results.savedEntities.push('urology_consultation');
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

  async saveUrodynamicStudy(urodynamic, patientId, documentId, extractedData, context) {
    try {
      const urodynamicData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        bladderCapacity: urodynamic.bladderCapacity || '',
        peakFlowRate: urodynamic.peakFlowRate || '',
        postVoidResidual: urodynamic.postVoidResidual || '',
        detrusorPressure: urodynamic.detrusorPressure || '',
        complianceScore: urodynamic.complianceScore || '',
        interpretation: urodynamic.interpretation || '',
        performedBy: extractedData.providerName || '',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('urodynamic_studies', urodynamicData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving urodynamic study:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveCystoscopy(cystoscopy, patientId, documentId, extractedData, context) {
    try {
      const cystoscopyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        bladderMucosa: cystoscopy.bladderMucosa || '',
        urethralPatency: cystoscopy.urethralPatency || '',
        prostateSize: cystoscopy.prostateSize || '',
        lesions: cystoscopy.lesions || [],
        findings: cystoscopy.findings || '',
        complications: cystoscopy.complications || '',
        performedBy: extractedData.providerName || '',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('cystoscopies', cystoscopyData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving cystoscopy:`, error);
      return { success: false, error: error.message };
    }
  }

  async savePSALevels(psaLevels, patientId, documentId, extractedData, context) {
    try {
      const psaData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        totalPSA: psaLevels.totalPSA || '',
        freePSA: psaLevels.freePSA || '',
        psaDensity: psaLevels.psaDensity || '',
        psaVelocity: psaLevels.psaVelocity || '',
        interpretation: psaLevels.interpretation || '',
        riskCategory: psaLevels.riskCategory || '',
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('psa_levels', psaData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving PSA levels:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveRenalFunction(renalFunction, patientId, documentId, extractedData, context) {
    try {
      const renalData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        gfr: renalFunction.gfr || '',
        creatinine: renalFunction.creatinine || '',
        bun: renalFunction.bun || '',
        proteinuria: renalFunction.proteinuria || '',
        ckdStage: renalFunction.ckdStage || '',
        interpretation: renalFunction.interpretation || '',
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('renal_function_tests', renalData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving renal function:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveStoneAnalysis(stoneAnalysis, patientId, documentId, extractedData, context) {
    try {
      const stoneData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        analysisDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        composition: stoneAnalysis.composition || '',
        size: stoneAnalysis.size || '',
        location: stoneAnalysis.location || '',
        hydronephrosis: stoneAnalysis.hydronephrosis || '',
        treatment: stoneAnalysis.treatment || '',
        preventionRecommendations: stoneAnalysis.preventionRecommendations || '',
        analyzedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('stone_analyses', stoneData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving stone analysis:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveUrologyConsultation(extractedData, patientId, documentId, sessionId, context) {
    try {
      const consultationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: extractedData.chiefComplaint || '',
        historyOfPresentIllness: extractedData.historyOfPresentIllness || '',
        diagnosis: extractedData.diagnosis || [],
        treatmentPlan: extractedData.treatmentPlan || '',
        medications: extractedData.medications || [],
        procedures: extractedData.procedures || [],
        followUp: extractedData.followUp || '',
        providerName: extractedData.providerName || '',
        providerSpecialty: 'Urology',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('urology_consultations', consultationData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving urology consultation:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new UrologyFieldMappingService();