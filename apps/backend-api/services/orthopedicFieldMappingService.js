const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class OrthopedicFieldMappingService {
  constructor() {
    this.serviceName = 'OrthopedicFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[OrthopedicFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_ORTHOPEDICFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for OrthopedicFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[OrthopedicFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[OrthopedicFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  async saveMechanismOfInjury(mechanismOfInjury, patientId, documentId, extractedData, context) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const injuryData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        dateOfInjury: mechanismOfInjury.dateOfInjury ? new Date(mechanismOfInjury.dateOfInjury) : null,
        mechanism: mechanismOfInjury.mechanism || '',
        activity: mechanismOfInjury.activity || '',
        immediateSymptoms: mechanismOfInjury.immediateSymptoms || [],
        initialTreatment: mechanismOfInjury.initialTreatment || '',
        timeToSurgery: mechanismOfInjury.timeToSurgery || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('injury_mechanisms', injuryData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveOrthopedicImaging(orthopedicImaging, patientId, documentId, extractedData, context) {
    try {
      const imagingData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        imagingDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        xray: orthopedicImaging.xray || {},
        mri: orthopedicImaging.mri || {},
        ct: orthopedicImaging.ct || {},
        boneContusions: orthopedicImaging.boneContusions || [],
        effusion: orthopedicImaging.effusion || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('orthopedic_imaging', imagingData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveLigamentReconstruction(ligamentReconstruction, patientId, documentId, extractedData, context) {
    try {
      const reconstructionData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        ligament: ligamentReconstruction.ligament || '',
        graftType: ligamentReconstruction.graftType || '',
        graftSource: ligamentReconstruction.graftSource || '',
        graftSize: ligamentReconstruction.graftSize || {},
        tunnelPlacement: ligamentReconstruction.tunnelPlacement || {},
        fixation: ligamentReconstruction.fixation || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('ligament_reconstructions', reconstructionData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveMeniscusRepair(meniscusRepair, patientId, documentId, extractedData, context) {
    try {
      const meniscusData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        location: meniscusRepair.location || '',
        tearType: meniscusRepair.tearType || '',
        zone: meniscusRepair.zone || '',
        treatment: meniscusRepair.treatment || '',
        repairTechnique: meniscusRepair.repairTechnique || '',
        percentRemoved: meniscusRepair.percentRemoved || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('meniscus_repairs', meniscusData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveArticularCartilage(articularCartilage, patientId, documentId, extractedData, context) {
    try {
      const cartilageData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        location: articularCartilage.location || [],
        grade: articularCartilage.grade || '',
        size: articularCartilage.size || '',
        treatment: articularCartilage.treatment || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('articular_cartilage', cartilageData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveTourniquetData(tourniquetData, patientId, documentId, extractedData, context) {
    try {
      const tourniquetInfo = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        surgeryDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        used: tourniquetData.used || false,
        pressure: tourniquetData.pressure || '',
        duration: tourniquetData.duration || '',
        location: tourniquetData.location || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('tourniquet_data', tourniquetInfo, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async savePostOpTesting(postOpTesting, patientId, documentId, extractedData, context) {
    try {
      const testingData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        lachmanTest: postOpTesting.lachmanTest || '',
        pivotShift: postOpTesting.pivotShift || '',
        anteriorDrawer: postOpTesting.anteriorDrawer || '',
        posteriorDrawer: postOpTesting.posteriorDrawer || '',
        varusValgusStress: postOpTesting.varusValgusStress || {},
        rangeOfMotion: postOpTesting.rangeOfMotion || {},
        impingement: postOpTesting.impingement || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('post_op_testing', testingData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveRehabilitationProtocol(rehabilitationProtocol, patientId, documentId, extractedData, context) {
    try {
      const rehabData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        protocolDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        phases: rehabilitationProtocol.phases || [],
        braceProtocol: rehabilitationProtocol.braceProtocol || {},
        cpmProtocol: rehabilitationProtocol.cpmProtocol || {},
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('rehabilitation_protocols', rehabData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveReturnToSport(returnToSport, patientId, documentId, extractedData, context) {
    try {
      const rtsData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        planDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        sport: returnToSport.sport || '',
        level: returnToSport.level || '',
        timelineToRunning: returnToSport.timelineToRunning || '',
        timelineToPractice: returnToSport.timelineToPractice || '',
        timelineToCompetition: returnToSport.timelineToCompetition || '',
        criteria: returnToSport.criteria || [],
        functionalTests: returnToSport.functionalTests || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('return_to_sport', rtsData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveDvtProphylaxis(dvtProphylaxis, patientId, documentId, extractedData, context) {
    try {
      const dvtData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        startDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        medication: dvtProphylaxis.medication || '',
        dose: dvtProphylaxis.dose || '',
        duration: dvtProphylaxis.duration || '',
        mechanicalProphylaxis: dvtProphylaxis.mechanicalProphylaxis || [],
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('dvt_prophylaxis', dvtData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveNeurovascularExam(neurovascularExam, patientId, documentId, extractedData, context) {
    try {
      const nvExamData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        examDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        sensoryExam: neurovascularExam.sensoryExam || {},
        motorExam: neurovascularExam.motorExam || {},
        pulses: neurovascularExam.pulses || {},
        capillaryRefill: neurovascularExam.capillaryRefill || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('neurovascular_exams', nvExamData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveAthleteSpecificData(athleteSpecificData, patientId, documentId, extractedData, context) {
    try {
      const athleteData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        recordDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        sport: athleteSpecificData.sport || '',
        position: athleteSpecificData.position || '',
        professionalLevel: athleteSpecificData.professionalLevel || false,
        teamSupport: athleteSpecificData.teamSupport || false,
        previousInjuries: athleteSpecificData.previousInjuries || [],
        psychologicalSupport: athleteSpecificData.psychologicalSupport || false,
        antiDopingNotification: athleteSpecificData.antiDopingNotification || false,
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('athlete_data', athleteData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new OrthopedicFieldMappingService();
