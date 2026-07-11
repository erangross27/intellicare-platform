const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class NephrologyFieldMappingService {
  constructor() {
    this.serviceName = 'NephrologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[NephrologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_NEPHROLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for NephrologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[NephrologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[NephrologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveCkdAssessment(ckdAssessment, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const ckdData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        stage: ckdAssessment.stage || '',
        egfr: ckdAssessment.egfr || '',
        egfrTrend: ckdAssessment.egfrTrend || [],
        creatinine: ckdAssessment.creatinine || '',
        creatinineTrend: ckdAssessment.creatinineTrend || [],
        bun: ckdAssessment.bun || '',
        bunCreatinineRatio: ckdAssessment.bunCreatinineRatio || '',
        progressionRate: ckdAssessment.progressionRate || '',
        etiology: ckdAssessment.etiology || '',
        chronicity: ckdAssessment.chronicity || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('ckd_assessments', ckdData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveProteinuriaAssessment(proteinuriaAssessment, patientId, documentId, extractedData, context) {
    try {
      const proteinuriaData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        uacr: proteinuriaAssessment.uacr || '',
        uacrCategory: proteinuriaAssessment.uacrCategory || '',
        twentyFourHourProtein: proteinuriaAssessment.twentyFourHourProtein || '',
        upcr: proteinuriaAssessment.upcr || '',
        proteinTrend: proteinuriaAssessment.proteinTrend || [],
        hematuria: proteinuriaAssessment.hematuria || false,
        hematuriaType: proteinuriaAssessment.hematuriaType || '',
        rbcCasts: proteinuriaAssessment.rbcCasts || false,
        urineElectrophoresis: proteinuriaAssessment.urineElectrophoresis || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('proteinuria_assessments', proteinuriaData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDialysisPlanning(dialysisPlanning, patientId, documentId, extractedData, context) {
    try {
      const dialysisPlanData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        planningDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        modalityPreference: dialysisPlanning.modalityPreference || '',
        accessStatus: dialysisPlanning.accessStatus || {},
        urgentStartCriteria: dialysisPlanning.urgentStartCriteria || [],
        educationCompleted: dialysisPlanning.educationCompleted || false,
        estimatedStartDate: dialysisPlanning.estimatedStartDate || '',
        contraindications: dialysisPlanning.contraindications || [],
        homeAssessment: dialysisPlanning.homeAssessment || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('dialysis_planning', dialysisPlanData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCurrentDialysis(currentDialysis, patientId, documentId, extractedData, context) {
    try {
      const dialysisData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        modality: currentDialysis.modality || '',
        schedule: currentDialysis.schedule || '',
        prescription: currentDialysis.prescription || {},
        adequacy: currentDialysis.adequacy || {},
        complications: currentDialysis.complications || [],
        pdDetails: currentDialysis.pdDetails || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('current_dialysis', dialysisData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveTransplantEvaluation(transplantEvaluation, patientId, documentId, extractedData, context) {
    try {
      const transplantData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        evaluationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        status: transplantEvaluation.status || '',
        listingDate: transplantEvaluation.listingDate || '',
        bloodType: transplantEvaluation.bloodType || '',
        pra: transplantEvaluation.pra || '',
        hlaTyping: transplantEvaluation.hlaTyping || {},
        crossmatchHistory: transplantEvaluation.crossmatchHistory || [],
        livingDonors: transplantEvaluation.livingDonors || [],
        medicalClearance: transplantEvaluation.medicalClearance || {},
        psychosocialEvaluation: transplantEvaluation.psychosocialEvaluation || {},
        contraindications: transplantEvaluation.contraindications || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('transplant_evaluations', transplantData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMineralBoneDisease(mineralBoneDisease, patientId, documentId, extractedData, context) {
    try {
      const mbdData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        pth: mineralBoneDisease.pth || '',
        pthTrend: mineralBoneDisease.pthTrend || [],
        calcium: mineralBoneDisease.calcium || '',
        phosphorus: mineralBoneDisease.phosphorus || '',
        vitaminD25: mineralBoneDisease.vitaminD25 || '',
        vitaminD125: mineralBoneDisease.vitaminD125 || '',
        alkalinePhosphatase: mineralBoneDisease.alkalinePhosphatase || '',
        medications: mineralBoneDisease.medications || [],
        boneDensity: mineralBoneDisease.boneDensity || {},
        vascularCalcification: mineralBoneDisease.vascularCalcification || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('mineral_bone_disease', mbdData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRenalAnemia(renalAnemia, patientId, documentId, extractedData, context) {
    try {
      const anemiaData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        hemoglobin: renalAnemia.hemoglobin || '',
        hemoglobinTarget: renalAnemia.hemoglobinTarget || '',
        ironStudies: renalAnemia.ironStudies || {},
        esaTherapy: renalAnemia.esaTherapy || {},
        ironTherapy: renalAnemia.ironTherapy || {},
        transfusionHistory: renalAnemia.transfusionHistory || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('renal_anemia', anemiaData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveFluidElectrolyteManagement(fluidElectrolyteManagement, patientId, documentId, extractedData, context) {
    try {
      const fluidData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        volumeStatus: fluidElectrolyteManagement.volumeStatus || '',
        dryWeight: fluidElectrolyteManagement.dryWeight || '',
        edema: fluidElectrolyteManagement.edema || '',
        bloodPressure: fluidElectrolyteManagement.bloodPressure || {},
        sodium: fluidElectrolyteManagement.sodium || '',
        potassium: fluidElectrolyteManagement.potassium || '',
        bicarbonate: fluidElectrolyteManagement.bicarbonate || '',
        chloride: fluidElectrolyteManagement.chloride || '',
        acidosisManagement: fluidElectrolyteManagement.acidosisManagement || {},
        hyperkalemiaManagement: fluidElectrolyteManagement.hyperkalemiaManagement || {},
        diureticRegimen: fluidElectrolyteManagement.diureticRegimen || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('fluid_electrolyte_management', fluidData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRenalNutrition(renalNutrition, patientId, documentId, extractedData, context) {
    try {
      const nutritionData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        proteinRestriction: renalNutrition.proteinRestriction || '',
        sodiumRestriction: renalNutrition.sodiumRestriction || '',
        potassiumRestriction: renalNutrition.potassiumRestriction || '',
        phosphorusRestriction: renalNutrition.phosphorusRestriction || '',
        fluidRestriction: renalNutrition.fluidRestriction || '',
        albumin: renalNutrition.albumin || '',
        prealbumin: renalNutrition.prealbumin || '',
        nutritionalStatus: renalNutrition.nutritionalStatus || '',
        supplementation: renalNutrition.supplementation || [],
        dietitianConsult: renalNutrition.dietitianConsult || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('renal_nutrition', nutritionData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMedicationRenalDosing(medicationRenalDosing, patientId, documentId, extractedData, context) {
    try {
      const dosingData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        reviewDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        adjustedMedications: medicationRenalDosing.adjustedMedications || [],
        contraindicatedMedications: medicationRenalDosing.contraindicatedMedications || [],
        nephrotoxicExposures: medicationRenalDosing.nephrotoxicExposures || [],
        contrastProtocol: medicationRenalDosing.contrastProtocol || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('medication_renal_dosing', dosingData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveGlomerularDisease(glomerularDisease, patientId, documentId, extractedData, context) {
    try {
      const glomerularData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diagnosis: glomerularDisease.diagnosis || '',
        biopsyFindings: glomerularDisease.biopsyFindings || {},
        immunosuppression: glomerularDisease.immunosuppression || [],
        serologies: glomerularDisease.serologies || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('glomerular_disease', glomerularData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAcuteKidneyInjury(acuteKidneyInjury, patientId, documentId, extractedData, context) {
    try {
      const akiData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        eventDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        stage: acuteKidneyInjury.stage || '',
        baselineCreatinine: acuteKidneyInjury.baselineCreatinine || '',
        peakCreatinine: acuteKidneyInjury.peakCreatinine || '',
        urineOutput: acuteKidneyInjury.urineOutput || '',
        etiology: acuteKidneyInjury.etiology || '',
        precipitants: acuteKidneyInjury.precipitants || [],
        fenA: acuteKidneyInjury.fenA || '',
        feUrea: acuteKidneyInjury.feUrea || '',
        urinaryIndices: acuteKidneyInjury.urinaryIndices || {},
        recovery: acuteKidneyInjury.recovery || '',
        dialysisRequired: acuteKidneyInjury.dialysisRequired || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('acute_kidney_injury', akiData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePolycysticKidneyDisease(polycysticKidneyDisease, patientId, documentId, extractedData, context) {
    try {
      const pkdData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: polycysticKidneyDisease.type || '',
        totalKidneyVolume: polycysticKidneyDisease.totalKidneyVolume || '',
        mayoClass: polycysticKidneyDisease.mayoClass || '',
        cystComplications: polycysticKidneyDisease.cystComplications || [],
        extrarenalManifestations: polycysticKidneyDisease.extrarenalManifestations || {},
        tolvaptanCandidate: polycysticKidneyDisease.tolvaptanCandidate || false,
        geneticTesting: polycysticKidneyDisease.geneticTesting || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('polycystic_kidney_disease', pkdData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDiabeticNephropathy(diabeticNephropathy, patientId, documentId, extractedData, context) {
    try {
      const diabeticData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        albuminuriaStage: diabeticNephropathy.albuminuriaStage || '',
        retinopathy: diabeticNephropathy.retinopathy || false,
        neuropathy: diabeticNephropathy.neuropathy || false,
        glycemicControl: diabeticNephropathy.glycemicControl || {},
        raasBlockade: diabeticNephropathy.raasBlockade || {},
        sglt2Inhibitor: diabeticNephropathy.sglt2Inhibitor || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('diabetic_nephropathy', diabeticData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveHypertensiveNephropathy(hypertensiveNephropathy, patientId, documentId, extractedData, context) {
    try {
      const hypertensiveData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        targetOrganDamage: hypertensiveNephropathy.targetOrganDamage || [],
        bloodPressureControl: hypertensiveNephropathy.bloodPressureControl || {},
        medications: hypertensiveNephropathy.medications || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('hypertensive_nephropathy', hypertensiveData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NephrologyFieldMappingService();
