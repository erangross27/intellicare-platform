const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class FamilyMedicineFieldMappingService {
  constructor() {
    this.serviceName = 'FamilyMedicineFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[FamilyMedicineFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_FAMILYMEDICINEFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for FamilyMedicineFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[FamilyMedicineFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[FamilyMedicineFieldMapper] Initialization failed:', error);
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
      // Map family medicine-specific data
      if (extractedData.familyMedicineAssessment) {
        const assessment = extractedData.familyMedicineAssessment;

        // Save preventive screening
        if (assessment.preventiveScreening) {
          const screeningResult = await this.savePreventiveScreening(
            assessment.preventiveScreening,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (screeningResult.success) {
            results.savedEntities.push('preventive_screening');
          } else {
            results.errors.push(screeningResult.error);
          }
        }

        // Save immunization status
        if (assessment.immunizationStatus) {
          const immunizationResult = await this.saveImmunizationStatus(
            assessment.immunizationStatus,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (immunizationResult.success) {
            results.savedEntities.push('immunization_status');
          } else {
            results.errors.push(immunizationResult.error);
          }
        }

        // Save chronic disease management
        if (assessment.chronicDiseaseManagement) {
          const chronicResult = await this.saveChronicDiseaseManagement(
            assessment.chronicDiseaseManagement,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (chronicResult.success) {
            results.savedEntities.push('chronic_disease_management');
          } else {
            results.errors.push(chronicResult.error);
          }
        }

        // Save mental health screening
        if (assessment.mentalHealthScreening) {
          const mentalHealthResult = await this.saveMentalHealthScreening(
            assessment.mentalHealthScreening,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (mentalHealthResult.success) {
            results.savedEntities.push('mental_health_screening');
          } else {
            results.errors.push(mentalHealthResult.error);
          }
        }

        // Save social determinants
        if (assessment.socialDeterminants) {
          const socialResult = await this.saveSocialDeterminants(
            assessment.socialDeterminants,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (socialResult.success) {
            results.savedEntities.push('social_determinants');
          } else {
            results.errors.push(socialResult.error);
          }
        }
      }

      // Save general family medicine visit
      const visitResult = await this.saveFamilyMedicineVisit(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (visitResult.success) {
        results.savedEntities.push('family_medicine_visit');
      } else {
        results.errors.push(visitResult.error);
      }

    } catch (error) {
      console.error(`[${this.serviceName}] Error in mapAndSaveExtractedData:`, error);
      results.success = false;
      results.errors.push(error.message);
    }

    return results;
  }

  async savePreventiveScreening(screening, patientId, documentId, extractedData, context) {
    try {
      const screeningData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        screeningDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        colonoscopy: screening.colonoscopy || {},
        mammogram: screening.mammogram || {},
        cervicalScreening: screening.cervicalScreening || {},
        lipidPanel: screening.lipidPanel || {},
        diabetesScreening: screening.diabetesScreening || {},
        boneDesity: screening.boneDensity || {},
        lungCancerScreening: screening.lungCancerScreening || {},
        recommendations: screening.recommendations || [],
        nextDueScreenings: screening.nextDueScreenings || [],
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('preventive_screenings', screeningData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving preventive screening:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveImmunizationStatus(immunization, patientId, documentId, extractedData, context) {
    try {
      const immunizationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        updateDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        vaccines: immunization.vaccines || [],
        titers: immunization.titers || {},
        boosters: immunization.boosters || [],
        dueVaccines: immunization.dueVaccines || [],
        contraindications: immunization.contraindications || [],
        adverseReactions: immunization.adverseReactions || [],
        reviewedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('immunization_records', immunizationData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving immunization status:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveChronicDiseaseManagement(chronic, patientId, documentId, extractedData, context) {
    try {
      const chronicData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diabetes: chronic.diabetes || {},
        hypertension: chronic.hypertension || {},
        hyperlipidemia: chronic.hyperlipidemia || {},
        asthma: chronic.asthma || {},
        copd: chronic.copd || {},
        heartDisease: chronic.heartDisease || {},
        arthritis: chronic.arthritis || {},
        managementPlans: chronic.managementPlans || [],
        qualityMetrics: chronic.qualityMetrics || {},
        managedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('chronic_disease_management', chronicData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving chronic disease management:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveMentalHealthScreening(mentalHealth, patientId, documentId, extractedData, context) {
    try {
      const mentalHealthData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        screeningDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        phq9Score: mentalHealth.phq9Score || null,
        gad7Score: mentalHealth.gad7Score || null,
        auditScore: mentalHealth.auditScore || null,
        mmseScore: mentalHealth.mmseScore || null,
        interpretation: mentalHealth.interpretation || '',
        riskLevel: mentalHealth.riskLevel || '',
        recommendations: mentalHealth.recommendations || [],
        referrals: mentalHealth.referrals || [],
        screenedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('mental_health_screenings', mentalHealthData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving mental health screening:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveSocialDeterminants(social, patientId, documentId, extractedData, context) {
    try {
      const socialData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        housing: social.housing || '',
        foodSecurity: social.foodSecurity || '',
        transportation: social.transportation || '',
        socialSupport: social.socialSupport || '',
        employment: social.employment || '',
        education: social.education || '',
        financialStrain: social.financialStrain || '',
        healthLiteracy: social.healthLiteracy || '',
        interventions: social.interventions || [],
        resources: social.resources || [],
        assessedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('social_determinants_health', socialData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving social determinants:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveFamilyMedicineVisit(extractedData, patientId, documentId, sessionId, context) {
    try {
      const visitData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        visitDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        visitType: extractedData.visitType || 'Comprehensive',
        chiefComplaint: extractedData.chiefComplaint || '',
        historyOfPresentIllness: extractedData.historyOfPresentIllness || '',
        reviewOfSystems: extractedData.reviewOfSystems || {},
        physicalExam: extractedData.physicalExam || {},
        assessment: extractedData.diagnosis || [],
        plan: extractedData.treatmentPlan || '',
        medications: extractedData.medications || [],
        orders: extractedData.orders || [],
        followUp: extractedData.followUp || '',
        providerName: extractedData.providerName || '',
        providerSpecialty: 'Family Medicine',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('family_medicine_visits', visitData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving family medicine visit:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new FamilyMedicineFieldMappingService();