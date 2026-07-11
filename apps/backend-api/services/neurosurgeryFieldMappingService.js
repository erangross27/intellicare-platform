const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class NeurosurgeryFieldMappingService {
  constructor() {
    this.serviceName = 'NeurosurgeryFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[NeurosurgeryFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_NEUROSURGERYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for NeurosurgeryFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[NeurosurgeryFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[NeurosurgeryFieldMapper] Initialization failed:', error);
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
      // Map neurosurgery-specific data
      if (extractedData.neurosurgeryAssessment) {
        const assessment = extractedData.neurosurgeryAssessment;

        // Save functional MRI
        if (assessment.functionalMri) {
          const fmriResult = await this.saveFunctionalMRI(
            assessment.functionalMri,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (fmriResult.success) {
            results.savedEntities.push('functional_mri');
          } else {
            results.errors.push(fmriResult.error);
          }
        }

        // Save tractography
        if (assessment.tractography) {
          const tractResult = await this.saveTractography(
            assessment.tractography,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (tractResult.success) {
            results.savedEntities.push('tractography');
          } else {
            results.errors.push(tractResult.error);
          }
        }

        // Save intraoperative monitoring
        if (assessment.intraoperativeMonitoring) {
          const monitoringResult = await this.saveIntraoperativeMonitoring(
            assessment.intraoperativeMonitoring,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (monitoringResult.success) {
            results.savedEntities.push('intraoperative_monitoring');
          } else {
            results.errors.push(monitoringResult.error);
          }
        }

        // Save tumor characteristics
        if (assessment.tumorCharacteristics) {
          const tumorResult = await this.saveTumorCharacteristics(
            assessment.tumorCharacteristics,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (tumorResult.success) {
            results.savedEntities.push('tumor_characteristics');
          } else {
            results.errors.push(tumorResult.error);
          }
        }

        // Save ventriculostomy data
        if (assessment.ventriculostomy) {
          const ventricResult = await this.saveVentriculostomy(
            assessment.ventriculostomy,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (ventricResult.success) {
            results.savedEntities.push('ventriculostomy');
          } else {
            results.errors.push(ventricResult.error);
          }
        }
      }

      // Save general neurosurgery consultation
      const consultationResult = await this.saveNeurosurgeryConsultation(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (consultationResult.success) {
        results.savedEntities.push('neurosurgery_consultation');
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

  async saveFunctionalMRI(fmri, patientId, documentId, extractedData, context) {
    try {
      // Merge data from multiple sources:
      // 1. neurosurgeryAssessment.functionalMri (primary)
      // 2. imaging[].functionalMRI (detailed radiology data)
      // 3. flexibleData.imagingTechniques.functionalMRI (technical details)

      let imagingFmri = null;
      let flexibleFmri = null;

      // Extract from imaging array
      if (extractedData.imaging && Array.isArray(extractedData.imaging)) {
        const fmriImaging = extractedData.imaging.find(img => img.functionalMRI);
        if (fmriImaging) {
          imagingFmri = fmriImaging.functionalMRI;
        }
      }

      // Extract from flexibleData
      if (extractedData.flexibleData?.imagingTechniques?.functionalMRI) {
        flexibleFmri = extractedData.flexibleData.imagingTechniques.functionalMRI;
      }

      const fmriData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        scanDate: extractedData.date ? new Date(extractedData.date) : new Date(),

        // Merge eloquentAreas from all sources
        eloquentAreas: fmri.eloquentAreas || imagingFmri?.eloquentCortexProximity || [],

        // Language lateralization
        languageLateralization: fmri.languageLateralization || imagingFmri?.languageDominance || '',

        // Motor mapping
        motorMapping: fmri.motorMapping || imagingFmri?.motorMapping || {},

        // Sensory mapping (from activationMaps if available)
        sensoryMapping: fmri.sensoryMapping || this._extractSensoryMapping(imagingFmri) || {},

        // Memory areas (from activationMaps if available)
        memoryAreas: fmri.memoryAreas || this._extractMemoryAreas(imagingFmri) || {},

        // Visual areas (from activationMaps if available)
        visualAreas: fmri.visualAreas || this._extractVisualAreas(imagingFmri) || {},

        // Proximity to lesion
        proximityToLesion: fmri.proximityToLesion || this._extractProximityToLesion(imagingFmri) || '',

        // Surgical risk
        surgicalRisk: fmri.surgicalRisk || this._extractSurgicalRisk(imagingFmri) || '',

        // Technical details from fmri (schema), flexibleData (fallback)
        technique: fmri.technique || flexibleFmri?.technique || '',
        acquisitionParameters: fmri.acquisitionParameters || flexibleFmri?.acquisition || {},
        tasks: fmri.tasks || flexibleFmri?.tasks || [],

        interpretedBy: extractedData.providerName || extractedData.providers?.primary || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('functional_mri_studies', fmriData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving functional MRI:`, error);
      return { success: false, error: error.message };
    }
  }

  // Helper methods to extract data from imaging activationMaps
  _extractSensoryMapping(imagingFmri) {
    if (!imagingFmri?.activationMaps) return {};
    const sensoryMaps = imagingFmri.activationMaps.filter(map =>
      map.region?.toLowerCase().includes('sensory') ||
      map.region?.toLowerCase().includes('somatosensory')
    );
    return sensoryMaps.length > 0 ? { maps: sensoryMaps } : {};
  }

  _extractMemoryAreas(imagingFmri) {
    if (!imagingFmri?.activationMaps) return {};
    const memoryMaps = imagingFmri.activationMaps.filter(map =>
      map.region?.toLowerCase().includes('hippocampus') ||
      map.region?.toLowerCase().includes('memory')
    );
    return memoryMaps.length > 0 ? { maps: memoryMaps } : {};
  }

  _extractVisualAreas(imagingFmri) {
    if (!imagingFmri?.activationMaps) return {};
    const visualMaps = imagingFmri.activationMaps.filter(map =>
      map.region?.toLowerCase().includes('visual') ||
      map.region?.toLowerCase().includes('occipital')
    );
    return visualMaps.length > 0 ? { maps: visualMaps } : {};
  }

  _extractProximityToLesion(imagingFmri) {
    if (!imagingFmri?.eloquentCortexProximity || !Array.isArray(imagingFmri.eloquentCortexProximity)) return '';

    // Summarize proximity from all eloquent areas
    const proximities = imagingFmri.eloquentCortexProximity.map(area =>
      `${area.cortexRegion}: ${area.distanceToLesion}`
    );
    return proximities.join('; ');
  }

  _extractSurgicalRisk(imagingFmri) {
    if (!imagingFmri?.eloquentCortexProximity || !Array.isArray(imagingFmri.eloquentCortexProximity)) return '';

    // Find highest risk level
    const risks = imagingFmri.eloquentCortexProximity.map(area => area.riskAssessment?.toLowerCase() || '');
    if (risks.includes('high risk') || risks.includes('moderate risk')) return 'High';
    if (risks.includes('low risk')) return 'Low';
    return '';
  }

  async saveTractography(tractography, patientId, documentId, extractedData, context) {
    try {
      // Merge data from multiple sources:
      // 1. neurosurgeryAssessment.tractography (primary)
      // 2. imaging[].diffusionTensorImaging (detailed DTI data)
      // 3. flexibleData.imagingTechniques.diffusionTensorImaging (technical details)

      let imagingDti = null;
      let flexibleDti = null;

      // Extract from imaging array
      if (extractedData.imaging && Array.isArray(extractedData.imaging)) {
        const dtiImaging = extractedData.imaging.find(img => img.diffusionTensorImaging);
        if (dtiImaging) {
          imagingDti = dtiImaging.diffusionTensorImaging;
        }
      }

      // Extract from flexibleData
      if (extractedData.flexibleData?.imagingTechniques?.diffusionTensorImaging) {
        flexibleDti = extractedData.flexibleData.imagingTechniques.diffusionTensorImaging;
      }

      const tractData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),

        // Merge tract data from all sources
        corticospinalTract: tractography.corticospinalTract || imagingDti?.corticospinalTract || {},
        arcuateFasciculus: tractography.arcuateFasciculus || imagingDti?.arcuateFasciculus || {},
        opticRadiation: tractography.opticRadiation || this._extractTractByName(imagingDti, 'optic radiation') || {},
        corpusCallosum: tractography.corpusCallosum || this._extractTractByName(imagingDti, 'corpus callosum') || {},
        cingulum: tractography.cingulum || this._extractTractByName(imagingDti, 'cingulum') || {},

        // Additional tracts from imaging
        superiorLongitudinalFasciculus: this._extractTractByName(imagingDti, 'superior longitudinal fasciculus') || {},

        lesionRelationship: tractography.lesionRelationship || '',
        displacement: tractography.displacement || '',
        infiltration: tractography.infiltration || '',

        // Technical details from tractography (schema), flexibleData (fallback)
        sequences: tractography.sequences || flexibleDti?.sequences || {},
        fiberTractsReconstructed: tractography.fiberTractsReconstructed || flexibleDti?.fiberTractsReconstructed || [],
        software: tractography.software || flexibleDti?.software || '',

        // Fractional anisotropy values
        fractionalAnisotropy: imagingDti?.fractionalAnisotropy || {},

        interpretedBy: extractedData.providerName || extractedData.providers?.primary || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('tractography_studies', tractData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving tractography:`, error);
      return { success: false, error: error.message };
    }
  }

  // Helper to extract specific tract by name from whiteMatterTracts array
  _extractTractByName(imagingDti, tractName) {
    if (!imagingDti?.whiteMatterTracts || !Array.isArray(imagingDti.whiteMatterTracts)) return null;

    const tract = imagingDti.whiteMatterTracts.find(t =>
      t.tract?.toLowerCase().includes(tractName.toLowerCase())
    );
    return tract || null;
  }

  async saveIntraoperativeMonitoring(monitoring, patientId, documentId, extractedData, context) {
    try {
      const monitoringData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        ssep: monitoring.ssep || {},
        mep: monitoring.mep || {},
        directStimulation: monitoring.directStimulation || {},
        eeg: monitoring.eeg || {},
        emg: monitoring.emg || {},
        mappingResults: monitoring.mappingResults || [],
        alerts: monitoring.alerts || [],
        changes: monitoring.changes || [],
        monitoredBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('intraoperative_monitoring', monitoringData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving intraoperative monitoring:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveTumorCharacteristics(tumor, patientId, documentId, extractedData, context) {
    try {
      // Merge tumor data from flexibleData if available
      const flexibleTumor = extractedData.flexibleData?.tumorLocation;
      const molecularMarkers = extractedData.brainTumorMolecularMarkers;

      const tumorData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        analysisDate: extractedData.date ? new Date(extractedData.date) : new Date(),

        // Molecular markers (from brainTumorMolecularMarkers or tumor)
        whoGrade: tumor.whoGrade || molecularMarkers?.whoGrade || '',
        idh1Status: tumor.idh1Status || molecularMarkers?.idhStatus?.result || '',
        mgmtMethylation: tumor.mgmtMethylation || molecularMarkers?.codeletionStatus?.result || '',
        ki67Index: tumor.ki67Index || '',

        // Tumor characteristics
        location: tumor.location || flexibleTumor || '',
        size: tumor.size || '',
        edema: tumor.edema || '',
        massEffect: tumor.massEffect || '',
        enhancement: tumor.enhancement || '',
        pathology: tumor.pathology || '',

        // Molecular classification
        molecularClassification: molecularMarkers?.molecularClassification || '',

        analyzedBy: extractedData.providerName || extractedData.providers?.primary || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('brain_tumor_characteristics', tumorData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving tumor characteristics:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveVentriculostomy(ventriculostomy, patientId, documentId, extractedData, context) {
    try {
      const ventricData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        placementDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        icp: ventriculostomy.icp || '',
        cppGoal: ventriculostomy.cppGoal || '',
        csfDrainage: ventriculostomy.csfDrainage || '',
        waveform: ventriculostomy.waveform || '',
        position: ventriculostomy.position || '',
        complications: ventriculostomy.complications || [],
        duration: ventriculostomy.duration || '',
        managedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('ventriculostomy_management', ventricData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving ventriculostomy:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveNeurosurgeryConsultation(extractedData, patientId, documentId, sessionId, context) {
    try {
      // Merge data from multiple sources
      const flexible = extractedData.flexibleData || {};
      const consultation = extractedData.neurosurgeryAssessment?.consultation || {};
      const surgicalPlanning = extractedData.imaging?.[0]?.surgicalPlanningRiskAssessment;

      const consultationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),

        // Basic consultation data
        diagnosis: extractedData.diagnosis || extractedData.diagnoses || [],
        lesionLocation: extractedData.lesionLocation || consultation.lesionLocation || flexible.tumorLocation || '',
        proposedProcedure: extractedData.proposedProcedure || consultation.surgeryPlanned || flexible.surgeryPlanned || '',
        surgicalApproach: extractedData.surgicalApproach || surgicalPlanning?.recommendedApproach || '',
        risks: extractedData.risks || [],
        eloquentAreas: extractedData.eloquentAreas || [],
        awakeCase: extractedData.awakeCase || false,
        neuromonitoring: extractedData.neuromonitoring || false,
        prognosis: extractedData.prognosis || '',
        followUp: extractedData.followUp || '',

        // Additional data from consultation or flexibleData
        neuronavigationSystem: consultation.neuronavigationSystem || flexible.neuronavigationSystem || '',
        safeResectionBoundaries: consultation.safeResectionBoundaries || flexible.safeResectionBoundaries || {},
        intraoperativeMappingProtocol: consultation.intraoperativeMappingProtocol || flexible.intraoperativeMappingProtocol || {},
        colorCoding: consultation.colorCoding || flexible.colorCoding || {},

        // Prognosis and outcomes
        oncologicImpact: consultation.oncologicImpact || flexible.oncologicImpact || {},

        // Imaging comparison
        imagingLimitations: consultation.imagingLimitations || flexible.imagingLimitations || {},
        comparisonToStandardMRI: consultation.comparisonToStandardMRI || flexible.comparisonToStandardMRI || {},

        // Structural MRI sequences (from consultation or flexibleData.imagingTechniques.structuralMRI)
        structuralMriSequences: consultation.structuralMriSequences || flexible.imagingTechniques?.structuralMRI?.sequences || [],

        neurosurgeonName: extractedData.providerName || extractedData.providers?.primary || '',
        providerSpecialty: 'Neurosurgery',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Check if document has any meaningful data before saving
      const hasData = (
        (consultationData.diagnosis && consultationData.diagnosis.length > 0) ||
        consultationData.lesionLocation ||
        consultationData.proposedProcedure ||
        consultationData.surgicalApproach ||
        (consultationData.risks && consultationData.risks.length > 0) ||
        (consultationData.eloquentAreas && consultationData.eloquentAreas.length > 0) ||
        consultationData.awakeCase ||
        consultationData.neuromonitoring ||
        consultationData.prognosis ||
        consultationData.followUp ||
        consultationData.neurosurgeonName ||
        consultationData.facilityName ||
        consultationData.neuronavigationSystem ||
        (consultationData.safeResectionBoundaries && Object.keys(consultationData.safeResectionBoundaries).length > 0)
      );

      if (!hasData) {
        console.log(`[${this.serviceName}] Skipping empty neurosurgery consultation for document ${documentId}`);
        return { success: true, skipped: true, reason: 'No meaningful data extracted' };
      }

      await SecureDataAccess.insert('neurosurgery_consultations', consultationData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving neurosurgery consultation:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NeurosurgeryFieldMappingService();