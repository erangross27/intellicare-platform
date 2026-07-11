const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class AllergyImmunologyFieldMappingService {
  constructor() {
    this.serviceName = 'AllergyImmunologyFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[AllergyImmunologyFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_ALLERGYIMMUNOLOGYFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for AllergyImmunologyFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[AllergyImmunologyFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[AllergyImmunologyFieldMapper] Initialization failed:', error);
      throw error;
    }
  }

  async mapAndSaveExtractedData(extractedData, patientId, documentId, sessionId) {
    // Ensure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const context = {
      serviceId: this.serviceName,
      apiKey: this.serviceToken,
      operation: 'mapAndSaveExtractedData',
      practiceId: global.practiceId || 'global'
    };

    const results = {
      success: true,
      savedEntities: [],
      errors: []
    };

    try {
      // Map allergy & immunology-specific data
      if (extractedData.allergyImmunologyAssessment) {
        const assessment = extractedData.allergyImmunologyAssessment;

        // Save skin testing
        if (assessment.skinTesting) {
          const skinResult = await this.saveSkinTesting(
            assessment.skinTesting,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (skinResult.success) {
            results.savedEntities.push('skin_testing');
          } else {
            results.errors.push(skinResult.error);
          }
        }

        // Save specific IgE
        if (assessment.specificIge) {
          const igeResult = await this.saveSpecificIgE(
            assessment.specificIge,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (igeResult.success) {
            results.savedEntities.push('specific_ige');
          } else {
            results.errors.push(igeResult.error);
          }
        }

        // Save component testing
        if (assessment.componentTesting) {
          const componentResult = await this.saveComponentTesting(
            assessment.componentTesting,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (componentResult.success) {
            results.savedEntities.push('component_testing');
          } else {
            results.errors.push(componentResult.error);
          }
        }

        // Save immune function
        if (assessment.immuneFunction) {
          const immuneResult = await this.saveImmuneFunction(
            assessment.immuneFunction,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (immuneResult.success) {
            results.savedEntities.push('immune_function');
          } else {
            results.errors.push(immuneResult.error);
          }
        }

        // Save challenge tests
        if (assessment.challengeTests) {
          const challengeResult = await this.saveChallengeTests(
            assessment.challengeTests,
            patientId,
            documentId,
            extractedData,
            context
          );
          if (challengeResult.success) {
            results.savedEntities.push('challenge_tests');
          } else {
            results.errors.push(challengeResult.error);
          }
        }

        // Save consolidated allergy assessment (for allergy_assessments collection)
        const consolidatedResult = await this.saveConsolidatedAllergyAssessment(
          assessment,
          patientId,
          documentId,
          extractedData,
          context
        );
        if (consolidatedResult.success) {
          results.savedEntities.push('allergy_assessments');
        } else {
          results.errors.push(consolidatedResult.error);
        }
      }

      // Save general allergy & immunology consultation
      const consultationResult = await this.saveAllergyImmunologyConsultation(
        extractedData,
        patientId,
        documentId,
        sessionId,
        context
      );
      if (consultationResult.success) {
        results.savedEntities.push('allergy_immunology_consultation');
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

  async saveSkinTesting(skinTesting, patientId, documentId, extractedData, context) {
    try {
      const skinData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        prickTest: skinTesting.prickTest || [],
        intradermal: skinTesting.intradermal || [],
        patch: skinTesting.patch || [],
        controls: skinTesting.controls || {},
        positiveResults: skinTesting.positiveResults || [],
        negativeResults: skinTesting.negativeResults || [],
        interpretation: skinTesting.interpretation || '',
        medications: skinTesting.medications || [],
        performedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('allergy_skin_testing', skinData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving skin testing:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveSpecificIgE(specificIge, patientId, documentId, extractedData, context) {
    try {
      const igeData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        totalIgE: specificIge.totalIgE || '',
        foods: specificIge.foods || {},
        inhalants: specificIge.inhalants || {},
        venoms: specificIge.venoms || {},
        drugs: specificIge.drugs || {},
        occupational: specificIge.occupational || {},
        classLevels: specificIge.classLevels || {},
        interpretation: specificIge.interpretation || '',
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('specific_ige_tests', igeData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving specific IgE:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveComponentTesting(componentTesting, patientId, documentId, extractedData, context) {
    try {
      const componentData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        allergens: componentTesting.allergens || [],
        crossReactivity: componentTesting.crossReactivity || {},
        majorAllergens: componentTesting.majorAllergens || [],
        minorAllergens: componentTesting.minorAllergens || [],
        panallergens: componentTesting.panallergens || [],
        interpretation: componentTesting.interpretation || '',
        clinicalRelevance: componentTesting.clinicalRelevance || '',
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('component_allergen_testing', componentData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving component testing:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveImmuneFunction(immuneFunction, patientId, documentId, extractedData, context) {
    try {
      const immuneData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        immunoglobulins: immuneFunction.immunoglobulins || {},
        lymphocyteSubsets: immuneFunction.lymphocyteSubsets || {},
        complement: immuneFunction.complement || {},
        vaccination: immuneFunction.vaccination || {},
        antibodyResponse: immuneFunction.antibodyResponse || {},
        phagocyticFunction: immuneFunction.phagocyticFunction || {},
        cytokines: immuneFunction.cytokines || {},
        interpretation: immuneFunction.interpretation || '',
        orderedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('immune_function_tests', immuneData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving immune function:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveChallengeTests(challengeTests, patientId, documentId, extractedData, context) {
    try {
      const challengeData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        testDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        food: challengeTests.food || {},
        drug: challengeTests.drug || {},
        aspirin: challengeTests.aspirin || {},
        exercise: challengeTests.exercise || {},
        protocol: challengeTests.protocol || '',
        reactions: challengeTests.reactions || [],
        outcome: challengeTests.outcome || '',
        threshold: challengeTests.threshold || '',
        supervisedBy: extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('challenge_tests', challengeData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving challenge tests:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveConsolidatedAllergyAssessment(assessment, patientId, documentId, extractedData, context) {
    try {
      // Transform allergyImmunologyAssessment data into allergy_assessments format
      // This creates a consolidated record combining data from multiple sources

      // Extract totalIge and eosinophilCount from labResults if available
      let totalIge = '';
      let eosinophilCount = '';
      if (extractedData.labResults && Array.isArray(extractedData.labResults)) {
        const igeTest = extractedData.labResults.find(lab =>
          lab.testName && lab.testName.toLowerCase().includes('total ige')
        );
        if (igeTest) {
          totalIge = `${igeTest.value || ''} ${igeTest.unit || ''}`.trim();
        }

        const eoTest = extractedData.labResults.find(lab =>
          lab.testName && lab.testName.toLowerCase().includes('eosinophil')
        );
        if (eoTest) {
          eosinophilCount = `${eoTest.value || ''} ${eoTest.unit || ''}`.trim();
        }
      }

      // Build environmentalAllergens array from specificIge.inhalants
      const environmentalAllergens = [];
      if (assessment.specificIge && assessment.specificIge.inhalants) {
        Object.entries(assessment.specificIge.inhalants).forEach(([allergen, igeLevel]) => {
          // Determine severity based on IgE level (Class system)
          let severity = 'moderate';
          const levelMatch = igeLevel.match(/(\d+(\.\d+)?)/);
          if (levelMatch) {
            const numericLevel = parseFloat(levelMatch[1]);
            if (numericLevel > 50) severity = 'severe';
            else if (numericLevel > 17.5) severity = 'moderate';
            else if (numericLevel < 3.5) severity = 'mild';
          }

          environmentalAllergens.push({
            allergen: allergen,
            igeLevel: igeLevel,
            severity: severity
          });
        });
      }

      // Build skinTestResults array from skinTesting.prickTest
      const skinTestResults = [];
      if (assessment.skinTesting && assessment.skinTesting.prickTest) {
        assessment.skinTesting.prickTest.forEach(test => {
          if (typeof test === 'object' && test.allergen) {
            skinTestResults.push({
              allergen: test.allergen,
              result: test.result || '',
              diameter: test.diameter || ''
            });
          }
        });
      }

      const allergyAssessmentData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        date: extractedData.date ? new Date(extractedData.date) : new Date(),
        provider: extractedData.providers?.primary || extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        totalIge: totalIge,
        eosinophilCount: eosinophilCount,
        environmentalAllergens: environmentalAllergens,
        skinTestResults: skinTestResults,
        specificIgE: assessment.specificIge || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('allergy_assessments', allergyAssessmentData, context);
      console.log(`[${this.serviceName}] Saved consolidated allergy assessment with ${environmentalAllergens.length} environmental allergens and ${skinTestResults.length} skin test results`);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving consolidated allergy assessment:`, error);
      return { success: false, error: error.message };
    }
  }

  async saveAllergyImmunologyConsultation(extractedData, patientId, documentId, sessionId, context) {
    try {
      const consultationData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        sessionId: sessionId,
        consultationDate: extractedData.date ? new Date(extractedData.date) : new Date(),
        chiefComplaint: extractedData.chiefComplaint || '',
        allergyHistory: extractedData.allergyHistory || [],
        triggers: extractedData.triggers || [],
        reactions: extractedData.reactions || [],
        anaphylaxisHistory: extractedData.anaphylaxisHistory || [],
        diagnosis: extractedData.diagnosis || [],
        treatmentPlan: extractedData.treatmentPlan || '',
        medications: extractedData.medications || [],
        immunotherapy: extractedData.immunotherapy || {},
        avoidanceMeasures: extractedData.avoidanceMeasures || [],
        actionPlan: extractedData.actionPlan || '',
        followUp: extractedData.followUp || '',
        allergistName: extractedData.providerName || '',
        providerSpecialty: 'Allergy & Immunology',
        facilityName: extractedData.facilityName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('allergy_immunology_consultations', consultationData, context);
      return { success: true };
    } catch (error) {
      console.error(`[${this.serviceName}] Error saving allergy & immunology consultation:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AllergyImmunologyFieldMappingService();