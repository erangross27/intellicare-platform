const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class SurgicalFieldMappingService {
  constructor() {
    this.serviceName = 'SurgicalFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[SurgicalFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_SURGICALFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for SurgicalFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[SurgicalFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[SurgicalFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveSurgicalTeam(surgicalTeam, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const teamData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        primarySurgeon: surgicalTeam.primarySurgeon || '',
        assistantSurgeons: surgicalTeam.assistantSurgeons || [],
        anesthesiologist: surgicalTeam.anesthesiologist || '',
        scrubNurse: surgicalTeam.scrubNurse || '',
        circulatingNurse: surgicalTeam.circulatingNurse || '',
        residents: surgicalTeam.residents || [],
        students: surgicalTeam.students || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('surgical_teams', teamData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveOperativeDetails(operativeDetails, patientId, documentId, extractedData, context) {
    try {
      const operativeData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: operativeDetails.surgeryDate ? new Date(operativeDetails.surgeryDate) : new Date(),
        startTime: operativeDetails.startTime || '',
        endTime: operativeDetails.endTime || '',
        totalDuration: operativeDetails.totalDuration || '',
        preoperativeDiagnosis: operativeDetails.preoperativeDiagnosis || [],
        postoperativeDiagnosis: operativeDetails.postoperativeDiagnosis || [],
        proceduresPerformed: operativeDetails.proceduresPerformed || [],
        indication: operativeDetails.indication || '',
        urgency: operativeDetails.urgency || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('operative_details', operativeData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAnesthesiaRecord(anesthesiaRecord, patientId, documentId, extractedData, context) {
    try {
      const anesthesiaData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        anesthesiaType: anesthesiaRecord.anesthesiaType || '',
        intubationType: anesthesiaRecord.intubationType || '',
        induction: anesthesiaRecord.induction || {},
        maintenance: anesthesiaRecord.maintenance || {},
        emergence: anesthesiaRecord.emergence || '',
        monitoring: anesthesiaRecord.monitoring || [],
        complications: anesthesiaRecord.complications || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('anesthesia_records', anesthesiaData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSurgicalApproach(surgicalApproach, patientId, documentId, extractedData, context) {
    try {
      const approachData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        technique: surgicalApproach.technique || '',
        positioning: surgicalApproach.positioning || '',
        prepAndDraping: surgicalApproach.prepAndDraping || '',
        portPlacement: surgicalApproach.portPlacement || [],
        incisions: surgicalApproach.incisions || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('surgical_approaches', approachData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveIntraoperativeFindings(intraoperativeFindings, patientId, documentId, extractedData, context) {
    try {
      const findingsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        normalAnatomy: intraoperativeFindings.normalAnatomy !== undefined ? intraoperativeFindings.normalAnatomy : true,
        anatomicalVariants: intraoperativeFindings.anatomicalVariants || [],
        pathologicalFindings: intraoperativeFindings.pathologicalFindings || [],
        adhesions: intraoperativeFindings.adhesions || {},
        contamination: intraoperativeFindings.contamination || '',
        additionalProcedures: intraoperativeFindings.additionalProcedures || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('intraoperative_findings', findingsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveOperativeTechnique(operativeTechnique, patientId, documentId, extractedData, context) {
    try {
      const techniqueData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        stepByStep: operativeTechnique.stepByStep || [],
        criticalSteps: operativeTechnique.criticalSteps || [],
        hemostasis: operativeTechnique.hemostasis || '',
        irrigation: operativeTechnique.irrigation || '',
        drains: operativeTechnique.drains || [],
        closure: operativeTechnique.closure || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('operative_techniques', techniqueData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveIntraoperativeImaging(intraoperativeImaging, patientId, documentId, extractedData, context) {
    try {
      const imagingData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        cholangiography: intraoperativeImaging.cholangiography || {},
        fluoroscopy: intraoperativeImaging.fluoroscopy || {},
        ultrasound: intraoperativeImaging.ultrasound || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('intraoperative_imaging', imagingData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSurgicalSpecimens(specimens, patientId, documentId, extractedData, context) {
    try {
      for (const specimen of specimens) {
        const specimenData = {
          patientId: new ObjectId(patientId),
          documentId: documentId,
          collectionDate: extractedData.date ? new Date(extractedData.date) : new Date(),
          description: specimen.description || '',
          handling: specimen.handling || '',
          pathologyNumber: specimen.pathologyNumber || '',
          preliminaryResults: specimen.preliminaryResults || '',
          finalResults: specimen.finalResults || '',
          source: 'document_analysis',
          aiProcessed: true
        };

        await SecureDataAccess.insert('surgical_specimens', specimenData, context);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveEstimatedBloodLoss(estimatedBloodLoss, patientId, documentId, extractedData, context) {
    try {
      const bloodLossData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        amount: estimatedBloodLoss.amount || '',
        transfusionRequired: estimatedBloodLoss.transfusionRequired || false,
        bloodProductsGiven: estimatedBloodLoss.bloodProductsGiven || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('estimated_blood_loss', bloodLossData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSurgicalComplications(complications, patientId, documentId, extractedData, context) {
    try {
      const complicationsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        intraoperative: complications.intraoperative || [],
        immediate: complications.immediate || [],
        management: complications.management || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('surgical_complications', complicationsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePostoperativeOrders(postoperativeOrders, patientId, documentId, extractedData, context) {
    try {
      const ordersData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        orderDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diet: postoperativeOrders.diet || '',
        activity: postoperativeOrders.activity || '',
        painManagement: postoperativeOrders.painManagement || [],
        antibiotics: postoperativeOrders.antibiotics || [],
        prophylaxis: postoperativeOrders.prophylaxis || [],
        monitoring: postoperativeOrders.monitoring || [],
        specialInstructions: postoperativeOrders.specialInstructions || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('postoperative_orders', ordersData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveSurgicalDischargePlanning(dischargePlanning, patientId, documentId, extractedData, context) {
    try {
      const dischargeData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        planningDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        expectedLOS: dischargePlanning.expectedLOS || '',
        dischargeDestination: dischargePlanning.dischargeDestination || '',
        followUpInstructions: dischargePlanning.followUpInstructions || [],
        activityRestrictions: dischargePlanning.activityRestrictions || [],
        returnToWork: dischargePlanning.returnToWork || '',
        warningSignsToWatch: dischargePlanning.warningSignsToWatch || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('surgical_discharge_planning', dischargeData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SurgicalFieldMappingService();
