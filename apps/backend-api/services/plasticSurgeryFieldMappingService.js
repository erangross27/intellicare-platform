const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class PlasticSurgeryFieldMappingService {
  constructor() {
    this.serviceName = 'PlasticSurgeryFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[PlasticSurgeryFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_PLASTICSURGERYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for PlasticSurgeryFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[PlasticSurgeryFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[PlasticSurgeryFieldMapper] Initialization failed:', error);
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
      // Map plastic surgery-specific data
      if (extractedData.plasticSurgeryAssessment) {
        const assessment = extractedData.plasticSurgeryAssessment;

        // Save preoperative photography
        if (assessment.preoperativePhotography) {
          const photoResult = await this.savePreoperativePhotography(
            assessment.preoperativePhotography,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (photoResult.success) {
            results.savedEntities.push('preoperative_photography');
          } else {
            results.errors.push(photoResult.error);
          }
        }

        // Save skin analysis
        if (assessment.skinAnalysis) {
          const skinResult = await this.saveSkinAnalysis(
            assessment.skinAnalysis,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (skinResult.success) {
            results.savedEntities.push('skin_analysis');
          } else {
            results.errors.push(skinResult.error);
          }
        }

        // Save flap assessment
        if (assessment.flapAssessment) {
          const flapResult = await this.saveFlapAssessment(
            assessment.flapAssessment,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (flapResult.success) {
            results.savedEntities.push('flap_assessment');
          } else {
            results.errors.push(flapResult.error);
          }
        }

        // Save implant data
        if (assessment.implantData) {
          const implantResult = await this.saveImplantData(
            assessment.implantData,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (implantResult.success) {
            results.savedEntities.push('implant_data');
          } else {
            results.errors.push(implantResult.error);
          }
        }

        // Save aesthetic goals
        if (assessment.aestheticGoals) {
          const aestheticResult = await this.saveAestheticGoals(
            assessment.aestheticGoals,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (aestheticResult.success) {
            results.savedEntities.push('aesthetic_goals');
          } else {
            results.errors.push(aestheticResult.error);
          }
        }
      }

      // Save general plastic surgery consultation
      const consultationResult = await this.savePlasticSurgeryConsultation(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (consultationResult.success) {
        results.savedEntities.push('plastic_surgery_consultation');
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

  async savePreoperativePhotography(photography, patientId, documentId, extractedData, context) {
    try {
      const photoData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        photographyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        views: photography.views || [],
        measurements: photography.measurements || {},
        asymmetries: photography.asymmetries || [],
        landmarks: photography.landmarks || {},
        comparison: photography.comparison || '',
        photographedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('preoperative_photography', photoData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving preoperative photography:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveSkinAnalysis(skinAnalysis, patientId, documentId, extractedData, context) {
    try {
      const skinData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        analysisDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        fitzpatrickType: skinAnalysis.fitzpatrickType || '',
        laxity: skinAnalysis.laxity || '',
        thickness: skinAnalysis.thickness || '',
        scarring: skinAnalysis.scarring || [],
        elasticity: skinAnalysis.elasticity || '',
        pigmentation: skinAnalysis.pigmentation || '',
        vascularity: skinAnalysis.vascularity || '',
        recommendations: skinAnalysis.recommendations || [],
        analyzedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('skin_analyses', skinData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving skin analysis:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveFlapAssessment(flapAssessment, patientId, documentId, extractedData, context) {
    try {
      const flapData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        donorSite: flapAssessment.donorSite || '',
        recipientSite: flapAssessment.recipientSite || '',
        vascularStatus: flapAssessment.vascularStatus || '',
        dimensions: flapAssessment.dimensions || {},
        flapType: flapAssessment.flapType || '',
        pedicleStatus: flapAssessment.pedicleStatus || '',
        viability: flapAssessment.viability || '',
        complications: flapAssessment.complications || [],
        assessedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('flap_assessments', flapData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving flap assessment:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveImplantData(implantData, patientId, documentId, extractedData, context) {
    try {
      const implantInfo = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        implantDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: implantData.type || '',
        size: implantData.size || '',
        manufacturer: implantData.manufacturer || '',
        serialNumber: implantData.serialNumber || '',
        profile: implantData.profile || '',
        surface: implantData.surface || '',
        placement: implantData.placement || '',
        incision: implantData.incision || '',
        registeredBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('implant_registry', implantInfo, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving implant data:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveAestheticGoals(aestheticGoals, patientId, documentId, extractedData, context) {
    try {
      const aestheticData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        patientExpectations: aestheticGoals.patientExpectations || '',
        achievableOutcome: aestheticGoals.achievableOutcome || '',
        limitations: aestheticGoals.limitations || [],
        discussedOptions: aestheticGoals.discussedOptions || [],
        preferredApproach: aestheticGoals.preferredApproach || '',
        recoveryExpectations: aestheticGoals.recoveryExpectations || '',
        documentedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('aesthetic_goals', aestheticData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving aesthetic goals:`, error);
      return { success: false, error: error.message };
    }
  }

  async savePlasticSurgeryConsultation(extractedData, patientId, documentId, sessionId, context) {
    try {
      const consultationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        procedureType: extractedData.procedureType || '',
        chiefComplaint: extractedData.chiefComplaint || '',
        surgicalHistory: extractedData.surgicalHistory || [],
        proposedProcedure: extractedData.proposedProcedure || '',
        risks: extractedData.risks || [],
        benefits: extractedData.benefits || [],
        alternatives: extractedData.alternatives || [],
        consentObtained: extractedData.consentObtained || false,
        followUp: extractedData.followUp || '',
        surgeonName: extractedData.providerName || '',
        providerSpecialty: 'Plastic Surgery',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('plastic_surgery_consultations', consultationData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving plastic surgery consultation:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PlasticSurgeryFieldMappingService();