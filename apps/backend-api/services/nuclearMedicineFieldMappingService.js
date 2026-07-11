const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class NuclearMedicineFieldMappingService {
  constructor() {
    this.serviceName = 'NuclearMedicineFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[NuclearMedicineFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_NUCLEARMEDICINEFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for NuclearMedicineFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[NuclearMedicineFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[NuclearMedicineFieldMapper] Initialization failed:', error);
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
      // Map nuclear medicine-specific data
      if (extractedData.nuclearMedicineAssessment) {
        const assessment = extractedData.nuclearMedicineAssessment;

        // Save PET scan
        if (assessment.petScan) {
          const petResult = await this.savePETScan(
            assessment.petScan,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (petResult.success) {
            results.savedEntities.push('pet_scan');
          } else {
            results.errors.push(petResult.error);
          }
        }

        // Save bone scan
        if (assessment.boneScan) {
          const boneResult = await this.saveBoneScan(
            assessment.boneScan,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (boneResult.success) {
            results.savedEntities.push('bone_scan');
          } else {
            results.errors.push(boneResult.error);
          }
        }

        // Save thyroid scan
        if (assessment.thyroidScan) {
          const thyroidResult = await this.saveThyroidScan(
            assessment.thyroidScan,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (thyroidResult.success) {
            results.savedEntities.push('thyroid_scan');
          } else {
            results.errors.push(thyroidResult.error);
          }
        }

        // Save cardiac perfusion
        if (assessment.cardiacPerfusion) {
          const cardiacResult = await this.saveCardiacPerfusion(
            assessment.cardiacPerfusion,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (cardiacResult.success) {
            results.savedEntities.push('cardiac_perfusion');
          } else {
            results.errors.push(cardiacResult.error);
          }
        }

        // Save V/Q scan
        if (assessment.ventilationPerfusion) {
          const vqResult = await this.saveVentilationPerfusion(
            assessment.ventilationPerfusion,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (vqResult.success) {
            results.savedEntities.push('vq_scan');
          } else {
            results.errors.push(vqResult.error);
          }
        }
      }

      // Save general nuclear medicine report
      const reportResult = await this.saveNuclearMedicineReport(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (reportResult.success) {
        results.savedEntities.push('nuclear_medicine_report');
      } else {
        results.errors.push(reportResult.error);
      }

    } catch (error) {
      console.error(`[${this.serviceName}] Error in mapAndSaveExtractedData:`, error);
      results.success = false;
      results.errors.push(error.message);
    }

    return results;
  }

  async savePETScan(petScan, patientId, documentId, extractedData, context) {
    try {
      const petData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        scanDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        suvMax: petScan.suvMax || '',
        metabolicVolume: petScan.metabolicVolume || '',
        lesions: petScan.lesions || [],
        interpretation: petScan.interpretation || '',
        radiotracer: petScan.radiotracer || 'FDG',
        indication: petScan.indication || '',
        comparison: petScan.comparison || '',
        impression: petScan.impression || '',
        interpretedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('pet_scans', petData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving PET scan:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveBoneScan(boneScan, patientId, documentId, extractedData, context) {
    try {
      const boneData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        scanDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        uptakePattern: boneScan.uptakePattern || '',
        metastases: boneScan.metastases || [],
        fractures: boneScan.fractures || [],
        arthropathy: boneScan.arthropathy || '',
        radiotracer: boneScan.radiotracer || 'Tc-99m MDP',
        findings: boneScan.findings || '',
        impression: boneScan.impression || '',
        interpretedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('bone_scans', boneData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving bone scan:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveThyroidScan(thyroidScan, patientId, documentId, extractedData, context) {
    try {
      const thyroidData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        scanDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        uptakePercentage: thyroidScan.uptakePercentage || '',
        nodules: thyroidScan.nodules || [],
        pattern: thyroidScan.pattern || '',
        glandSize: thyroidScan.glandSize || '',
        radiotracer: thyroidScan.radiotracer || 'I-123',
        findings: thyroidScan.findings || '',
        impression: thyroidScan.impression || '',
        interpretedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('thyroid_scans', thyroidData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving thyroid scan:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveCardiacPerfusion(cardiacPerfusion, patientId, documentId, extractedData, context) {
    try {
      const cardiacData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        scanDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        restImages: cardiacPerfusion.restImages || {},
        stressImages: cardiacPerfusion.stressImages || {},
        reversibility: cardiacPerfusion.reversibility || '',
        summedScores: cardiacPerfusion.summedScores || {},
        ejectionFraction: cardiacPerfusion.ejectionFraction || '',
        wallMotion: cardiacPerfusion.wallMotion || '',
        radiotracer: cardiacPerfusion.radiotracer || 'Tc-99m Sestamibi',
        stressType: cardiacPerfusion.stressType || '',
        impression: cardiacPerfusion.impression || '',
        interpretedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('cardiac_perfusion_scans', cardiacData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving cardiac perfusion:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveVentilationPerfusion(vqScan, patientId, documentId, extractedData, context) {
    try {
      const vqData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        scanDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        vqMatch: vqScan.vqMatch || '',
        probability: vqScan.probability || '',
        defects: vqScan.defects || [],
        ventilationAgent: vqScan.ventilationAgent || 'Xe-133',
        perfusionAgent: vqScan.perfusionAgent || 'Tc-99m MAA',
        findings: vqScan.findings || '',
        impression: vqScan.impression || '',
        pioperCategory: vqScan.pioperCategory || '',
        interpretedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('vq_scans', vqData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving V/Q scan:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveNuclearMedicineReport(extractedData, patientId, documentId, sessionId, context) {
    try {
      const reportData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        reportDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        studyType: extractedData.studyType || '',
        indication: extractedData.indication || '',
        technique: extractedData.technique || '',
        findings: extractedData.findings || '',
        impression: extractedData.impression || '',
        comparison: extractedData.comparison || '',
        recommendations: extractedData.recommendations || [],
        radiationDose: extractedData.radiationDose || '',
        physicianName: extractedData.providerName || '',
        providerSpecialty: 'Nuclear Medicine',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('nuclear_medicine_reports', reportData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving nuclear medicine report:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NuclearMedicineFieldMappingService();