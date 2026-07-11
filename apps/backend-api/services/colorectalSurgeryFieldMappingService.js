const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class ColorectalSurgeryFieldMappingService {
  constructor() {
    this.serviceName = 'ColorectalSurgeryFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[ColorectalSurgeryFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_MEDICAL_DATA_SERVICE_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for medical-data-service from KMS');
      }

      this.initialized = true;
      console.log('[ColorectalSurgeryFieldMapper] Service initialized with medical-data-service API key');
    } catch (error) {
      console.error('[ColorectalSurgeryFieldMapper] Initialization failed:', error);
      throw error;
    }
  }

  async mapAndSaveExtractedData(extractedData, patientId, documentId, sessionId, practiceSubdomain) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const context = {
      serviceId: 'medical-data-service',
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
      // Map colorectal surgery-specific data
      if (extractedData.colorectalSurgeryAssessment) {
        const assessment = extractedData.colorectalSurgeryAssessment;

        // Save colonoscopy
        if (assessment.colonoscopy) {
          const colonoscopyResult = await this.saveColonoscopy(
            assessment.colonoscopy,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (colonoscopyResult.success) {
            results.savedEntities.push('colonoscopy');
          } else {
            results.errors.push(colonoscopyResult.error);
          }
        }

        // Save anorectal manometry
        if (assessment.anorectalManometry) {
          const manometryResult = await this.saveAnorectalManometry(
            assessment.anorectalManometry,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (manometryResult.success) {
            results.savedEntities.push('anorectal_manometry');
          } else {
            results.errors.push(manometryResult.error);
          }
        }

        // Save defecography
        if (assessment.defecography) {
          const defecographyResult = await this.saveDefecography(
            assessment.defecography,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (defecographyResult.success) {
            results.savedEntities.push('defecography');
          } else {
            results.errors.push(defecographyResult.error);
          }
        }

        // Save stoma assessment
        if (assessment.stomaAssessment) {
          const stomaResult = await this.saveStomaAssessment(
            assessment.stomaAssessment,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (stomaResult.success) {
            results.savedEntities.push('stoma_assessment');
          } else {
            results.errors.push(stomaResult.error);
          }
        }

        // Save oncologic markers
        if (assessment.oncologicMarkers) {
          const markersResult = await this.saveOncologicMarkers(
            assessment.oncologicMarkers,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (markersResult.success) {
            results.savedEntities.push('oncologic_markers');
          } else {
            results.errors.push(markersResult.error);
          }
        }
      }

      // Save general colorectal surgery consultation
      const consultationResult = await this.saveColorectalSurgeryConsultation(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (consultationResult.success) {
        results.savedEntities.push('colorectal_surgery_consultation');
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

  async saveColonoscopy(colonoscopy, patientId, documentId, extractedData, context) {
    try {
      const colonoscopyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        procedureDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        polyps: colonoscopy.polyps || [],
        lesions: colonoscopy.lesions || [],
        preparation: colonoscopy.preparation || '',
        completeness: colonoscopy.completeness || '',
        cecalIntubation: colonoscopy.cecalIntubation || false,
        withdrawalTime: colonoscopy.withdrawalTime || '',
        findings: colonoscopy.findings || '',
        biopsies: colonoscopy.biopsies || [],
        recommendations: colonoscopy.recommendations || '',
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('colorectal_colonoscopies', colonoscopyData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving colonoscopy:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveAnorectalManometry(manometry, patientId, documentId, extractedData, context) {
    try {
      const manometryData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        restingPressure: manometry.restingPressure || '',
        squeezePressure: manometry.squeezePressure || '',
        sensoryThreshold: manometry.sensoryThreshold || '',
        compliance: manometry.compliance || '',
        reflexes: manometry.reflexes || {},
        sphincterFunction: manometry.sphincterFunction || '',
        interpretation: manometry.interpretation || '',
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('anorectal_manometry', manometryData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving anorectal manometry:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveDefecography(defecography, patientId, documentId, extractedData, context) {
    try {
      const defecographyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        studyDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        pelvicFloorDescent: defecography.pelvicFloorDescent || '',
        rectocele: defecography.rectocele || '',
        intussusception: defecography.intussusception || '',
        evacuation: defecography.evacuation || '',
        enterocele: defecography.enterocele || '',
        puborectalis: defecography.puborectalis || '',
        findings: defecography.findings || '',
        interpretation: defecography.interpretation || '',
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('defecography_studies', defecographyData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving defecography:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveStomaAssessment(stoma, patientId, documentId, extractedData, context) {
    try {
      const stomaData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        assessmentDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        type: stoma.type || '',
        site: stoma.site || '',
        viability: stoma.viability || '',
        complications: stoma.complications || [],
        output: stoma.output || '',
        peristomalSkin: stoma.peristomalSkin || '',
        applianceFit: stoma.applianceFit || '',
        patientEducation: stoma.patientEducation || '',
        assessedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('stoma_assessments', stomaData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving stoma assessment:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveOncologicMarkers(markers, patientId, documentId, extractedData, context) {
    try {
      const markersData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        cea: markers.cea || '',
        ca199: markers.ca199 || '',
        microsatelliteStatus: markers.microsatelliteStatus || '',
        kras: markers.kras || '',
        braf: markers.braf || '',
        lynch: markers.lynch || '',
        interpretation: markers.interpretation || '',
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('colorectal_oncologic_markers', markersData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving oncologic markers:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveColorectalSurgeryConsultation(extractedData, patientId, documentId, sessionId, context) {
    try {
      const consultationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        diagnosis: extractedData.diagnosis || [],
        stagingTNM: extractedData.stagingTNM || '',
        proposedProcedure: extractedData.proposedProcedure || '',
        surgicalApproach: extractedData.surgicalApproach || '',
        neoadjuvantTherapy: extractedData.neoadjuvantTherapy || '',
        stomaRequired: extractedData.stomaRequired || false,
        risks: extractedData.risks || [],
        prognosis: extractedData.prognosis || '',
        followUp: extractedData.followUp || '',
        surgeonName: extractedData.providerName || '',
        providerSpecialty: 'Colorectal Surgery',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('colorectal_surgery_consultations', consultationData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving colorectal surgery consultation:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ColorectalSurgeryFieldMappingService();