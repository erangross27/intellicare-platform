const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class PreventiveMedicineFieldMappingService {
  constructor() {
    this.serviceName = 'PreventiveMedicineFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[PreventiveMedicineFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_PREVENTIVEMEDICINEFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for PreventiveMedicineFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[PreventiveMedicineFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[PreventiveMedicineFieldMapper] Initialization failed:', error);
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
      // Map preventive medicine-specific data
      if (extractedData.preventiveMedicineAssessment) {
        const assessment = extractedData.preventiveMedicineAssessment;

        // Save risk calculators
        if (assessment.riskCalculators) {
          const riskResult = await this.saveRiskCalculators(
            assessment.riskCalculators,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (riskResult.success) {
            results.savedEntities.push('risk_calculators');
          } else {
            results.errors.push(riskResult.error);
          }
        }

        // Save screening compliance
        if (assessment.screeningCompliance) {
          const screeningResult = await this.saveScreeningCompliance(
            assessment.screeningCompliance,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (screeningResult.success) {
            results.savedEntities.push('screening_compliance');
          } else {
            results.errors.push(screeningResult.error);
          }
        }

        // Save lifestyle assessment
        if (assessment.lifestyleAssessment) {
          const lifestyleResult = await this.saveLifestyleAssessment(
            assessment.lifestyleAssessment,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (lifestyleResult.success) {
            results.savedEntities.push('lifestyle_assessment');
          } else {
            results.errors.push(lifestyleResult.error);
          }
        }

        // Save biomarkers
        if (assessment.biomarkers) {
          const biomarkerResult = await this.saveBiomarkers(
            assessment.biomarkers,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (biomarkerResult.success) {
            results.savedEntities.push('biomarkers');
          } else {
            results.errors.push(biomarkerResult.error);
          }
        }

        // Save genomic risk
        if (assessment.genomicRisk) {
          const genomicResult = await this.saveGenomicRisk(
            assessment.genomicRisk,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (genomicResult.success) {
            results.savedEntities.push('genomic_risk');
          } else {
            results.errors.push(genomicResult.error);
          }
        }
      }

      // Save general preventive medicine assessment
      const assessmentResult = await this.savePreventiveMedicineAssessment(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (assessmentResult.success) {
        results.savedEntities.push('preventive_medicine_assessments');
      } else {
        results.errors.push(assessmentResult.error);
      }

    } catch (error) {
      console.error(`[${this.serviceName}] Error in mapAndSaveExtractedData:`, error);
      results.success = false;
      results.errors.push(error.message);
    }

    return results;
  }

  async saveRiskCalculators(calculators, patientId, documentId, extractedData, context) {
    try {
      const riskData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        calculationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        ascvd: calculators.ascvd || '',
        framingham: calculators.framingham || '',
        gail: calculators.gail || '',
        frax: calculators.frax || '',
        reynoldsRisk: calculators.reynoldsRisk || '',
        chadsVasc: calculators.chadsVasc || '',
        meld: calculators.meld || '',
        interpretation: calculators.interpretation || {},
        recommendations: calculators.recommendations || [],
        calculatedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('risk_calculators', riskData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving risk calculators:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveScreeningCompliance(screening, patientId, documentId, extractedData, context) {
    try {
      const screeningData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        mammography: screening.mammography || {},
        colonoscopy: screening.colonoscopy || {},
        cervicalCancer: screening.cervicalCancer || {},
        lungCancer: screening.lungCancer || {},
        aaa: screening.aaa || {},
        osteoporosis: screening.osteoporosis || {},
        hepatitis: screening.hepatitis || {},
        hiv: screening.hiv || {},
        complianceRate: screening.complianceRate || '',
        overdue: screening.overdue || [],
        assessedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('screening_compliance', screeningData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving screening compliance:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveLifestyleAssessment(lifestyle, patientId, documentId, extractedData, context) {
    try {
      const lifestyleData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        dietPattern: lifestyle.dietPattern || '',
        exerciseMinutes: lifestyle.exerciseMinutes || 0,
        sleepQuality: lifestyle.sleepQuality || '',
        stressLevel: lifestyle.stressLevel || '',
        substanceUse: lifestyle.substanceUse || {},
        tobaccoUse: lifestyle.tobaccoUse || {},
        alcoholUse: lifestyle.alcoholUse || {},
        screenTime: lifestyle.screenTime || '',
        socialConnections: lifestyle.socialConnections || '',
        recommendations: lifestyle.recommendations || [],
        assessedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('lifestyle_assessments', lifestyleData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving lifestyle assessment:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveBiomarkers(biomarkers, patientId, documentId, extractedData, context) {
    try {
      const biomarkerData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        hscrp: biomarkers.hscrp || '',
        homocysteine: biomarkers.homocysteine || '',
        vitaminD: biomarkers.vitaminD || '',
        omega3Index: biomarkers.omega3Index || '',
        apoB: biomarkers.apoB || '',
        lpA: biomarkers.lpA || '',
        insulin: biomarkers.insulin || '',
        cortisol: biomarkers.cortisol || '',
        thyroid: biomarkers.thyroid || {},
        interpretation: biomarkers.interpretation || '',
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('preventive_biomarkers', biomarkerData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving biomarkers:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveGenomicRisk(genomic, patientId, documentId, extractedData, context) {
    try {
      const genomicData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        brca: genomic.brca || '',
        lynch: genomic.lynch || '',
        pharmacogenomics: genomic.pharmacogenomics || {},
        cardiacGenes: genomic.cardiacGenes || {},
        cancerPanel: genomic.cancerPanel || {},
        metabolicGenes: genomic.metabolicGenes || {},
        interpretation: genomic.interpretation || '',
        counselingProvided: genomic.counselingProvided || false,
        familyImplications: genomic.familyImplications || [],
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('genomic_risk_assessment', genomicData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving genomic risk:`, error);
      return { success: false, error: error.message };
    }
  }

  async savePreventiveMedicineAssessment(extractedData, patientId, documentId, sessionId, context) {
    try {
      const assessmentData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        assessmentType: extractedData.assessmentType || 'Comprehensive',
        riskStratification: extractedData.riskStratification || {},
        preventionPlan: extractedData.preventionPlan || '',
        screeningSchedule: extractedData.screeningSchedule || [],
        lifestyleInterventions: extractedData.lifestyleInterventions || [],
        pharmacologicInterventions: extractedData.pharmacologicInterventions || [],
        vaccinations: extractedData.vaccinations || [],
        healthGoals: extractedData.healthGoals || [],
        followUp: extractedData.followUp || '',
        providerName: extractedData.providerName || '',
        providerSpecialty: 'Preventive Medicine',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('preventive_medicine_assessments', assessmentData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving preventive medicine assessment:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PreventiveMedicineFieldMappingService();