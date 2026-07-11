const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');
const productionKMS = require('./productionKMS');

class MedicalGeneticsFieldMappingService {
  constructor() {
    this.serviceName = 'MedicalGeneticsFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[MedicalGeneticsFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_MEDICAL_DATA_SERVICE_KEY');

      if (!this.serviceToken) {
        console.error('[MedicalGeneticsFieldMapper] Could not get API key from KMS');
      } else {
        this.initialized = true;
        console.log('[MedicalGeneticsFieldMapper] Authenticated with KMS');
      }
    } catch (error) {
      console.error('[MedicalGeneticsFieldMapper] KMS initialization error:', error.message);
    }
  }

  async mapAndSaveExtractedData(extractedData, patientId, documentId, sessionId, practiceSubdomain) {
    // Initialize if needed
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
      // Map medical genetics-specific data
      if (extractedData.medicalGeneticsAssessment) {
        const assessment = extractedData.medicalGeneticsAssessment;

        // Save pedigree analysis
        if (assessment.pedigreeAnalysis) {
          const pedigreeResult = await this.savePedigreeAnalysis(
            assessment.pedigreeAnalysis,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (pedigreeResult.success) {
            results.savedEntities.push('pedigree_analysis');
          } else {
            results.errors.push(pedigreeResult.error);
          }
        }

        // Save chromosomal analysis
        if (assessment.chromosomalAnalysis) {
          const chromosomalResult = await this.saveChromosomalAnalysis(
            assessment.chromosomalAnalysis,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (chromosomalResult.success) {
            results.savedEntities.push('chromosomal_analysis');
          } else {
            results.errors.push(chromosomalResult.error);
          }
        }

        // Save molecular testing
        if (assessment.molecularTesting) {
          const molecularResult = await this.saveMolecularTesting(
            assessment.molecularTesting,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (molecularResult.success) {
            results.savedEntities.push('molecular_testing');
          } else {
            results.errors.push(molecularResult.error);
          }
        }

        // Save variant classification
        if (assessment.variantClassification) {
          const variantResult = await this.saveVariantClassification(
            assessment.variantClassification,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (variantResult.success) {
            results.savedEntities.push('variant_classification');
          } else {
            results.errors.push(variantResult.error);
          }
        }

        // Save counseling notes
        if (assessment.counselingNotes) {
          const counselingResult = await this.saveCounselingNotes(
            assessment.counselingNotes,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (counselingResult.success) {
            results.savedEntities.push('counseling_notes');
          } else {
            results.errors.push(counselingResult.error);
          }
        }
      }

      // Save general genetics consultation
      const consultationResult = await this.saveGeneticsConsultation(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (consultationResult.success) {
        results.savedEntities.push('genetics_consultation');
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

  async savePedigreeAnalysis(pedigree, patientId, documentId, extractedData, context) {
    try {
      const pedigreeData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        analysisDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        pattern: pedigree.pattern || '',
        penetrance: pedigree.penetrance || '',
        expressivity: pedigree.expressivity || '',
        anticipation: pedigree.anticipation || '',
        generations: pedigree.generations || 3,
        affectedMembers: pedigree.affectedMembers || [],
        carrierStatus: pedigree.carrierStatus || {},
        consanguinity: pedigree.consanguinity || false,
        interpretation: pedigree.interpretation || '',
        analyzedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('pedigree_analyses', pedigreeData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving pedigree analysis:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveChromosomalAnalysis(chromosomal, patientId, documentId, extractedData, context) {
    try {
      const chromosomalData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        karyotype: chromosomal.karyotype || '',
        microarray: chromosomal.microarray || {},
        fish: chromosomal.fish || {},
        abnormalities: chromosomal.abnormalities || [],
        mosaicism: chromosomal.mosaicism || '',
        structuralVariants: chromosomal.structuralVariants || [],
        copyNumberVariants: chromosomal.copyNumberVariants || [],
        interpretation: chromosomal.interpretation || '',
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('chromosomal_analyses', chromosomalData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving chromosomal analysis:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveMolecularTesting(molecular, patientId, documentId, extractedData, context) {
    try {
      const molecularData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        singleGene: molecular.singleGene || {},
        panel: molecular.panel || {},
        exome: molecular.exome || {},
        genome: molecular.genome || {},
        methodology: molecular.methodology || '',
        coverage: molecular.coverage || '',
        variants: molecular.variants || [],
        secondaryFindings: molecular.secondaryFindings || [],
        interpretation: molecular.interpretation || '',
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('molecular_genetic_tests', molecularData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving molecular testing:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveVariantClassification(variants, patientId, documentId, extractedData, context) {
    try {
      const variantData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        classificationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        pathogenic: variants.pathogenic || [],
        likelyPathogenic: variants.likelyPathogenic || [],
        vus: variants.vus || [],
        likelyBenign: variants.likelyBenign || [],
        benign: variants.benign || [],
        acmgCriteria: variants.acmgCriteria || {},
        functionalStudies: variants.functionalStudies || {},
        segregationAnalysis: variants.segregationAnalysis || {},
        reclassifications: variants.reclassifications || [],
        classifiedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('variant_classifications', variantData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving variant classification:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveCounselingNotes(counseling, patientId, documentId, extractedData, context) {
    try {
      const counselingData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        counselingDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        recurrenceRisk: counseling.recurrenceRisk || '',
        reproductiveOptions: counseling.reproductiveOptions || [],
        familyTesting: counseling.familyTesting || {},
        psychosocialAssessment: counseling.psychosocialAssessment || '',
        informedConsent: counseling.informedConsent || false,
        ethicalConsiderations: counseling.ethicalConsiderations || [],
        followUpPlan: counseling.followUpPlan || '',
        resourcesProvided: counseling.resourcesProvided || [],
        counselor: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('genetic_counseling_notes', counselingData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving counseling notes:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveGeneticsConsultation(extractedData, patientId, documentId, sessionId, context) {
    try {
      const consultationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        reasonForReferral: extractedData.reasonForReferral || '',
        familyHistory: extractedData.familyHistory || {},
        clinicalFeatures: extractedData.clinicalFeatures || [],
        differentialDiagnosis: extractedData.differentialDiagnosis || [],
        geneticTesting: extractedData.geneticTesting || [],
        diagnosis: extractedData.diagnosis || '',
        management: extractedData.management || '',
        surveillance: extractedData.surveillance || [],
        familyRecommendations: extractedData.familyRecommendations || [],
        followUp: extractedData.followUp || '',
        geneticistName: extractedData.providerName || '',
        providerSpecialty: 'Medical Genetics',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('genetics_consultations', consultationData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving genetics consultation:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MedicalGeneticsFieldMappingService();