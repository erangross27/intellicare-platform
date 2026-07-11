const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class PMRFieldMappingService {
  constructor() {
    this.serviceName = 'PMRFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[PMRFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_PMRFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for PmrFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[PmrFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[PmrFieldMapper] Initialization failed:', error);
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
      // Map PMR-specific data
      if (extractedData.pmrAssessment) {
        const assessment = extractedData.pmrAssessment;

        // Save functional assessment
        if (assessment.functionalAssessment) {
          const functionalResult = await this.saveFunctionalAssessment(
            assessment.functionalAssessment,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (functionalResult.success) {
            results.savedEntities.push('functional_assessments');
          } else {
            results.errors.push(functionalResult.error);
          }
        }

        // Save gait analysis
        if (assessment.gaitAnalysis) {
          const gaitResult = await this.saveGaitAnalysis(
            assessment.gaitAnalysis,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (gaitResult.success) {
            results.savedEntities.push('gait_analysis');
          } else {
            results.errors.push(gaitResult.error);
          }
        }

        // Save spasticity assessment
        if (assessment.spasticityAssessment) {
          const spasticityResult = await this.saveSpasticityAssessment(
            assessment.spasticityAssessment,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (spasticityResult.success) {
            results.savedEntities.push('spasticity_assessment');
          } else {
            results.errors.push(spasticityResult.error);
          }
        }

        // Save EMG studies
        if (assessment.emgStudies) {
          const emgResult = await this.saveEMGStudies(
            assessment.emgStudies,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (emgResult.success) {
            results.savedEntities.push('emg_studies');
          } else {
            results.errors.push(emgResult.error);
          }
        }

        // Save orthotic data
        if (assessment.orthotic) {
          const orthoticResult = await this.saveOrthotic(
            assessment.orthotic,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (orthoticResult.success) {
            results.savedEntities.push('orthotic_prescription');
          } else {
            results.errors.push(orthoticResult.error);
          }
        }
      }

      // Save general PMR evaluation
      const evaluationResult = await this.savePMREvaluation(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (evaluationResult.success) {
        results.savedEntities.push('pmr_evaluation');
      } else {
        results.errors.push(evaluationResult.error);
      }

    } catch (error) {
      console.error(`[${this.serviceName}] Error in mapAndSaveExtractedData:`, error);
      results.success = false;
      results.errors.push(error.message);
    }

    return results;
  }

  async saveFunctionalAssessment(functional, patientId, documentId, extractedData, context) {
    try {
      const functionalData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        fimScore: functional.fimScore || null,
        barthelIndex: functional.barthel || null,
        bergBalanceScore: functional.bergBalance || null,
        timedUpAndGo: functional.timedUpAndGo || '',
        sixMinuteWalk: functional.sixMinuteWalk || '',
        functionalLevel: functional.functionalLevel || '',
        mobilityStatus: functional.mobilityStatus || '',
        adlIndependence: functional.adlIndependence || '',
        assessor: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('functional_assessments', functionalData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving functional assessment:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveGaitAnalysis(gait, patientId, documentId, extractedData, context) {
    try {
      const gaitData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        analysisDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        cadence: gait.cadence || '',
        strideLength: gait.strideLength || '',
        velocity: gait.velocity || '',
        assistiveDevice: gait.assistiveDevice || '',
        gaitPattern: gait.pattern || '',
        weightBearing: gait.weightBearing || '',
        balance: gait.balance || '',
        recommendations: gait.recommendations || [],
        analyzedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('gait_analyses', gaitData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving gait analysis:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveSpasticityAssessment(spasticity, patientId, documentId, extractedData, context) {
    try {
      const spasticityData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        ashworthScale: spasticity.ashworthScale || {},
        tardieuScale: spasticity.tardieu || {},
        pendelumTest: spasticity.pendelumTest || '',
        affectedMuscles: spasticity.affectedMuscles || [],
        severity: spasticity.severity || '',
        functionalImpact: spasticity.functionalImpact || '',
        treatment: spasticity.treatment || [],
        assessedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('spasticity_assessments', spasticityData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving spasticity assessment:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveEMGStudies(emg, patientId, documentId, extractedData, context) {
    try {
      const emgData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        nerveConduction: emg.nerveConduction || {},
        needleEmg: emg.needleEmg || {},
        repetitiveStimulation: emg.repetitiveStimulation || {},
        findings: emg.findings || '',
        interpretation: emg.interpretation || '',
        diagnosis: emg.diagnosis || [],
        recommendations: emg.recommendations || [],
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('emg_studies', emgData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving EMG studies:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveOrthotic(orthotic, patientId, documentId, extractedData, context) {
    try {
      const orthoticData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        prescriptionDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: orthotic.type || '',
        prescription: orthotic.prescription || '',
        modifications: orthotic.modifications || [],
        purpose: orthotic.purpose || '',
        wearSchedule: orthotic.wearSchedule || '',
        followUpPlan: orthotic.followUpPlan || '',
        prescribedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('orthotic_prescriptions', orthoticData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving orthotic:`, error);
      return { success: false, error: error.message };
    }
  }

  async savePMREvaluation(extractedData, patientId, documentId, sessionId, context) {
    try {
      // Map field names from extraction to schema
      const pmrData = extractedData.pmrAssessment || {};
      const therapyInterventions = pmrData.therapyInterventions || {};

      const evaluationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        evaluationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: extractedData.chiefComplaint || '',
        // Map diagnoses (plural) to diagnosis
        diagnosis: extractedData.diagnoses || extractedData.diagnosis || [],
        functionalStatus: pmrData.functionalHistory?.currentFunctionalStatus || extractedData.functionalStatus || '',
        // Map treatmentGoals.patientGoals to rehabilitationGoals
        rehabilitationGoals: extractedData.treatmentGoals?.patientGoals || extractedData.rehabilitationGoals || [],
        treatmentPlan: extractedData.treatmentPlan || '',
        // Map therapy interventions to therapies array
        therapies: [
          ...(therapyInterventions.physicalTherapy ? [{
            type: 'Physical Therapy',
            frequency: therapyInterventions.physicalTherapy.frequency,
            duration: therapyInterventions.physicalTherapy.duration,
            interventions: therapyInterventions.physicalTherapy.interventions
          }] : []),
          ...(therapyInterventions.occupationalTherapy ? [{
            type: 'Occupational Therapy',
            frequency: therapyInterventions.occupationalTherapy.frequency,
            duration: therapyInterventions.occupationalTherapy.duration,
            interventions: therapyInterventions.occupationalTherapy.interventions
          }] : []),
          ...(therapyInterventions.speechTherapy ? [{
            type: 'Speech Therapy',
            frequency: therapyInterventions.speechTherapy.frequency,
            duration: therapyInterventions.speechTherapy.duration,
            interventions: therapyInterventions.speechTherapy.interventions
          }] : []),
          ...(therapyInterventions.psychology ? [{
            type: 'Psychology',
            interventions: therapyInterventions.psychology.interventions
          }] : [])
        ],
        prognosis: extractedData.prognosis || '',
        dischargeDisposition: pmrData.dischargePlanningPMR?.longTermGoal || extractedData.dischargeDisposition || '',
        followUp: extractedData.followUp || '',
        providerName: extractedData.providers?.primary || extractedData.providerName || '',
        providerSpecialty: 'Physical Medicine & Rehabilitation',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('pmr_evaluations', evaluationData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving PMR evaluation:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PMRFieldMappingService();