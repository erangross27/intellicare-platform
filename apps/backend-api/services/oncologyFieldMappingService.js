const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class OncologyFieldMappingService {
  constructor() {
    this.serviceName = 'OncologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[OncologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_ONCOLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for OncologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[OncologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[OncologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveTreatmentSummary(treatmentSummary, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const summaryData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        summaryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        primaryDiagnosis: treatmentSummary.primaryDiagnosis || {},
        treatmentTimeline: treatmentSummary.treatmentTimeline || [],
        currentTreatmentStatus: treatmentSummary.currentTreatmentStatus || '',
        diseaseStatus: treatmentSummary.diseaseStatus || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('treatment_summaries', summaryData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSurgicalOncology(surgicalOncology, patientId, documentId, extractedData, context) {
    try {
      const surgicalData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: surgicalOncology.dateOfSurgery ? new Date(surgicalOncology.dateOfSurgery) : new Date(),
        procedureType: surgicalOncology.procedureType || '',
        surgeon: surgicalOncology.surgeon || '',
        pathologyFindings: surgicalOncology.pathologyFindings || {},
        reconstruction: surgicalOncology.reconstruction || {},
        complications: surgicalOncology.complications || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('surgical_oncology', surgicalData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRadiationOncology(radiationOncology, patientId, documentId, extractedData, context) {
    try {
      const radiationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        treatmentStartDate: radiationOncology.startDate ? new Date(radiationOncology.startDate) : new Date(),
        treatmentEndDate: radiationOncology.endDate ? new Date(radiationOncology.endDate) : null,
        indication: radiationOncology.indication || '',
        technique: radiationOncology.technique || '',
        site: radiationOncology.site || '',
        totalDose: radiationOncology.totalDose || '',
        fractions: radiationOncology.fractions || '',
        boostDose: radiationOncology.boostDose || '',
        concurrentChemotherapy: radiationOncology.concurrentChemotherapy || false,
        acuteToxicities: radiationOncology.acuteToxicities || [],
        lateToxicities: radiationOncology.lateToxicities || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('radiation_oncology', radiationData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveEndocrineTherapy(endocrineTherapy, patientId, documentId, extractedData, context) {
    try {
      const endocrineData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        startDate: endocrineTherapy.startDate ? new Date(endocrineTherapy.startDate) : new Date(),
        medication: endocrineTherapy.medication || '',
        plannedDuration: endocrineTherapy.plannedDuration || '',
        compliance: endocrineTherapy.compliance || '',
        sideEffects: endocrineTherapy.sideEffects || [],
        hormoneReceptorStatus: endocrineTherapy.hormoneReceptorStatus || {},
        ovarianSuppression: endocrineTherapy.ovarianSuppression || false,
        boneProtection: endocrineTherapy.boneProtection || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('endocrine_therapy', endocrineData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSurvivorshipCarePlan(survivorshipCarePlan, patientId, documentId, extractedData, context) {
    try {
      const survivorshipData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        planDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        followUpSchedule: survivorshipCarePlan.followUpSchedule || {},
        surveillanceTests: survivorshipCarePlan.surveillanceTests || [],
        lateEffectsMonitoring: survivorshipCarePlan.lateEffectsMonitoring || [],
        healthMaintenance: survivorshipCarePlan.healthMaintenance || {},
        recurrenceSigns: survivorshipCarePlan.recurrenceSigns || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('survivorship_care_plans', survivorshipData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCancerRelatedSideEffects(cancerRelatedSideEffects, patientId, documentId, extractedData, context) {
    try {
      const sideEffectsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        lymphedema: cancerRelatedSideEffects.lymphedema || {},
        neuropathy: cancerRelatedSideEffects.neuropathy || {},
        fatigue: cancerRelatedSideEffects.fatigue || {},
        cognitiveChanges: cancerRelatedSideEffects.cognitiveChanges || '',
        sexualDysfunction: cancerRelatedSideEffects.sexualDysfunction || {},
        fertilityImpact: cancerRelatedSideEffects.fertilityImpact || {},
        secondaryMalignancyRisk: cancerRelatedSideEffects.secondaryMalignancyRisk || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('cancer_related_side_effects', sideEffectsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveOncologicEmergencies(oncologicEmergencies, patientId, documentId, extractedData, context) {
    try {
      const emergencyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        neutropenicFever: oncologicEmergencies.neutropenicFever || {},
        tumorLysisSyndrome: oncologicEmergencies.tumorLysisSyndrome || {},
        hypercalcemia: oncologicEmergencies.hypercalcemia || {},
        spinalCordCompression: oncologicEmergencies.spinalCordCompression || {},
        superiorVenaCavaSyndrome: oncologicEmergencies.superiorVenaCavaSyndrome || {},
        brainMetastases: oncologicEmergencies.brainMetastases || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('oncologic_emergencies', emergencyData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePalliativeCare(palliativeCare, patientId, documentId, extractedData, context) {
    try {
      const palliativeData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        goalsOfCare: palliativeCare.goalsOfCare || [],
        symptomManagement: palliativeCare.symptomManagement || {},
        advanceDirectives: palliativeCare.advanceDirectives || {},
        hospiceDiscussion: palliativeCare.hospiceDiscussion || false,
        qualityOfLife: palliativeCare.qualityOfLife || '',
        spiritualSupport: palliativeCare.spiritualSupport || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('palliative_care', palliativeData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePsychosocialOncology(psychosocialOncology, patientId, documentId, extractedData, context) {
    try {
      const psychosocialData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        distressScreening: psychosocialOncology.distressScreening || '',
        anxietyLevel: psychosocialOncology.anxietyLevel || '',
        depressionScreening: psychosocialOncology.depressionScreening || '',
        copingStrategies: psychosocialOncology.copingStrategies || [],
        supportSystems: psychosocialOncology.supportSystems || [],
        financialToxicity: psychosocialOncology.financialToxicity || {},
        returnToWork: psychosocialOncology.returnToWork || {},
        supportGroupParticipation: psychosocialOncology.supportGroupParticipation || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('psychosocial_oncology', psychosocialData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveGeneticOncology(geneticOncology, patientId, documentId, extractedData, context) {
    try {
      const geneticData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        evaluationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        familyHistory: geneticOncology.familyHistory || [],
        geneticCounseling: geneticOncology.geneticCounseling || {},
        geneticTesting: geneticOncology.geneticTesting || {},
        riskAssessmentTools: geneticOncology.riskAssessmentTools || [],
        preventiveRecommendations: geneticOncology.preventiveRecommendations || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('genetic_oncology', geneticData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePrognosticFactors(prognosticFactors, patientId, documentId, extractedData, context) {
    try {
      const prognosticData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        favorableFactors: prognosticFactors.favorableFactors || [],
        adverseFactors: prognosticFactors.adverseFactors || [],
        survivalEstimates: prognosticFactors.survivalEstimates || {},
        recurrenceRisk: prognosticFactors.recurrenceRisk || '',
        prognosticScores: prognosticFactors.prognosticScores || [],
        molecularSubtype: prognosticFactors.molecularSubtype || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('prognostic_factors', prognosticData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveIntegrativeOncology(integrativeOncology, patientId, documentId, extractedData, context) {
    try {
      const integrativeData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        complementaryTherapies: integrativeOncology.complementaryTherapies || [],
        nutritionalSupport: integrativeOncology.nutritionalSupport || {},
        exerciseProgram: integrativeOncology.exerciseProgram || {},
        mindBodyPractices: integrativeOncology.mindBodyPractices || [],
        acupuncture: integrativeOncology.acupuncture || false,
        supplements: integrativeOncology.supplements || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('integrative_oncology', integrativeData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Methods for existing oncology fields that weren't previously saved
  async saveCancerDiagnosis(cancerDiagnosis, patientId, documentId, extractedData, context) {
    try {
      const diagnosisData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        diagnosisDate: cancerDiagnosis.dateOfDiagnosis ? new Date(cancerDiagnosis.dateOfDiagnosis) : new Date(),
        primarySite: cancerDiagnosis.primarySite || '',
        histology: cancerDiagnosis.histology || '',
        grade: cancerDiagnosis.grade || '',
        stage: cancerDiagnosis.stage || {},
        methodOfDiagnosis: cancerDiagnosis.methodOfDiagnosis || '',
        biomarkers: cancerDiagnosis.biomarkers || [],
        geneticMutations: cancerDiagnosis.geneticMutations || [],
        immunohistochemistry: cancerDiagnosis.immunohistochemistry || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('cancer_diagnoses', diagnosisData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveChemotherapyRegimen(chemotherapyRegimen, patientId, documentId, extractedData, context) {
    try {
      const chemoData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        startDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        regimenName: chemotherapyRegimen.regimenName || '',
        intent: chemotherapyRegimen.intent || '',
        drugs: chemotherapyRegimen.drugs || [],
        cycleLength: chemotherapyRegimen.cycleLength || '',
        totalCycles: chemotherapyRegimen.totalCycles || '',
        premedications: chemotherapyRegimen.premedications || [],
        growthFactorSupport: chemotherapyRegimen.growthFactorSupport || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('chemotherapy_regimens', chemoData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveTumorMarkers(tumorMarkers, patientId, documentId, extractedData, context) {
    try {
      const markersData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        cea: tumorMarkers.cea || '',
        ca199: tumorMarkers.ca199 || '',
        ca125: tumorMarkers.ca125 || '',
        ca153: tumorMarkers.ca153 || '',
        afp: tumorMarkers.afp || '',
        psa: tumorMarkers.psa || '',
        ldh: tumorMarkers.ldh || '',
        alkalinePhosphatase: tumorMarkers.alkalinePhosphatase || '',
        otherMarkers: tumorMarkers.otherMarkers || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('tumor_markers', markersData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new OncologyFieldMappingService();
