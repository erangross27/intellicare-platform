const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class InfectiousDiseaseFieldMappingService {
  constructor() {
    this.serviceName = 'InfectiousDiseaseFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[InfectiousDiseaseFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_INFECTIOUSDISEASEFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for InfectiousDiseaseFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[InfectiousDiseaseFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[InfectiousDiseaseFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveHIVManagement(hivData, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const hivManagement = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        cd4Count: hivData.cd4Count || '',
        cd4Percentage: hivData.cd4Percentage || '',
        viralLoad: hivData.viralLoad || '',
        artRegimen: hivData.artRegimen || [],
        adherence: hivData.adherence || '',
        resistance: hivData.resistance || {},
        opportunisticInfections: hivData.opportunisticInfections || [],
        prophylaxis: hivData.prophylaxis || [],
        complications: hivData.complications || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('hiv_management', hivManagement, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveHepatitisManagement(hepatitisData, patientId, documentId, extractedData, context) {
    try {
      const hepatitis = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        hepatitisType: hepatitisData.hepatitisType || '',
        viralLoad: hepatitisData.viralLoad || '',
        genotype: hepatitisData.genotype || '',
        alt: hepatitisData.alt || '',
        ast: hepatitisData.ast || '',
        fibrosis: hepatitisData.fibrosis || '',
        cirrhosis: hepatitisData.cirrhosis || false,
        treatment: hepatitisData.treatment || [],
        svr: hepatitisData.svr || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('hepatitis_management', hepatitis, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveTuberculosisTreatment(tbData, patientId, documentId, extractedData, context) {
    try {
      const tbTreatment = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        treatmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        tbType: tbData.tbType || '',
        siteOfDisease: tbData.siteOfDisease || [],
        smearResult: tbData.smearResult || '',
        cultureResult: tbData.cultureResult || '',
        genexpert: tbData.genexpert || '',
        drugSusceptibility: tbData.drugSusceptibility || {},
        treatmentRegimen: tbData.treatmentRegimen || [],
        treatmentPhase: tbData.treatmentPhase || '',
        dots: tbData.dots || false,
        sideEffects: tbData.sideEffects || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('tuberculosis_treatment', tbTreatment, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveCultureResults(cultureData, patientId, documentId, extractedData, context) {
    try {
      const culture = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        collectionDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        specimenSource: cultureData.specimenSource || '',
        organism: cultureData.organism || '',
        colonyCount: cultureData.colonyCount || '',
        gramStain: cultureData.gramStain || '',
        antibiogram: cultureData.antibiogram || {},
        sensitivities: cultureData.sensitivities || [],
        resistances: cultureData.resistances || [],
        esbl: cultureData.esbl || false,
        mdrStatus: cultureData.mdrStatus || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('culture_results', culture, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAntimicrobialStewardship(stewardshipData, patientId, documentId, extractedData, context) {
    try {
      const stewardship = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        reviewDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        indication: stewardshipData.indication || '',
        currentAntibiotics: stewardshipData.currentAntibiotics || [],
        duration: stewardshipData.duration || '',
        deEscalation: stewardshipData.deEscalation || '',
        ivToPoConversion: stewardshipData.ivToPoConversion || false,
        recommendations: stewardshipData.recommendations || [],
        adherenceToGuidelines: stewardshipData.adherenceToGuidelines || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('antimicrobial_stewardship', stewardship, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveInfectionControl(infectionControlData, patientId, documentId, extractedData, context) {
    try {
      const infectionControl = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        isolationType: infectionControlData.isolationType || '',
        mdroScreening: infectionControlData.mdroScreening || {},
        exposures: infectionControlData.exposures || [],
        outbreakInvestigation: infectionControlData.outbreakInvestigation || '',
        contactTracing: infectionControlData.contactTracing || [],
        prophylaxisGiven: infectionControlData.prophylaxisGiven || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('infection_control', infectionControl, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveTravelMedicine(travelData, patientId, documentId, extractedData, context) {
    try {
      const travelMedicine = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        destinations: travelData.destinations || [],
        travelDates: travelData.travelDates || {},
        vaccinations: travelData.vaccinations || [],
        malariaProphylaxis: travelData.malariaProphylaxis || '',
        travelAdvice: travelData.travelAdvice || [],
        preExistingConditions: travelData.preExistingConditions || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('travel_medicine', travelMedicine, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveInfectiousDiseaseConsultation(consultation, patientId, documentId, extractedData, context) {
    try {
      const consultData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: consultation.chiefComplaint || extractedData.chiefComplaint || '',
        infectiousDiagnoses: consultation.infectiousDiagnoses || extractedData.diagnoses || [],
        microbiologyResults: consultation.microbiologyResults || {},
        antibioticHistory: consultation.antibioticHistory || [],
        immuneStatus: consultation.immuneStatus || '',
        treatmentPlan: consultation.treatmentPlan || [],
        infectionPrevention: consultation.infectionPrevention || [],
        recommendations: consultation.recommendations || extractedData.recommendations || '',
        followUp: consultation.followUp || extractedData.followUpAppointments || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('infectious_disease_consultations', consultData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new InfectiousDiseaseFieldMappingService();
