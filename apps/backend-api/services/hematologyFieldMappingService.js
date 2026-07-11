const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class HematologyFieldMappingService {
  constructor() {
    this.serviceName = 'HematologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[HematologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_MEDICAL_DATA_SERVICE_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for medical-data-service from KMS');
      }

      this.initialized = true;
      console.log('[HematologyFieldMapper] Service initialized with medical-data-service API key');
    } catch (error) {
      console.error('[HematologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }

  async mapAndSaveExtractedData(extractedData, patientId, documentId, sessionId, practiceSubdomain) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const context = {
      serviceId: 'medical-data-service',
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
      // Map hematology-specific data
      if (extractedData.hematologyAssessment) {
        const assessment = extractedData.hematologyAssessment;

        // Save blood smear
        if (assessment.bloodSmear) {
          const smearResult = await this.saveBloodSmear(
            assessment.bloodSmear,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (smearResult.success) {
            results.savedEntities.push('blood_smear');
          } else {
            results.errors.push(smearResult.error);
          }
        }

        // Save hemoglobinopathy
        if (assessment.hemoglobinopathy) {
          const hbResult = await this.saveHemoglobinopathy(
            assessment.hemoglobinopathy,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (hbResult.success) {
            results.savedEntities.push('hemoglobinopathy');
          } else {
            results.errors.push(hbResult.error);
          }
        }

        // Save coagulation studies
        if (assessment.coagulation) {
          const coagResult = await this.saveCoagulationStudies(
            assessment.coagulation,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (coagResult.success) {
            results.savedEntities.push('coagulation_studies');
          } else {
            results.errors.push(coagResult.error);
          }
        }

        // Save bone marrow
        if (assessment.boneMarrow) {
          const marrowResult = await this.saveBoneMarrow(
            assessment.boneMarrow,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (marrowResult.success) {
            results.savedEntities.push('bone_marrow');
          } else {
            results.errors.push(marrowResult.error);
          }
        }

        // Save transfusion data
        if (assessment.transfusion) {
          const transfusionResult = await this.saveTransfusion(
            assessment.transfusion,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (transfusionResult.success) {
            results.savedEntities.push('transfusion');
          } else {
            results.errors.push(transfusionResult.error);
          }
        }
      }

      // Save general hematology consultation
      const consultationResult = await this.saveHematologyConsultation(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (consultationResult.success) {
        results.savedEntities.push('hematology_consultation');
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

  async saveBloodSmear(bloodSmear, patientId, documentId, extractedData, context) {
    try {
      const smearData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        rbcMorphology: bloodSmear.rbcMorphology || '',
        wbcDifferential: bloodSmear.wbcDifferential || {},
        plateletEstimate: bloodSmear.plateletEstimate || '',
        inclusions: bloodSmear.inclusions || [],
        anisocytosis: bloodSmear.anisocytosis || '',
        poikilocytosis: bloodSmear.poikilocytosis || '',
        polychromasia: bloodSmear.polychromasia || '',
        rouleaux: bloodSmear.rouleaux || '',
        interpretation: bloodSmear.interpretation || '',
        reviewedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('blood_smears', smearData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving blood smear:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveHemoglobinopathy(hemoglobinopathy, patientId, documentId, extractedData, context) {
    try {
      const hbData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        electrophoresis: hemoglobinopathy.electrophoresis || {},
        hplc: hemoglobinopathy.hplc || {},
        sickling: hemoglobinopathy.sickling || '',
        hbA: hemoglobinopathy.hbA || '',
        hbA2: hemoglobinopathy.hbA2 || '',
        hbF: hemoglobinopathy.hbF || '',
        hbS: hemoglobinopathy.hbS || '',
        hbC: hemoglobinopathy.hbC || '',
        otherVariants: hemoglobinopathy.otherVariants || [],
        interpretation: hemoglobinopathy.interpretation || '',
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('hemoglobinopathy_studies', hbData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving hemoglobinopathy:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveCoagulationStudies(coagulation, patientId, documentId, extractedData, context) {
    try {
      const coagData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        pt: coagulation.pt || '',
        ptt: coagulation.ptt || '',
        inr: coagulation.inr || '',
        factorLevels: coagulation.factorLevels || {},
        mixing: coagulation.mixing || {},
        thrombophilia: coagulation.thrombophilia || {},
        fibrinogen: coagulation.fibrinogen || '',
        dDimer: coagulation.dDimer || '',
        antithrombin: coagulation.antithrombin || '',
        proteinC: coagulation.proteinC || '',
        proteinS: coagulation.proteinS || '',
        vonWillebrand: coagulation.vonWillebrand || {},
        interpretation: coagulation.interpretation || '',
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('coagulation_studies', coagData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving coagulation studies:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveBoneMarrow(boneMarrow, patientId, documentId, extractedData, context) {
    try {
      const marrowData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        cellularity: boneMarrow.cellularity || '',
        myeloidErythroid: boneMarrow.myeloidErythroid || '',
        blasts: boneMarrow.blasts || '',
        cytogenetics: boneMarrow.cytogenetics || {},
        flowCytometry: boneMarrow.flowCytometry || {},
        fish: boneMarrow.fish || {},
        molecularStudies: boneMarrow.molecularStudies || {},
        ironStain: boneMarrow.ironStain || '',
        reticulin: boneMarrow.reticulin || '',
        diagnosis: boneMarrow.diagnosis || '',
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('bone_marrow_studies', marrowData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving bone marrow:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveTransfusion(transfusion, patientId, documentId, extractedData, context) {
    try {
      const transfusionData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        transfusionDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        bloodType: transfusion.bloodType || '',
        antibodyScreen: transfusion.antibodyScreen || {},
        crossmatch: transfusion.crossmatch || {},
        reactions: transfusion.reactions || [],
        alloantibodies: transfusion.alloantibodies || [],
        products: transfusion.products || [],
        units: transfusion.units || '',
        indication: transfusion.indication || '',
        preTransfusion: transfusion.preTransfusion || {},
        postTransfusion: transfusion.postTransfusion || {},
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('transfusion_records', transfusionData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving transfusion:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveHematologyConsultation(extractedData, patientId, documentId, sessionId, context) {
    try {
      const hematology = extractedData.hematologyAssessment || {};

      const consultationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: extractedData.chiefComplaint || { complaint: '', duration: '' },
        diagnosis: extractedData.diagnosis || [],
        bloodDisorder: hematology.bloodDisorder || '',
        stagingClassification: hematology.stagingClassification || '',
        treatmentPlan: hematology.treatmentPlan || { immediateInterventions: {} },
        chemotherapy: hematology.chemotherapy || [],
        supportiveCare: hematology.supportiveCare || [],
        transfusionSupport: hematology.transfusionSupport || '',
        growthFactors: hematology.growthFactors || [],
        transplantEligibility: hematology.transplantEligibility || '',
        clinicalTrials: hematology.clinicalTrials || [],
        prognosis: hematology.prognosis || { shortTerm: '', longTerm: '', riskFactors: [], protectiveFactors: [] },
        followUp: hematology.followUp || '',
        hematologistName: extractedData.providerName || '',
        providerSpecialty: 'Hematology',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('hematology_consultations', consultationData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving hematology consultation:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new HematologyFieldMappingService();