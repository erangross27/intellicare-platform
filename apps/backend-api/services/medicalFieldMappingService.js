/**
 * Medical Field Mapping Service
 *
 * Maps comprehensive extracted fields to appropriate MongoDB collections
 * Handles 267 document types with intelligent field transformation
 *
 * COMPLETE IMPLEMENTATION: Supports ALL medical collections
 */

const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');
const drugInformationService = require('./drugInformationService');

// Original 10 specialties
const ibdFieldMappingService = require('./ibdFieldMappingService');
const geriatricFieldMappingService = require('./geriatricFieldMappingService');
const nephrologyFieldMappingService = require('./nephrologyFieldMappingService');
const neurologyFieldMappingService = require('./neurologyFieldMappingService');
const obstetricFieldMappingService = require('./obstetricFieldMappingService');
const oncologyFieldMappingService = require('./oncologyFieldMappingService');
const surgicalFieldMappingService = require('./surgicalFieldMappingService');
const orthopedicFieldMappingService = require('./orthopedicFieldMappingService');
const pediatricFieldMappingService = require('./pediatricFieldMappingService');
const psychiatricFieldMappingService = require('./psychiatricFieldMappingService');
const pulmonaryFieldMappingService = require('./pulmonaryFieldMappingService');
const rheumatologyFieldMappingService = require('./rheumatologyFieldMappingService');

// Additional 10 specialties (first batch)
const cardiologyFieldMappingService = require('./cardiologyFieldMappingService');
const endocrinologyFieldMappingService = require('./endocrinologyFieldMappingService');
const emergencyMedicineFieldMappingService = require('./emergencyMedicineFieldMappingService');
const dermatologyFieldMappingService = require('./dermatologyFieldMappingService');
const anesthesiologyFieldMappingService = require('./anesthesiologyFieldMappingService');
const radiologyFieldMappingService = require('./radiologyFieldMappingService');
const pathologyFieldMappingService = require('./pathologyFieldMappingService');
const ophthalmologyFieldMappingService = require('./ophthalmologyFieldMappingService');
const entFieldMappingService = require('./entFieldMappingService');
const infectiousDiseaseFieldMappingService = require('./infectiousDiseaseFieldMappingService');

// New 12 specialties (2025)
const urologyFieldMappingService = require('./urologyFieldMappingService');
const familyMedicineFieldMappingService = require('./familyMedicineFieldMappingService');
const pmrFieldMappingService = require('./pmrFieldMappingService');
const nuclearMedicineFieldMappingService = require('./nuclearMedicineFieldMappingService');
const plasticSurgeryFieldMappingService = require('./plasticSurgeryFieldMappingService');
const thoracicSurgeryFieldMappingService = require('./thoracicSurgeryFieldMappingService');
const colorectalSurgeryFieldMappingService = require('./colorectalSurgeryFieldMappingService');
const neurosurgeryFieldMappingService = require('./neurosurgeryFieldMappingService');
const preventiveMedicineFieldMappingService = require('./preventiveMedicineFieldMappingService');
const medicalGeneticsFieldMappingService = require('./medicalGeneticsFieldMappingService');
const allergyImmunologyFieldMappingService = require('./allergyImmunologyFieldMappingService');
const hematologyFieldMappingService = require('./hematologyFieldMappingService');

const categoryCollectionMapper = require('./categoryCollectionMapper');
const collectionSchemas = require('./collectionSchemas');

class MedicalFieldMappingService {
  constructor() {
    this.serviceName = 'MedicalFieldMapper';
    this.serviceToken = null;
    this.initialized = false;
    console.log('[MedicalFieldMapper] Service initialized');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const productionKMS = require('./productionKMS');
      await productionKMS.initialize();
      this.serviceToken = await productionKMS.getInternalKey('SERVICE_MEDICALFIELDMAPPER_KEY');

      if (!this.serviceToken) {
        throw new Error('Could not get API key for MedicalFieldMapper from KMS');
      }

      this.initialized = true;
      console.log('[MedicalFieldMapper] Service initialized with API key');
    } catch (error) {
      console.error('[MedicalFieldMapper] Initialization failed:', error);
      throw error;
    }
  }




  /**
   * Process and save comprehensive extracted data to appropriate collections
   * NOW HANDLES ALL 267 COLLECTIONS WITH DYNAMIC ROUTING
   */
  async saveComprehensiveData(extractedData, documentId, patientId, context) {
    if (!extractedData) {
      console.warn('Missing required data for saving: extractedData is required');
      return { success: false, message: 'Missing required data' };
    }

    // patientId can be null - will be created from extracted data if needed

    const savedCollections = [];
    const errors = [];

    try {
      // ===== DUAL-PATH ARCHITECTURE =====
      // Path 1: Unified document gets COMPLETE nested structure (for doctor viewing)
      // Path 2: Granular collections get FLAT structure (for fast specific queries)

      // Detect if data is nested in documentData (from existing unified doc) or flat (from Claude API)
      const isNested = extractedData.documentData && typeof extractedData.documentData === 'object';
      console.log(`🔍 [DUAL-PATH] Data structure detected: ${isNested ? 'NESTED (documentData wrapper)' : 'FLAT (direct from API)'}`);

      // For granular collections, always work with flat structure
      const flatData = isNested ? extractedData.documentData : extractedData;

      // For unified document, keep original structure (whether nested or flat - saveUnifiedDocument handles both)
      const unifiedData = extractedData;

      // ===== STEP 0: SAVE COMPLETE UNIFIED DOCUMENT FIRST (NEW - Two-Path Architecture) =====
      console.log(`[UnifiedDoc] Saving complete unified document for category: ${unifiedData.category || flatData.category}`);
      const unifiedResult = await this.saveUnifiedDocument(unifiedData, patientId, documentId, context);
      if (unifiedResult.success) {
        savedCollections.push('unified_medical_documents');
        console.log(`[UnifiedDoc] Complete document saved successfully`);
      } else {
        errors.push(`unified_medical_documents: ${unifiedResult.error}`);
        console.error(`[UnifiedDoc] Failed to save unified document: ${unifiedResult.error}`);
      }

      // ===== STEP 1: EXTRACT TO SPECIALIZED COLLECTIONS =====
      // This implements the HYBRID approach: extract cross-cutting data to individual collections
      // Use FLAT data structure for all handlers below

      console.log(`🔄 [HYBRID] Starting data extraction for category: ${flatData.category}`);
      console.log(`🔄 [HYBRID] Will extract universal fields to specialized collections first`);
      console.log(`🔍 [DEBUG] Flat data has medications: ${!!flatData.medications}, diagnoses: ${!!flatData.diagnoses}`);

      // ===== SPECIALIZED EXTRACTION HANDLERS =====
      // Extract cross-cutting medical data to individual collections
      // These fields will be REMOVED from the primary document via universalFieldsToExclude

      // 1. Save core patient identification (update if exists)
      if (flatData.patientName || flatData.dateOfBirth) {
        await this.updatePatientCore(patientId, flatData, context);
      }

      // 2. Process diagnoses
      if (flatData.diagnoses && flatData.diagnoses.length > 0) {
        const result = await this.saveDiagnoses(flatData.diagnoses, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('diagnoses');
        else errors.push(result.error);
      }

      // 3. Process medications (including discharge medications)
      const allMeds = [
        ...(flatData.medications || []),
        ...(flatData.dischargeMedications || [])
      ];
      if (allMeds.length > 0) {
        const result = await this.saveMedications(allMeds, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('medications');
        else errors.push(result.error);
      }

      // 4. Process vital signs
      if (flatData.vitalSigns || flatData.vitalSignsTable) {
        const result = await this.saveVitalSigns(flatData, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('vital_signs');
        else errors.push(result.error);
      }

      // 5. Process lab results
      // CRITICAL: Check both lab_results (batch extraction) and labResults (legacy)
      const labResultsData = flatData.lab_results || flatData.labResults;
      if (labResultsData && labResultsData.length > 0) {
        // Batch extraction returns nested structure: [{ testType, results: [...], labDate }]
        // Extract the actual test results array from the nested structure
        let testResults = [];
        let metadata = {};

        // CRITICAL FIX (November 26, 2025): Distinguish between:
        // 1. MULTI-TOOL FORMAT: labResultsData is array of lab result objects, each with optional "results" STRING array for summaries
        //    Example: [{testName: "Hemoglobin", value: "13.2", results: ["Hgb 13.2 g/dL"]}]
        //    → Use labResultsData directly as testResults
        // 2. NESTED FORMAT: labResultsData[0].results contains OBJECTS (actual lab result documents)
        //    Example: [{testType: "CBC", results: [{testName: "Hemoglobin", value: "13.2"}]}]
        //    → Extract labResultsData[0].results as testResults

        const hasNestedResults = labResultsData[0]?.results && Array.isArray(labResultsData[0].results);
        const nestedResultsAreObjects = hasNestedResults &&
          labResultsData[0].results.length > 0 &&
          typeof labResultsData[0].results[0] === 'object';

        if (hasNestedResults && nestedResultsAreObjects) {
          // TRUE NESTED FORMAT: results array contains lab result OBJECTS
          const labDoc = labResultsData[0];
          testResults = labDoc.results;
          // CRITICAL: Only copy metadata fields, NOT the results array
          // Spreading ...labDoc would copy the results array into each individual test document
          metadata = {
            testType: labDoc.testType || flatData.testType,
            labDate: labDoc.labDate || labDoc.date,
            collectionDate: labDoc.collectionDate,
            orderedBy: labDoc.orderedBy
          };
        } else {
          // MULTI-TOOL FORMAT or OLD FORMAT: labResultsData itself is the array of lab results
          // Each item has testName, value, etc. at top level
          // "results" field if present contains STRING summaries, not objects
          testResults = labResultsData;
          metadata = { testType: flatData.testType };
        }

        // Use unified schema dynamic save instead of hardcoded function
        const result = await this.saveToCollectionDynamic('lab_results', testResults, patientId, documentId, { ...flatData, ...metadata }, context);
        if (result.success) savedCollections.push('lab_results');
        else errors.push(result.error);
      }

      // 6. Process imaging
      if (flatData.imaging && flatData.imaging.length > 0) {
        const result = await this.saveImaging(flatData.imaging, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('imaging_reports');
        else errors.push(result.error);
      }

      // 7. Process procedures/surgeries
      if (flatData.procedures && flatData.procedures.length > 0) {
        const result = await this.saveProcedures(flatData.procedures, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('medical_procedures');
        else errors.push(result.error);
      }

      // 8. Process allergies
      if (flatData.allergies && flatData.allergies.length > 0) {
        const result = await this.saveAllergies(flatData.allergies, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('allergies');
        else errors.push(result.error);
      }

      // 9. Process vaccinations
      if (flatData.vaccinations && flatData.vaccinations.length > 0) {
        const result = await this.saveVaccinations(flatData.vaccinations, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('vaccination_records');
        else errors.push(result.error);
      }

      // 10. Process consultation/clinical notes
      if (flatData.chiefComplaint || flatData.historyOfPresentIllness || flatData.physicalExamination) {
        const result = await this.saveConsultationNote(flatData, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('consultation_notes');
        else errors.push(result.error);
      }

      // 11. Process discharge summary
      if (flatData.hospitalCourse || flatData.dischargeDate) {
        const result = await this.saveDischargeSummary(flatData, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('discharge_summaries');
        else errors.push(result.error);
      }

      // 12. Process specialty-specific data
      await this.saveSpecialtyData(flatData, patientId, documentId, context, savedCollections, errors);

      // 13. Process follow-up appointments (saves to follow_up_appointments collection)
      if (flatData.followUpAppointments && flatData.followUpAppointments.length > 0) {
        const result = await this.saveFollowUpAppointments(flatData.followUpAppointments, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('follow_up_appointments');
        else errors.push(result.error);
      }

      // 14. Process medical history
      if (flatData.medicalHistory) {
        const result = await this.saveMedicalHistory(flatData.medicalHistory, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('medical_history');
        else errors.push(result.error);
      }

      // 15. Process risk factors
      if (flatData.riskFactors && flatData.riskFactors.length > 0) {
        const result = await this.saveRiskFactors(flatData.riskFactors, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('risk_factors');
        else errors.push(result.error);
      }

      // 16. Process clinical scores
      if (flatData.clinicalScores) {
        const result = await this.saveClinicalScores(flatData.clinicalScores, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('clinical_scores');
        else errors.push(result.error);
      }

      // 17. Process pathology findings
      if (flatData.pathologyFindings) {
        const result = await this.savePathology(flatData.pathologyFindings, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('pathology_reports');
        else errors.push(result.error);
      }

      // 18. Process implants/devices
      if (flatData.implants && flatData.implants.length > 0) {
        const result = await this.saveImplants(flatData.implants, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('medical_devices');
        else errors.push(result.error);
      }

      // 19. Process flexible/additional data
      if (flatData.additionalData || flatData.flexibleData) {
        const result = await this.saveFlexibleData(
          flatData.additionalData || flatData.flexibleData,
          patientId,
          documentId,
          flatData.category,
          context
        );
        if (result.success) savedCollections.push('additional_data');
        else errors.push(result.error);
      }

      // 20. Process vital signs table (multiple readings)
      if (flatData.vitalSignsTable && flatData.vitalSignsTable.length > 0) {
        const result = await this.saveVitalSignsTable(flatData.vitalSignsTable, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('vital_signs_logs');
        else errors.push(result.error);
      }

      // 21. Process treatment course
      if (flatData.treatmentCourse) {
        const result = await this.saveTreatmentCourse(flatData.treatmentCourse, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('treatment_courses');
        else errors.push(result.error);
      }

      // 22. Process patient education
      if (flatData.patientEducation && flatData.patientEducation.length > 0) {
        const result = await this.savePatientEducation(flatData.patientEducation, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('patient_education_records');
        else errors.push(result.error);
      }

      // 23. Process administrative data
      if (flatData.administrativeData) {
        const result = await this.saveAdministrativeData(flatData.administrativeData, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('administrative_data');
        else errors.push(result.error);
      }

      // 24. Process recommendations - DEPRECATED: Now handled by specific collections
      // - Medication recommendations: flatData.doctorsMedicationsRecommendations
      // - Referrals: flatData.referrals
      // - Follow-ups: flatData.followUpAppointments
      // Generic flatData.recommendations is no longer saved to avoid mixed data
      if (flatData.recommendations) {
        console.warn('[DEPRECATED] flatData.recommendations field detected but skipped - use specific recommendation types instead');
      }

      // 26. Process consultation details
      if (flatData.consultationDetails) {
        const result = await this.saveConsultationDetails(flatData.consultationDetails, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('consultation_notes');
        else errors.push(result.error);
      }

      // 27. Process psychosocial assessment
      if (flatData.psychosocialAssessment) {
        const result = await this.savePsychosocialAssessment(flatData.psychosocialAssessment, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('psychosocial_assessments');
        else errors.push(result.error);
      }

      // 28. Process family meeting notes
      if (flatData.familyMeetingNotes) {
        const result = await this.saveFamilyMeetingNotes(flatData.familyMeetingNotes, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('family_meeting_notes');
        else errors.push(result.error);
      }

      // 29. Process prognosis
      if (flatData.prognosis) {
        const result = await this.savePrognosis(flatData.prognosis, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('prognosis');
        else errors.push(result.error);
      }

      // 30. Process home monitoring data
      if (flatData.homeMonitoring) {
        const result = await this.saveHomeMonitoring(flatData.homeMonitoring, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('home_monitoring');
        else errors.push(result.error);
      }

      // 31. Process medication reconciliation
      if (flatData.medicationReconciliation) {
        const result = await this.saveMedicationReconciliation(flatData.medicationReconciliation, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('medication_reconciliation');
        else errors.push(result.error);
      }

      // 32. Process trend analysis
      if (flatData.trendAnalysis || flatData.trendingAnalysis) {
        const result = await this.saveTrendingAnalysis(flatData.trendAnalysis || flatData.trendingAnalysis, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('trending_analysis');
        else errors.push(result.error);
      }

      // 33. Process emergency information
      if (flatData.emergencyInformation) {
        const result = await this.saveEmergencyInformation(flatData.emergencyInformation, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('emergency_information');
        else errors.push(result.error);
      }

      // ===== AI-GENERATED INTELLIGENCE FIELDS (UNIVERSAL - SAVED FOR ALL CATEGORIES) =====

      // 34. Process clinical decision support
      if (flatData.clinicalDecisionSupport) {
        const result = await this.saveClinicalDecisionSupport(flatData.clinicalDecisionSupport, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('clinical_decision_support');
        else errors.push(result.error);
      }

      // 35. Process intelligent recommendations
      if (flatData.intelligentRecommendations) {
        const result = await this.saveIntelligentRecommendations(flatData.intelligentRecommendations, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('intelligent_recommendations');
        else errors.push(result.error);
      }

      // 36. Process patient-specific care plan
      if (flatData.patientSpecificCarePlan) {
        const result = await this.savePatientSpecificCarePlan(flatData.patientSpecificCarePlan, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('patient_specific_care_plan');
        else errors.push(result.error);
      }

      // 37. Process follow-up intelligence
      if (flatData.followUpIntelligence) {
        const result = await this.saveFollowUpIntelligence(flatData.followUpIntelligence, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('follow_up_intelligence');
        else errors.push(result.error);
      }

      // 38. Process medications optimizations
      if (flatData.medicationsOptimizations || flatData.medicationOptimizations) {
        const result = await this.saveMedicationsOptimizations(flatData.medicationsOptimizations || flatData.medicationOptimizations, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('medication_optimization');
        else errors.push(result.error);
      }

      // 39. Process patient education context
      if (flatData.patientEducationContext) {
        const result = await this.savePatientEducationContext(flatData.patientEducationContext, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('patient_education_context');
        else errors.push(result.error);
      }

      // 40. Process guideline compliance
      if (flatData.guidelineCompliance) {
        const result = await this.saveGuidelineCompliance(flatData.guidelineCompliance, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('guideline_compliance');
        else errors.push(result.error);
      }

      // 41. Process outcomes prediction
      if (flatData.outcomesPrediction) {
        const result = await this.saveOutcomesPrediction(flatData.outcomesPrediction, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('outcomes_prediction');
        else errors.push(result.error);
      }

      // 42. Process care gaps
      if (flatData.careGaps) {
        const result = await this.saveCareGaps(flatData.careGaps, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('care_gaps');
        else errors.push(result.error);
      }

      // 42.5. Process comprehensive GI risk assessment
      if (flatData.giRiskAssessment) {
        const result = await this.saveGIRiskAssessment(flatData.giRiskAssessment, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('gi_risk_assessment');
        else errors.push(result.error);
      }

      // 43. Process doctors medication recommendations (NEW - was being dumped into additionalData)
      if (flatData.doctorsMedicationsRecommendations && flatData.doctorsMedicationsRecommendations.length > 0) {
        const result = await this.saveDoctorsMedicationsRecommendations(flatData.doctorsMedicationsRecommendations, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('doctors_medication_recommendations');
        else errors.push(result.error);
      }

      // 44. Process doctors medication recommendations optimizations
      if (flatData.doctorsMedicationsRecommendationsOptimizations) {
        const result = await this.saveDoctorsMedicationsRecommendationsOptimizations(flatData.doctorsMedicationsRecommendationsOptimizations, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('medication_optimization');
        else errors.push(result.error);
      }

      // 45. Process treatment plan
      if (flatData.treatmentPlan) {
        const result = await this.saveTreatmentPlan(flatData.treatmentPlan, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('treatment_plans');
        else errors.push(result.error);
      }

      // 46. Process monitoring plan
      if (flatData.monitoringPlan) {
        const result = await this.saveMonitoringPlan(flatData.monitoringPlan, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('monitoring_plans');
        else errors.push(result.error);
      }

      // 47. Process referrals
      if (flatData.referrals && flatData.referrals.length > 0) {
        const result = await this.saveReferrals(flatData.referrals, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('referrals');
        else errors.push(result.error);
      }

      // 48. Process pulmonary function tests
      if (flatData.pulmonaryFunctionTests) {
        const result = await this.savePulmonaryFunctionTests(flatData.pulmonaryFunctionTests, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('pulmonary_function_tests');
        else errors.push(result.error);
      }

      // 49. Process asthma assessment
      if (flatData.asthmaAssessment) {
        const result = await this.saveAsthmaAssessment(flatData.asthmaAssessment, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('asthma_assessments');
        else errors.push(result.error);
      }

      // 50. Process allergy assessment
      if (flatData.allergyAssessment) {
        const result = await this.saveAllergyAssessment(flatData.allergyAssessment, patientId, documentId, flatData, context);
        if (result.success) savedCollections.push('allergy_assessments');
        else errors.push(result.error);
      }

      // GENERIC HANDLER: Save any remaining collections using dynamic schema-based approach
      // This enables ALL 757 collections to work with complete field mapping from unified schema
      const processedKeys = new Set(savedCollections.map(c => c.replace(/_/g, '')));
      for (const [key, value] of Object.entries(flatData)) {
        // Skip if already processed by specific handler
        const normalizedKey = key.replace(/_/g, '').toLowerCase();
        if (processedKeys.has(normalizedKey)) continue;

        // Skip non-collection fields
        if (['documentId', 'patientId', 'category', 'providerSpecialty', 'documentSpecialty', 'documentDate'].includes(key)) continue;

        // Convert camelCase back to snake_case for collection name
        const collectionName = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

        // Operational/scheduling collections (e.g. appointments) are owned by their own service and
        // require a generated key (appointmentNumber via queueManagementService). Document extraction
        // must NOT insert them — a null appointmentNumber violates the unique index (E11000). Clinical
        // follow-ups are captured by follow_up_appointments instead. (The unified schema also marks
        // appointments non-extractable so it is never selected/extracted; this is defense-in-depth.)
        if (collectionName === 'appointments') {
          console.warn(`⏭️ [DYNAMIC] Skipping operational collection 'appointments' — not a document-extraction target (use follow_up_appointments)`);
          continue;
        }

        // Save array data to collection using dynamic schema-based function
        if (Array.isArray(value) && value.length > 0) {
          try {
            console.log(`📦 [DYNAMIC] Processing ${value.length} items for collection: ${collectionName}`);
            const result = await this.saveToCollectionDynamic(collectionName, value, patientId, documentId, flatData, context);

            if (result.success) {
              savedCollections.push(collectionName);
              console.log(`✅ [DYNAMIC] Saved ${value.length} records to ${collectionName} with full schema mapping`);
            } else {
              console.error(`❌ [DYNAMIC] Failed to save ${collectionName}:`, result.error);
              errors.push(`${collectionName}: ${result.error}`);
            }
          } catch (error) {
            console.error(`❌ [DYNAMIC] Failed to save ${collectionName}:`, error.message);
            errors.push(`${collectionName}: ${error.message}`);
          }
        }
      }

      console.log(`✅ [HYBRID] Extracted data to ${savedCollections.length} specialized collections`);

      // ===== STEP 2: REMOVED - No longer saving to category collections =====
      // Category collections (cardiology_admission_notes, etc.) have been DEPRECATED
      // Replaced by unified_medical_documents collection (saved in STEP 0)
      // This eliminates the risk of hitting 16MB document limits

      // Remove duplicates from savedCollections
      const uniqueCollections = [...new Set(savedCollections)];

      console.log(`✅ Saved data to ${uniqueCollections.length} collections: ${uniqueCollections.join(', ')}`);
      if (errors.length > 0) {
        console.warn(`⚠️ Encountered ${errors.length} errors during save:`, errors);
      }

      // CRITICAL: Update patient's medicalData.collections index for quick category lookup
      // This index is used by listPatientMedicalCategories to display available data
      if (uniqueCollections.length > 0) {
        try {
          const SecureDataAccess = require('./secureDataAccess');
          const { ObjectId } = require('mongodb');
          const patientIdObj = typeof patientId === 'string' ? new ObjectId(patientId) : patientId;

          // Build update object to add documentId to each collection's array
          const updateObject = {};
          for (const collectionName of uniqueCollections) {
            updateObject[`medicalData.collections.${collectionName}`] = documentId;
          }

          await SecureDataAccess.update(
            'patients',
            { _id: patientIdObj },
            {
              $addToSet: updateObject // Add documentId to each collection array (no duplicates)
            },
            context
          );

          console.log(`📊 Updated patient medicalData index for ${uniqueCollections.length} collections`);
        } catch (indexError) {
          console.error('⚠️ Failed to update patient medicalData index:', indexError.message);
          // Don't fail the whole operation if index update fails
        }
      }

      return {
        success: true,
        savedCollections,
        errors,
        message: `Data saved to ${savedCollections.length} collections`
      };

    } catch (error) {
      console.error('Error in saveComprehensiveData:', error);
      return {
        success: false,
        error: error.message,
        savedCollections,
        errors
      };
    }
  }

  // Individual save methods for each data type

  async updatePatientCore(patientId, data, context) {
    try {
      const updates = {};
      if (data.dateOfBirth) updates.dateOfBirth = new Date(data.dateOfBirth);
      if (data.gender) updates.gender = data.gender;
      if (data.age) updates.age = data.age;

      if (Object.keys(updates).length > 0) {
        await SecureDataAccess.update(
          'patients',
          { _id: new ObjectId(patientId) },
          { $set: updates },
          context
        );
      }
    } catch (error) {
      console.error('Error updating patient core:', error);
    }
  }

  async saveDiagnoses(diagnoses, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(diagnoses) ? diagnoses : [diagnoses];
    return await this.saveToCollectionDynamic('diagnoses', items, patientId, documentId, extractedData, context);
  }


  async saveMedications(medications, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(medications) ? medications : [medications];

    // MEDICATION SAFETY CHECK: Check for drug interactions and contradictions BEFORE saving
    // DEDUPLICATION: Remove duplicate medications before safety checks and save
    console.log(`  🔍 Deduplicating medications (before: ${items.length})...`);
    const seenMedications = new Map();
    const deduplicatedItems = [];

    for (const med of items) {
      const medName = (med.name || med.medication || '').toLowerCase().trim();
      if (!medName) {
        console.warn(`    ⚠️  Skipping medication with no name:`, med);
        continue;
      }

      // Use medication name + dosage as unique key (same drug, different dosage = different medication)
      const dosage = (med.dosage || med.dose || '').toLowerCase().trim();
      const uniqueKey = `${medName}|${dosage}`;

      if (seenMedications.has(uniqueKey)) {
        console.log(`    🚫 Duplicate found: ${medName} ${dosage} (skipping)`);
        continue;
      }

      seenMedications.set(uniqueKey, true);
      deduplicatedItems.push(med);
    }

    console.log(`    ✅ After deduplication: ${deduplicatedItems.length} unique medications`);
    if (items.length !== deduplicatedItems.length) {
      console.log(`    📊 Removed ${items.length - deduplicatedItems.length} duplicate(s)`);
    }

    // Use deduplicated list for safety checks and save
    const finalItems = deduplicatedItems;

    console.log(`  🔍 Performing medication safety checks for ${finalItems.length} medications...`);
    const medicationSafetyChecker = require('./medicationSafetyChecker');

    // Get all medication names from current document for interaction checking
    const currentDocMedications = finalItems.map(med => ({
      name: med.name || med.medication || (typeof med === 'string' ? med.split(' ')[0] : ''),
      dosage: med.dosage,
      frequency: med.frequency
    }));

    // Build full medication list for interaction checking
    const allMedicationNames = finalItems
      .map(m => m.name || m.medication)
      .filter(Boolean);

    // Check drug interactions for ALL medications in the document
    console.log(`\n🔍 [DEBUG] Checking drug interactions for ${allMedicationNames.length} medications:`);
    console.log(`   Medications: ${allMedicationNames.join(', ')}`);

    const drugInteractionsResult = await medicationSafetyChecker.checkDrugInteractions(
      allMedicationNames,
      context
    );

    console.log(`\n💊 Drug Interactions Check Results:`);
    console.log(`   typeof drugInteractionsResult: ${typeof drugInteractionsResult}`);
    console.log(`   drugInteractionsResult keys: ${Object.keys(drugInteractionsResult || {}).join(', ')}`);
    console.log(`   Total interactions: ${drugInteractionsResult.totalInteractions}`);
    console.log(`   Major: ${drugInteractionsResult.majorInteractions}, Moderate: ${drugInteractionsResult.moderateInteractions}`);
    console.log(`   Interactions array length: ${drugInteractionsResult.interactions?.length || 0}`);

    // Check each medication for safety issues
    for (const medication of finalItems) {
      const medName = medication.name || medication.medication;
      if (medName) {
        try {
          const safetyReport = await medicationSafetyChecker.checkNewMedication(
            patientId,
            medName,
            context,
            currentDocMedications
          );

          // ALWAYS assign drugInteractions for ALL medications (even if no warnings)
          // Filter to only interactions involving THIS medication
          console.log(`\n   🔍 [DEBUG drugInteractions for ${medName}]:`);
          console.log(`      drugInteractionsResult.interactions exists: ${!!drugInteractionsResult.interactions}`);
          console.log(`      Total interactions in result: ${drugInteractionsResult.interactions?.length || 0}`);

          if (drugInteractionsResult.interactions && drugInteractionsResult.interactions.length > 0) {
            const relevantInteractions = drugInteractionsResult.interactions.filter(interaction => {
              const drug1 = (interaction.drug1 || '').toLowerCase().trim();
              const drug2 = (interaction.drug2 || '').toLowerCase().trim();
              const medNameLower = (medName || '').toLowerCase().trim();
              const isRelevant = drug1.includes(medNameLower) || drug2.includes(medNameLower) ||
                     medNameLower.includes(drug1) || medNameLower.includes(drug2);

              console.log(`         Checking interaction: ${interaction.drug1} ↔ ${interaction.drug2}`);
              console.log(`            Matches ${medName}? ${isRelevant}`);

              return isRelevant;
            });

            console.log(`      ✅ Found ${relevantInteractions.length} relevant interactions for ${medName}`);

            // CRITICAL: Always assign drugInteractions object (even if empty)
            // This prevents undefined → empty string conversion in saveToCollectionDynamic
            if (relevantInteractions.length > 0) {
              // Count interactions by severity
              const severityCounts = {
                contraindicated: 0,
                major: 0,
                moderate: 0,
                minor: 0
              };

              relevantInteractions.forEach(interaction => {
                const severity = (interaction.severity || '').toLowerCase();
                if (severity === 'contraindicated') severityCounts.contraindicated++;
                else if (severity === 'major') severityCounts.major++;
                else if (severity === 'moderate') severityCounts.moderate++;
                else if (severity === 'minor') severityCounts.minor++;
              });

              console.log(`      📊 Severity counts: Contraindicated=${severityCounts.contraindicated}, Major=${severityCounts.major}, Moderate=${severityCounts.moderate}, Minor=${severityCounts.minor}`);

              // Save in format expected by frontend template
              medication.drugInteractions = {
                totalInteractions: relevantInteractions.length,
                contraindicated: severityCounts.contraindicated,
                major: severityCounts.major,
                moderate: severityCounts.moderate,
                minor: severityCounts.minor,
                interactions: relevantInteractions.map(interaction => {
                  const otherDrug = interaction.drug1.toLowerCase().includes(medName.toLowerCase())
                    ? interaction.drug2
                    : interaction.drug1;

                  // CRITICAL: Use severity-based clinical messaging instead of truncated descriptions
                  // Doctors need quick, actionable information - not paragraphs of text
                  const severityMessages = {
                    'CONTRAINDICATED': `⛔ CONTRAINDICATED: Do not use ${medName} with ${otherDrug} together. Consider alternative medications.`,
                    'MAJOR': `🔴 MAJOR INTERACTION: ${medName} and ${otherDrug} - serious risk. Requires close monitoring or dose adjustment.`,
                    'MODERATE': `🟡 MODERATE INTERACTION: ${medName} and ${otherDrug} - may require monitoring. Assess risk vs benefit.`,
                    'MINOR': `🟢 MINOR INTERACTION: ${medName} and ${otherDrug} - low risk. Usually manageable.`
                  };

                  const severityKey = interaction.severity.toUpperCase();
                  const clinicalMessage = severityMessages[severityKey] ||
                    `${medName} interacts with ${otherDrug}. Severity: ${interaction.severity}.`;

                  return {
                    interactsWith: otherDrug,
                    severity: interaction.severity,
                    description: clinicalMessage,
                    source: interaction.source || 'FDA Drug Interaction Database'
                  };
                })
              };

              console.log(`      ✅ ASSIGNED drugInteractions object to ${medName}:`);
              console.log(`         typeof medication.drugInteractions: ${typeof medication.drugInteractions}`);
              console.log(`         totalInteractions: ${medication.drugInteractions.totalInteractions}`);
              console.log(`         interactions array length: ${medication.drugInteractions.interactions.length}`);
              console.log(`         Full object: ${JSON.stringify(medication.drugInteractions, null, 2)}`);
            } else {
              // No relevant interactions - assign empty object structure
              medication.drugInteractions = {
                totalInteractions: 0,
                contraindicated: 0,
                major: 0,
                moderate: 0,
                minor: 0,
                interactions: []
              };
              console.log(`      ✅ ASSIGNED empty drugInteractions object to ${medName} (no relevant interactions)`);
            }
          } else {
            // No interactions in result at all - assign empty object structure
            medication.drugInteractions = {
              totalInteractions: 0,
              contraindicated: 0,
              major: 0,
              moderate: 0,
              minor: 0,
              interactions: []
            };
            console.log(`      ✅ ASSIGNED empty drugInteractions object to ${medName} (no interactions found)`);
          }

          // Add safety warnings to medication record (separate from drugInteractions)
          // CRITICAL: Only set safetyWarning if THIS medication actually has safety concerns
          // Don't use generic safetyReport.summary - it applies to ALL medications
          const isInvolvedInInteraction = medication.drugInteractions && medication.drugInteractions.totalInteractions > 0;
          const hasAllergyConcern = safetyReport.allergyCheck?.directAllergy || safetyReport.allergyCheck?.crossSensitivity?.length > 0;

          if (isInvolvedInInteraction || hasAllergyConcern) {
            // Count actual concerns for THIS medication
            const concernsCount = (isInvolvedInInteraction ? medication.drugInteractions.totalInteractions : 0) +
                                 (safetyReport.allergyCheck?.directAllergy ? 1 : 0) +
                                 (safetyReport.allergyCheck?.crossSensitivity?.length || 0);

            medication.safetyWarning = `⚠️ SAFETY WARNING: ⛔ ${concernsCount} critical safety issue${concernsCount > 1 ? 's' : ''} detected`;
            medication.hasInteractions = isInvolvedInInteraction;
            medication.hasAllergyConcern = hasAllergyConcern;

            console.log(`    ⚠️  ${medName}: ${medication.safetyWarning}`);
          } else {
            console.log(`    ✅ ${medName}: No safety concerns for this medication`);
          }
        } catch (safetyError) {
          console.error(`    ❌ Safety check failed for ${medName}:`, safetyError.message);
          // Continue with save even if safety check fails
        }
      }
    }

    return await this.saveToCollectionDynamic('medications', finalItems, patientId, documentId, extractedData, context);
  }


  async saveVitalSigns(vitalSigns, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(vitalSigns) ? vitalSigns : [vitalSigns];
    return await this.saveToCollectionDynamic('vital_signs', items, patientId, documentId, extractedData, context);
  }


  async saveLabResults(labResults, patientId, documentId, extractedData, context) {
    try {
      const labData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        date: extractedData.documentDate ? new Date(extractedData.documentDate) : new Date(),
        testType: extractedData.testType || 'Comprehensive',
        results: labResults.map(test => {
          // CRITICAL FIX: Check both 'flag' and 'abnormalFlag' fields
          // AI extraction uses 'abnormalFlag', but some data uses 'flag'
          let flag = test.flag || test.abnormalFlag || 'normal';

          // If still no flag, try to derive from value and reference range
          if ((!test.flag && !test.abnormalFlag) && test.value && test.referenceRange) {
            // Simple check for out-of-range values
            const value = parseFloat(test.value);
            const rangeMatch = test.referenceRange.match(/([\d.]+)-([\d.]+)/);
            if (!isNaN(value) && rangeMatch) {
              const min = parseFloat(rangeMatch[1]);
              const max = parseFloat(rangeMatch[2]);
              if (value < min) flag = 'low';
              else if (value > max) flag = 'high';
            }
          }

          return {
            parameter: test.testName || test.name,
            value: test.result || test.value,
            unit: test.units || test.unit || '',
            referenceRange: test.referenceRange || '',
            flag: flag,
            interpretation: test.interpretation || ''
          };
        }),
        criticalValues: extractedData.criticalValues || [],
        orderedBy: extractedData.primaryProvider || extractedData.providers?.primary || '',
        labName: extractedData.facility || '',
        source: 'document_analysis',
        aiProcessed: true
      };

      await SecureDataAccess.insert('lab_results', labData, context);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveImaging(imaging, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    // NOTE: Saves to 'imaging_reports' collection (imaging collection was deprecated)
    const items = Array.isArray(imaging) ? imaging : [imaging];
    return await this.saveToCollectionDynamic('imaging_reports', items, patientId, documentId, extractedData, context);
  }


  async saveProcedures(procedures, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    // NOTE: Saves to 'medical_procedures' collection (procedures collection was deprecated)
    const items = Array.isArray(procedures) ? procedures : [procedures];
    return await this.saveToCollectionDynamic('medical_procedures', items, patientId, documentId, extractedData, context);
  }



  /**
   * Save hospital_course data
   * Auto-generated: 2025-11-05T08:45:29.270Z
   */
  async saveHospitalCourse(hospitalCourse, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(hospitalCourse) ? hospitalCourse : [hospitalCourse];
    return await this.saveToCollectionDynamic('hospital_course', items, patientId, documentId, extractedData, context);
  }


  /**
   * Save discharge_summaries data
   * Auto-generated: 2025-11-05T08:45:29.271Z
   */
  async saveDischargeSummaries(dischargeSummaries, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(dischargeSummaries) ? dischargeSummaries : [dischargeSummaries];
    return await this.saveToCollectionDynamic('discharge_summaries', items, patientId, documentId, extractedData, context);
  }


  /**
   * Save patient_education_records data
   * Auto-generated: 2025-11-05T08:45:29.271Z
   */
  async savePatientEducationRecords(patientEducationRecords, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(patientEducationRecords) ? patientEducationRecords : [patientEducationRecords];
    return await this.saveToCollectionDynamic('patient_education_records', items, patientId, documentId, extractedData, context);
  }


  /**
   * Save social_history data
   * Auto-generated: 2025-11-05T08:45:29.271Z
   */
  async saveSocialHistory(socialHistory, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(socialHistory) ? socialHistory : [socialHistory];
    return await this.saveToCollectionDynamic('social_history', items, patientId, documentId, extractedData, context);
  }


  /**
   * Save chief_complaints data
   * Auto-generated: 2025-11-05T08:45:29.271Z
   */
  async saveChiefComplaints(chiefComplaints, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(chiefComplaints) ? chiefComplaints : [chiefComplaints];
    return await this.saveToCollectionDynamic('chief_complaints', items, patientId, documentId, extractedData, context);
  }


  /**
   * Save history_present_illness data (collection save function)
   * Auto-generated: 2025-11-05T08:45:29.271Z
   */
  async saveHistoryPresentIllnessCollection(historyPresentIllnessCollection, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(historyPresentIllnessCollection) ? historyPresentIllnessCollection : [historyPresentIllnessCollection];
    return await this.saveToCollectionDynamic('history_present_illness_collection', items, patientId, documentId, extractedData, context);
  }


  /**
   * Save lifestyle_counseling data
   * Auto-generated: 2025-11-05T08:45:29.271Z
   */
  async saveLifestyleCounseling(lifestyleCounseling, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(lifestyleCounseling) ? lifestyleCounseling : [lifestyleCounseling];
    return await this.saveToCollectionDynamic('lifestyle_counseling', items, patientId, documentId, extractedData, context);
  }


  async saveAllergies(allergies, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(allergies) ? allergies : [allergies];

    // Filter out placeholder/empty allergy records (e.g., "No known drug allergies documented")
    const validAllergies = items.filter(allergy => {
      const allergen = (allergy.allergen || '').toLowerCase();
      const status = (allergy.status || '').toLowerCase();

      // Skip if allergen contains "no known" or "no allergies" or similar
      const isPlaceholder =
        allergen.includes('no known') ||
        allergen.includes('no allergies') ||
        allergen.includes('no documented') ||
        allergen.includes('nkda') ||
        status.includes('no allergies documented');

      return !isPlaceholder;
    });

    // If all allergies were placeholders, return success without saving anything
    if (validAllergies.length === 0) {
      return { success: true, count: 0, message: 'No actual allergies to save (only placeholders)' };
    }

    return await this.saveToCollectionDynamic('allergies', validAllergies, patientId, documentId, extractedData, context);
  }


  async saveVaccinations(vaccinations, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(vaccinations) ? vaccinations : [vaccinations];
    return await this.saveToCollectionDynamic('vaccinations', items, patientId, documentId, extractedData, context);
  }


  async saveConsultationNote(consultationNote, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(consultationNote) ? consultationNote : [consultationNote];
    return await this.saveToCollectionDynamic('consultation_note', items, patientId, documentId, extractedData, context);
  }


  async saveDischargeSummary(dischargeSummary, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(dischargeSummary) ? dischargeSummary : [dischargeSummary];
    return await this.saveToCollectionDynamic('discharge_summaries', items, patientId, documentId, extractedData, context);
  }


  async saveSpecialtyData(data, patientId, documentId, context, savedCollections, errors) {
    // Determine the specialty from the extracted data
    const specialty = data.providerSpecialty || data.documentSpecialty || '';
    const sessionId = data.sessionId || context.sessionId || '';

    // Route to services with mapAndSaveExtractedData method (12 services)
    const servicesWithUnifiedMethod = {
      'Hematology': hematologyFieldMappingService,
      'Allergy & Immunology': allergyImmunologyFieldMappingService,
      'Allergy/Immunology': allergyImmunologyFieldMappingService,
      'Medical Genetics': medicalGeneticsFieldMappingService,
      'Preventive Medicine': preventiveMedicineFieldMappingService,
      'Neurosurgery': neurosurgeryFieldMappingService,
      'Colorectal Surgery': colorectalSurgeryFieldMappingService,
      'Thoracic Surgery': thoracicSurgeryFieldMappingService,
      'Plastic Surgery': plasticSurgeryFieldMappingService,
      'Nuclear Medicine': nuclearMedicineFieldMappingService,
      'Physical Medicine & Rehabilitation': pmrFieldMappingService,
      'PM&R': pmrFieldMappingService,
      'Family Medicine': familyMedicineFieldMappingService,
      'Urology': urologyFieldMappingService
    };

    // Detect specialty based on data fields if not explicitly specified
    let detectedServices = [];

    // Check for specialty-specific assessment fields
    if (data.hematologyAssessment) detectedServices.push(hematologyFieldMappingService);
    if (data.allergyImmunologyAssessment) detectedServices.push(allergyImmunologyFieldMappingService);
    if (data.medicalGeneticsAssessment) detectedServices.push(medicalGeneticsFieldMappingService);
    if (data.preventiveMedicineAssessment) detectedServices.push(preventiveMedicineFieldMappingService);
    if (data.neurosurgeryAssessment) detectedServices.push(neurosurgeryFieldMappingService);
    if (data.colorectalSurgeryAssessment) detectedServices.push(colorectalSurgeryFieldMappingService);
    if (data.thoracicSurgeryAssessment) detectedServices.push(thoracicSurgeryFieldMappingService);
    if (data.plasticSurgeryAssessment) detectedServices.push(plasticSurgeryFieldMappingService);
    if (data.nuclearMedicineAssessment) detectedServices.push(nuclearMedicineFieldMappingService);
    if (data.pmrAssessment || data.rehabilitationAssessment) detectedServices.push(pmrFieldMappingService);
    if (data.familyMedicineAssessment) detectedServices.push(familyMedicineFieldMappingService);
    if (data.urologyAssessment) detectedServices.push(urologyFieldMappingService);

    // Process explicit specialty first
    const specialtyService = servicesWithUnifiedMethod[specialty];
    if (specialtyService && specialtyService.mapAndSaveExtractedData) {
      if (!detectedServices.includes(specialtyService)) {
        detectedServices.unshift(specialtyService); // Add at the beginning
      }
    }

    // Process all detected services
    for (const service of detectedServices) {
      if (service && service.mapAndSaveExtractedData) {
        try {
          const result = await service.mapAndSaveExtractedData(
            data,
            patientId,
            documentId,
            sessionId,
            context.practiceSubdomain || context.practiceId // Pass practiceSubdomain
          );
          if (result.success) {
            savedCollections.push(...(result.savedEntities || []));
          } else if (result.errors) {
            errors.push(...result.errors);
          }
        } catch (error) {
          console.error(`Error in specialty field mapping:`, error);
          errors.push(`Specialty mapping: ${error.message}`);
        }
      }
    }

    // Legacy handling for services with individual methods (preserved below)
    // Cardiology specific
    if (data.ecgFindings) {
      try {
        await SecureDataAccess.insert('ecg_readings', {
          patientId: new ObjectId(patientId),
          documentId: documentId,
          date: data.documentDate ? new Date(data.documentDate) : new Date(),
          ...data.ecgFindings,
          source: 'document_analysis',
          aiProcessed: true
        }, context);
        savedCollections.push('ecg_readings');
      } catch (error) {
        errors.push(`ECG: ${error.message}`);
      }
    }

    if (data.echoFindings) {
      try {
        await SecureDataAccess.insert('echo_reports', {
          patientId: new ObjectId(patientId),
          documentId: documentId,
          date: data.documentDate ? new Date(data.documentDate) : new Date(),
          ...data.echoFindings,
          source: 'document_analysis',
          aiProcessed: true
        }, context);
        savedCollections.push('echo_reports');
      } catch (error) {
        errors.push(`Echo: ${error.message}`);
      }
    }

    if (data.cardiacRiskScores) {
      try {
        await SecureDataAccess.insert('cardiac_risk_scores', {
          patientId: new ObjectId(patientId),
          documentId: documentId,
          date: data.documentDate ? new Date(data.documentDate) : new Date(),
          ...data.cardiacRiskScores,
          source: 'document_analysis',
          aiProcessed: true
        }, context);
        savedCollections.push('cardiac_risk_scores');
      } catch (error) {
        errors.push(`Cardiac Risk: ${error.message}`);
      }
    }

    // Obstetrics specific
    if (data.obstetricsData) {
      try {
        await SecureDataAccess.insert('obstetric_records', {
          patientId: new ObjectId(patientId),
          documentId: documentId,
          date: data.documentDate ? new Date(data.documentDate) : new Date(),
          ...data.obstetricsData,
          source: 'document_analysis',
          aiProcessed: true
        }, context);
        savedCollections.push('obstetric_records');
      } catch (error) {
        errors.push(`Obstetrics: ${error.message}`);
      }
    }

    // Pediatrics specific
    if (data.pediatricData) {
      try {
        await SecureDataAccess.insert('pediatric_records', {
          patientId: new ObjectId(patientId),
          documentId: documentId,
          date: data.documentDate ? new Date(data.documentDate) : new Date(),
          ...data.pediatricData,
          source: 'document_analysis',
          aiProcessed: true
        }, context);
        savedCollections.push('pediatric_records');
      } catch (error) {
        errors.push(`Pediatrics: ${error.message}`);
      }
    }

    // Mental health specific
    if (data.mentalStatusExam) {
      try {
        await SecureDataAccess.insert('mental_status_exams', {
          patientId: new ObjectId(patientId),
          documentId: documentId,
          date: data.documentDate ? new Date(data.documentDate) : new Date(),
          ...data.mentalStatusExam,
          source: 'document_analysis',
          aiProcessed: true
        }, context);
        savedCollections.push('mental_status_exams');
      } catch (error) {
        errors.push(`Mental Status: ${error.message}`);
      }
    }

    // Rehabilitation specific
    if (data.functionalStatus) {
      try {
        await SecureDataAccess.insert('functional_assessments', {
          patientId: new ObjectId(patientId),
          documentId: documentId,
          date: data.documentDate ? new Date(data.documentDate) : new Date(),
          ...data.functionalStatus,
          source: 'document_analysis',
          aiProcessed: true
        }, context);
        savedCollections.push('functional_assessments');
      } catch (error) {
        errors.push(`Functional Status: ${error.message}`);
      }
    }
  }

  async saveFollowUpAppointments(followUpAppointments, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(followUpAppointments) ? followUpAppointments : [followUpAppointments];
    return await this.saveToCollectionDynamic('follow_up_appointments', items, patientId, documentId, extractedData, context);
  }


  async saveMedicalHistory(medicalHistory, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(medicalHistory) ? medicalHistory : [medicalHistory];
    return await this.saveToCollectionDynamic('medical_history', items, patientId, documentId, extractedData, context);
  }


  async saveRiskFactors(riskFactors, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(riskFactors) ? riskFactors : [riskFactors];
    return await this.saveToCollectionDynamic('risk_factors', items, patientId, documentId, extractedData, context);
  }


  async saveClinicalScores(clinicalScores, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(clinicalScores) ? clinicalScores : [clinicalScores];
    return await this.saveToCollectionDynamic('clinical_scores', items, patientId, documentId, extractedData, context);
  }


  async savePathology(pathology, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(pathology) ? pathology : [pathology];
    return await this.saveToCollectionDynamic('pathology', items, patientId, documentId, extractedData, context);
  }


  async saveImplants(implants, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(implants) ? implants : [implants];
    return await this.saveToCollectionDynamic('implants', items, patientId, documentId, extractedData, context);
  }


  async saveFlexibleData(flexibleData, patientId, documentId, category, context) {
    try {
      // Store any additional/unexpected fields
      if (flexibleData && Object.keys(flexibleData).length > 0) {
        const additionalData = {
          patientId: new ObjectId(patientId),
          documentId: documentId,
          category: category,
          data: flexibleData,
          timestamp: new Date(),
          source: 'document_analysis',
          aiProcessed: true
        };

        await SecureDataAccess.insert('additional_data', additionalData, context);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * ===== NEW DYNAMIC SAVE METHOD FOR ALL 267 COLLECTIONS =====
   * Intelligently saves data to any collection using appropriate schema
   */
  async saveToCollection(collectionName, extractedData, patientId, documentId, context) {
    try {
      // Get schema for this collection
      const schema = collectionSchemas.getSchema(collectionName);

      // Transform data according to schema
      const transformedData = collectionSchemas.transformData(
        {
          ...extractedData,
          patientId,
          documentId
        },
        schema
      );

      // Validate data
      const validation = collectionSchemas.validateData(transformedData, collectionName);
      if (!validation.valid) {
        console.warn(`Validation warnings for ${collectionName}:`, validation.errors);
        // Continue anyway with partial data
      }

      // Check for duplicates before inserting
      const existingRecord = await this.checkForDuplicate(
        collectionName,
        transformedData,
        context
      );

      if (existingRecord) {
        console.log(`📋 Duplicate found in ${collectionName}, updating instead`);
        // Update existing record
        await SecureDataAccess.update(
          collectionName,
          { _id: existingRecord._id },
          { $set: transformedData },
          context
        );
      } else {
        // Insert new record
        await SecureDataAccess.insert(collectionName, transformedData, context);
      }

      return { success: true };
    } catch (error) {
      console.error(`Error saving to ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Dynamic save function for all 757 collections
   * Uses unified schema to determine fields automatically
   * Created: 2025-11-05
   */
  async saveToCollectionDynamic(collectionName, items, patientId, documentId, extractedData, context) {
    try {
      const unifiedSchemas = require('./unifiedMedicalSchemas.js');

      // CRITICAL FIX: Use STORAGE schema (storable fields) instead of EXTRACTION schema (extractable fields)
      // This ensures computed fields like drugInteractions (extractable:false, storable:true) are saved
      const storageSchema = unifiedSchemas.getStorageSchema(collectionName);

      if (!storageSchema || Object.keys(storageSchema).length === 0) {
        console.warn(`No storage schema found for collection: ${collectionName}`);
        return { success: false, error: `No schema for ${collectionName}` };
      }

      // CRITICAL VALIDATION (November 26, 2025): Filter out invalid items before saving
      // Prevents empty documents from being created (e.g., lab_results with no identifying field)
      // UPDATED November 28, 2025: Accept EITHER testName OR testType (schema shows testType is required, not testName)
      let validItems = items;
      if (collectionName === 'lab_results') {
        validItems = items.filter(item => {
          // Lab results MUST have testName OR testType to be valid
          // Schema defines testType as required, testName as optional
          const hasTestName = item.testName && item.testName.trim() !== '';
          const hasTestType = item.testType && item.testType.trim() !== '';
          const isValid = hasTestName || hasTestType;
          if (!isValid) {
            console.log(`⚠️ Skipping invalid lab_results item - missing both testName and testType:`, JSON.stringify(item).substring(0, 200));
          }
          return isValid;
        });
        if (validItems.length < items.length) {
          console.log(`📊 Filtered ${items.length - validItems.length} invalid lab_results items (missing testName/testType)`);
        }
        if (validItems.length === 0) {
          console.log(`⚠️ No valid lab_results to save after filtering`);
          return { success: true }; // Return success but save nothing
        }
      }

      for (const item of validItems) {
        const data = {
          patientId: new ObjectId(patientId),
          documentId: documentId
        };

        // Dynamically map all fields from storage schema (includes computed fields)
        for (const fieldName of Object.keys(storageSchema)) {
          const fieldDef = storageSchema[fieldName];

          // CRITICAL: Skip MongoDB system fields - we handle these separately
          // _id: MongoDB generates automatically
          // patientId, documentId: Already set at lines 1344-1346
          if (fieldName === '_id' || fieldName === 'patientId' || fieldName === 'documentId') {
            continue;
          }

          // CRITICAL: Check item first, then fall back to extractedData metadata
          // This handles fields that may be at panel/collection level, not individual item level
          let fieldValue = item[fieldName] !== undefined ? item[fieldName] : extractedData[fieldName];

          // DEBUG: Log drugInteractions field processing
          if (fieldName === 'drugInteractions') {
            console.log(`\n🔍 [DEBUG drugInteractions]:`);
            console.log(`   fieldName: ${fieldName}`);
            console.log(`   fieldDef.type: ${fieldDef.type}`);
            console.log(`   item[fieldName]:`, item[fieldName]);
            console.log(`   typeof fieldValue: ${typeof fieldValue}`);
            console.log(`   fieldValue:`, JSON.stringify(fieldValue, null, 2));
          }

          // SPECIAL CASE: Derive 'active' boolean from 'status' string field
          // Claude extracts status:"active" but database needs active:true for queries
          if (fieldName === 'active' && fieldValue === undefined && item.status) {
            fieldValue = item.status.toLowerCase() === 'active';
          }

          // Handle date fields
          if (fieldName === 'date' || fieldName.toLowerCase().includes('date')) {
            if (fieldName === 'date') {
              data[fieldName] = fieldValue
                ? new Date(fieldValue)
                : (extractedData.documentDate ? new Date(extractedData.documentDate) : new Date());
            } else {
              data[fieldName] = fieldValue ? new Date(fieldValue) : null;
            }
          }
          // Handle array fields - CRITICAL: Only use item data, never extractedData
          // Prevents document-level arrays from being duplicated across all items
          // (e.g., don't copy document recommendations to every consultation)
          else if (fieldDef.type === 'array' || Array.isArray(fieldValue)) {
            data[fieldName] = item[fieldName] || [];
          }
          // Handle object fields
          else if (fieldDef.type === 'object') {
            if (fieldName === 'drugInteractions') {
              console.log(`   ✅ Taking OBJECT branch`);
              console.log(`   ✅ Setting data.drugInteractions to:`, JSON.stringify(fieldValue, null, 2));
            }
            data[fieldName] = fieldValue || {};
          }
          // Handle boolean fields
          else if (fieldDef.type === 'boolean') {
            if (fieldName === 'drugInteractions') console.log(`   ❌ Taking BOOLEAN branch (WRONG!)`);
            data[fieldName] = fieldValue !== undefined ? fieldValue : false;
          }
          // Handle numeric fields
          else if (fieldDef.type === 'number') {
            if (fieldName === 'drugInteractions') console.log(`   ❌ Taking NUMBER branch (WRONG!)`);
            data[fieldName] = fieldValue !== undefined ? fieldValue : 0;
          }
          // Default to string
          else {
            if (fieldName === 'drugInteractions') console.log(`   ❌ Taking DEFAULT (STRING) branch (WRONG!) - converts to empty string`);
            data[fieldName] = fieldValue !== undefined ? fieldValue : '';
          }
        }

        data.source = 'document_analysis';
        data.aiProcessed = true;

        // Debug: Verify drugInteractions is in final data object before save
        if (collectionName === 'medications' && data.drugInteractions) {
          console.log(`\n📝 [DEBUG] Final data object BEFORE save for medication: ${item.name || item.medication}`);
          console.log(`   data.drugInteractions exists: ${!!data.drugInteractions}`);
          console.log(`   typeof data.drugInteractions: ${typeof data.drugInteractions}`);
          console.log(`   data.drugInteractions.totalInteractions: ${data.drugInteractions.totalInteractions}`);
          console.log(`   Keys in data object: ${Object.keys(data).join(', ')}`);
        }

        // CRITICAL: Check for duplicates before inserting to prevent double-save bugs
        // (e.g., batch worker running twice, or concurrent processing)
        const existingRecord = await this.checkForDuplicate(collectionName, data, context);

        if (existingRecord) {
          console.log(`⚠️ Skipping duplicate ${collectionName} record for patient ${patientId} (existing ID: ${existingRecord._id})`);
          continue; // Skip this item, don't insert
        }

        await SecureDataAccess.insert(collectionName, data, context);

        // Debug: Confirm save completed
        if (collectionName === 'medications' && data.drugInteractions) {
          console.log(`   ✅ Medication saved to database with drugInteractions object`);
        }
      }

      return { success: true };
    } catch (error) {
      console.error(`Error saving to ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }



  /**
   * Check for duplicate records to prevent redundant data
   */
  async checkForDuplicate(collectionName, data, context) {
    try {
      // Build duplicate check query based on collection type
      const query = this.buildDuplicateQuery(collectionName, data);

      if (!query) return null;

      const existing = await SecureDataAccess.query(
        collectionName,
        query,
        { limit: 1 },
        context
      );

      return existing && existing.length > 0 ? existing[0] : null;
    } catch (error) {
      console.error('Error checking for duplicate:', error);
      return null;
    }
  }

  /**
   * Build query to check for duplicates based on collection type
   */
  buildDuplicateQuery(collectionName, data) {
    // For most collections, check by patientId, date, and key fields
    const query = {
      patientId: data.patientId
    };

    // Add date check if available (within same day)
    if (data.date) {
      const startOfDay = new Date(data.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(data.date);
      endOfDay.setHours(23, 59, 59, 999);

      query.date = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    // Add collection-specific duplicate checks
    switch (collectionName) {
      case 'diagnoses':
        if (data.diagnosis) query.diagnosis = data.diagnosis;
        if (data.icdCode) query.icdCode = data.icdCode;
        break;

      case 'medications':
        if (data.name) query.name = data.name;
        if (data.dosage) query.dosage = data.dosage;
        break;

      case 'lab_results':
        // CRITICAL: Check by testName to allow multiple different tests from same panel
        // Without this, all CBC tests match same query {testType: "CBC"} = only first saves
        // Same pattern as allergies fix (November 26, 2025)
        if (data.testName) query.testName = data.testName;
        if (data.testType) query.testType = data.testType;
        break;

      case 'imaging_reports':
        if (data.imagingType) query.imagingType = data.imagingType;
        if (data.bodyPart) query.bodyPart = data.bodyPart;
        break;

      case 'appointments':
        if (data.appointmentDate) query.appointmentDate = data.appointmentDate;
        if (data.provider) query.provider = data.provider;
        break;

      case 'vaccination_records':
        if (data.vaccine) query.vaccine = data.vaccine;
        break;

      case 'allergies':
        // CRITICAL: Check by allergen to allow multiple different allergies per patient
        // Without this, all allergies fall through to default case which only checks documentId
        // If documentId is null (batch processing), all allergies match same query = only first saves
        if (data.allergen) query.allergen = data.allergen;
        break;

      default:
        // For other collections, use documentId if available
        if (data.documentId) {
          query.documentId = data.documentId;
        }
    }

    return query;
  }

  /**
   * Get mapping statistics
   */
  getMappingStats() {
    return categoryCollectionMapper.getMappingStats();
  }

  // ========== NEW SAVE METHODS FOR MISSING CATEGORIES ==========

  async saveVitalSignsTable(vitalSignsTable, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(vitalSignsTable) ? vitalSignsTable : [vitalSignsTable];
    return await this.saveToCollectionDynamic('vital_signs_table', items, patientId, documentId, extractedData, context);
  }


  async saveTreatmentCourse(treatmentCourse, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(treatmentCourse) ? treatmentCourse : [treatmentCourse];
    return await this.saveToCollectionDynamic('treatment_courses', items, patientId, documentId, extractedData, context);
  }


  async savePatientEducation(patientEducation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(patientEducation) ? patientEducation : [patientEducation];
    return await this.saveToCollectionDynamic('patient_education', items, patientId, documentId, extractedData, context);
  }


  async saveAdministrativeData(administrativeData, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(administrativeData) ? administrativeData : [administrativeData];
    return await this.saveToCollectionDynamic('administrative_data', items, patientId, documentId, extractedData, context);
  }


  // DEPRECATED: Generic recommendations collection removed - use specific collections instead:
  // - doctors_medication_recommendations: For medication recommendations
  // - referrals: For specialist referrals
  // - follow_up_appointments: For follow-up scheduling
  // - imaging_reports.recommendations: For imaging recommendations
  // This function is kept for backwards compatibility but should not be used
  async saveRecommendations(recommendations, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(recommendations) ? recommendations : [recommendations];
    return await this.saveToCollectionDynamic('recommendations', items, patientId, documentId, extractedData, context);
  }


  async saveConsultationDetails(consultationDetails, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(consultationDetails) ? consultationDetails : [consultationDetails];
    return await this.saveToCollectionDynamic('consultation_notes', items, patientId, documentId, extractedData, context);
  }

  async savePsychosocialAssessment(psychosocialAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(psychosocialAssessment) ? psychosocialAssessment : [psychosocialAssessment];
    return await this.saveToCollectionDynamic('psychosocial_assessments', items, patientId, documentId, extractedData, context);
  }


  async saveFamilyMeetingNotes(familyMeetingNotes, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(familyMeetingNotes) ? familyMeetingNotes : [familyMeetingNotes];
    return await this.saveToCollectionDynamic('family_meeting_notes', items, patientId, documentId, extractedData, context);
  }


  async savePrognosis(prognosis, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(prognosis) ? prognosis : [prognosis];
    return await this.saveToCollectionDynamic('prognosis', items, patientId, documentId, extractedData, context);
  }


  async saveHomeMonitoring(homeMonitoring, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(homeMonitoring) ? homeMonitoring : [homeMonitoring];
    return await this.saveToCollectionDynamic('home_monitoring', items, patientId, documentId, extractedData, context);
  }


  async saveMedicationReconciliation(medicationReconciliation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(medicationReconciliation) ? medicationReconciliation : [medicationReconciliation];
    return await this.saveToCollectionDynamic('medication_reconciliation', items, patientId, documentId, extractedData, context);
  }


  async saveTrendingAnalysis(trendingAnalysis, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(trendingAnalysis) ? trendingAnalysis : [trendingAnalysis];
    return await this.saveToCollectionDynamic('trending_analysis', items, patientId, documentId, extractedData, context);
  }


  async saveEmergencyInformation(emergencyInformation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(emergencyInformation) ? emergencyInformation : [emergencyInformation];
    return await this.saveToCollectionDynamic('emergency_information', items, patientId, documentId, extractedData, context);
  }


  // ===== UNIFIED MEDICAL DOCUMENTS HANDLER =====

  /**
   * Save complete unified document with patient demographics + all extracted data
   * This creates ONE self-contained document for doctor review
   *
   * @param {object} extractedData - Complete extracted data from document
   * @param {string} patientId - Patient ObjectId
   * @param {string} documentId - Document ObjectId
   * @param {object} context - Security context
   * @returns {object} Success/error result
   */
  async saveUnifiedDocument(extractedData, patientId, documentId, context) {
    try {
      let patientInfo = {};

      console.log(`🔍 [saveUnifiedDocument] Received patientId: ${JSON.stringify(patientId)} (type: ${typeof patientId})`);

      // If no patientId, create a new patient from extracted data
      if (!patientId || patientId === 'null' || patientId === 'undefined') {
        console.log('⚠️ No patientId provided, creating new patient from extracted data...');

        // Parse patient name (format: "LastName, FirstName MiddleName")
        let firstName, lastName;
        if (extractedData.patientName) {
          const nameParts = extractedData.patientName.split(',').map(p => p.trim());
          if (nameParts.length >= 2) {
            lastName = nameParts[0];
            const firstMiddle = nameParts[1].split(' ').filter(Boolean);
            firstName = firstMiddle[0];
          }
        }

        const newPatient = {
          firstName: firstName || 'Unknown',
          lastName: lastName || 'Unknown',
          dateOfBirth: extractedData.dateOfBirth,
          gender: extractedData.gender,
          medicalRecordNumber: extractedData.medicalRecordNumber,
          createdAt: new Date(),
          createdBy: 'document-analysis-skills'
        };

        const insertedPatients = await SecureDataAccess.insert('patients', newPatient, context);

        if (insertedPatients && insertedPatients[0] && insertedPatients[0]._id) {
          patientId = insertedPatients[0]._id.toString();
          patientInfo = insertedPatients[0];
          console.log(`✅ Created new patient: ${patientId} (${firstName} ${lastName})`);
        } else {
          throw new Error('Failed to create new patient record');
        }
      } else {
        // 1. Fetch patient demographics from Patients collection
        const patient = await SecureDataAccess.query(
          'Patients',
          { _id: new ObjectId(patientId) },
          { limit: 1 },
          context
        );

        patientInfo = patient[0] || {};
      }

      // 2. Build complete unified document
      const unifiedDocument = {
        patientId: new ObjectId(patientId),
        // Use documentSpecialty for unified document category (template routing)
        // Falls back to category if documentSpecialty not provided (backward compatibility)
        category: extractedData.documentSpecialty || extractedData.category || 'general',
        documentDate: extractedData.date || extractedData.documentDate || new Date(),

        // documentData contains EVERYTHING (no exclusions)
        documentData: {
          // Patient demographics (from Patients collection)
          // Handle both name field and firstName/lastName fields
          patientName: patientInfo.name ||
                      (patientInfo.firstName && patientInfo.lastName ? `${patientInfo.firstName} ${patientInfo.lastName}` : null) ||
                      extractedData.patientName,
          dateOfBirth: patientInfo.dateOfBirth,
          age: extractedData.age || patientInfo.age,
          gender: patientInfo.gender || extractedData.gender,
          race: patientInfo.race || extractedData.race,
          ethnicity: patientInfo.ethnicity || extractedData.ethnicity,
          mrn: patientInfo.mrn || extractedData.mrn,

          // Complete extracted data (ALL fields, NO exclusions)
          ...extractedData
        },

        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 3. Save to unified_medical_documents collection
      await SecureDataAccess.insert('unified_medical_documents', unifiedDocument, context);

      console.log(`✅ [UnifiedDoc] Saved unified document: ${extractedData.category} for patient ${patientId}`);
      return { success: true };

    } catch (error) {
      console.error('❌ [UnifiedDoc] Error saving unified document:', error);
      return { success: false, error: error.message };
    }
  }

  // ===== AI-GENERATED INTELLIGENCE HANDLERS =====

  async saveClinicalDecisionSupport(clinicalDecisionSupport, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(clinicalDecisionSupport) ? clinicalDecisionSupport : [clinicalDecisionSupport];
    return await this.saveToCollectionDynamic('clinical_decision_support', items, patientId, documentId, extractedData, context);
  }


  async saveIntelligentRecommendations(intelligentRecommendations, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(intelligentRecommendations) ? intelligentRecommendations : [intelligentRecommendations];
    return await this.saveToCollectionDynamic('intelligent_recommendations', items, patientId, documentId, extractedData, context);
  }


  async savePatientSpecificCarePlan(patientSpecificCarePlan, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(patientSpecificCarePlan) ? patientSpecificCarePlan : [patientSpecificCarePlan];
    return await this.saveToCollectionDynamic('patient_specific_care_plan', items, patientId, documentId, extractedData, context);
  }


  async saveFollowUpIntelligence(followUpIntelligence, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(followUpIntelligence) ? followUpIntelligence : [followUpIntelligence];
    return await this.saveToCollectionDynamic('follow_up_appointments', items, patientId, documentId, extractedData, context);
  }


  async saveMedicationsOptimizations(medicationsOptimizations, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(medicationsOptimizations) ? medicationsOptimizations : [medicationsOptimizations];
    return await this.saveToCollectionDynamic('medications_optimizations', items, patientId, documentId, extractedData, context);
  }


  async savePatientEducationContext(patientEducationContext, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(patientEducationContext) ? patientEducationContext : [patientEducationContext];
    return await this.saveToCollectionDynamic('patient_education_context', items, patientId, documentId, extractedData, context);
  }


  async saveGuidelineCompliance(guidelineCompliance, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(guidelineCompliance) ? guidelineCompliance : [guidelineCompliance];
    return await this.saveToCollectionDynamic('guideline_compliance', items, patientId, documentId, extractedData, context);
  }


  async saveOutcomesPrediction(outcomesPrediction, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(outcomesPrediction) ? outcomesPrediction : [outcomesPrediction];
    return await this.saveToCollectionDynamic('outcomes_prediction', items, patientId, documentId, extractedData, context);
  }


  async saveGIRiskAssessment(gIRiskAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(gIRiskAssessment) ? gIRiskAssessment : [gIRiskAssessment];
    return await this.saveToCollectionDynamic('gi_risk_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveCareGaps(careGaps, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(careGaps) ? careGaps : [careGaps];
    return await this.saveToCollectionDynamic('care_gaps', items, patientId, documentId, extractedData, context);
  }


  /**
   * Save doctor's medication recommendations (NEW medications prescribed, not current meds)
   */
  async saveDoctorsMedicationsRecommendations(doctorsMedicationsRecommendations, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(doctorsMedicationsRecommendations) ? doctorsMedicationsRecommendations : [doctorsMedicationsRecommendations];
    return await this.saveToCollectionDynamic('doctors_medications_recommendations', items, patientId, documentId, extractedData, context);
  }


  /**
   * Save AI optimizations for doctor's medication recommendations
   */
  async saveDoctorsMedicationsRecommendationsOptimizations(doctorsMedicationsRecommendationsOptimizations, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(doctorsMedicationsRecommendationsOptimizations) ? doctorsMedicationsRecommendationsOptimizations : [doctorsMedicationsRecommendationsOptimizations];
    return await this.saveToCollectionDynamic('doctors_medications_recommendations_optimizations', items, patientId, documentId, extractedData, context);
  }


  async saveTriageData(triageData, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(triageData) ? triageData : [triageData];
    return await this.saveToCollectionDynamic('triage_data', items, patientId, documentId, extractedData, context);
  }


  async saveEdCourse(edCourse, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(edCourse) ? edCourse : [edCourse];
    return await this.saveToCollectionDynamic('ed_course', items, patientId, documentId, extractedData, context);
  }


  async saveConsultationTimeline(consultationTimeline, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(consultationTimeline) ? consultationTimeline : [consultationTimeline];
    return await this.saveToCollectionDynamic('consultation_timeline', items, patientId, documentId, extractedData, context);
  }


  async savePreOperativePreparation(preOperativePreparation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(preOperativePreparation) ? preOperativePreparation : [preOperativePreparation];
    return await this.saveToCollectionDynamic('pre_operative_preparation', items, patientId, documentId, extractedData, context);
  }


  async saveEdDisposition(edDisposition, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(edDisposition) ? edDisposition : [edDisposition];
    return await this.saveToCollectionDynamic('ed_disposition', items, patientId, documentId, extractedData, context);
  }


  async savePainManagement(painManagement, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(painManagement) ? painManagement : [painManagement];
    return await this.saveToCollectionDynamic('pain_management_notes', items, patientId, documentId, extractedData, context);
  }


  async saveInjuryDetails(injuryDetails, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(injuryDetails) ? injuryDetails : [injuryDetails];
    return await this.saveToCollectionDynamic('injury_details', items, patientId, documentId, extractedData, context);
  }


  async saveOrthopedicAssessment(orthopedicAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(orthopedicAssessment) ? orthopedicAssessment : [orthopedicAssessment];
    return await this.saveToCollectionDynamic('orthopedic_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveProceduralSedation(proceduralSedation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(proceduralSedation) ? proceduralSedation : [proceduralSedation];
    return await this.saveToCollectionDynamic('procedural_sedation', items, patientId, documentId, extractedData, context);
  }


  async saveOrthopedicProcedures(orthopedicProcedures, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(orthopedicProcedures) ? orthopedicProcedures : [orthopedicProcedures];
    return await this.saveToCollectionDynamic('orthopedic_procedures', items, patientId, documentId, extractedData, context);
  }


  async saveWorkRestrictions(workRestrictions, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(workRestrictions) ? workRestrictions : [workRestrictions];
    return await this.saveToCollectionDynamic('work_restrictions', items, patientId, documentId, extractedData, context);
  }


  async saveDiabetesManagement(diabetesManagement, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(diabetesManagement) ? diabetesManagement : [diabetesManagement];
    return await this.saveToCollectionDynamic('diabetes_management_notes', items, patientId, documentId, extractedData, context);
  }


  async saveInsulinPumpSettings(insulinPumpSettings, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(insulinPumpSettings) ? insulinPumpSettings : [insulinPumpSettings];
    return await this.saveToCollectionDynamic('insulin_pump_settings', items, patientId, documentId, extractedData, context);
  }


  async saveCgmData(cgmData, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(cgmData) ? cgmData : [cgmData];
    return await this.saveToCollectionDynamic('cgm_data', items, patientId, documentId, extractedData, context);
  }


  async saveInsulinRegimen(insulinRegimen, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(insulinRegimen) ? insulinRegimen : [insulinRegimen];
    return await this.saveToCollectionDynamic('insulin_regimen', items, patientId, documentId, extractedData, context);
  }


  async saveDiabetesEducation(diabetesEducation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(diabetesEducation) ? diabetesEducation : [diabetesEducation];
    return await this.saveToCollectionDynamic('diabetes_education', items, patientId, documentId, extractedData, context);
  }


  async saveHypoglycemiaManagement(hypoglycemiaManagement, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(hypoglycemiaManagement) ? hypoglycemiaManagement : [hypoglycemiaManagement];
    return await this.saveToCollectionDynamic('hypoglycemia_management', items, patientId, documentId, extractedData, context);
  }


  async saveEndocrineLabResults(endocrineLabResults, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(endocrineLabResults) ? endocrineLabResults : [endocrineLabResults];
    return await this.saveToCollectionDynamic('endocrine_lab_results', items, patientId, documentId, extractedData, context);
  }


  async savePreconceptionCounseling(preconceptionCounseling, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(preconceptionCounseling) ? preconceptionCounseling : [preconceptionCounseling];
    return await this.saveToCollectionDynamic('preconception_counseling', items, patientId, documentId, extractedData, context);
  }


  async saveDiabetesQualityMetrics(diabetesQualityMetrics, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(diabetesQualityMetrics) ? diabetesQualityMetrics : [diabetesQualityMetrics];
    return await this.saveToCollectionDynamic('diabetes_quality_metrics', items, patientId, documentId, extractedData, context);
  }


  // IBD/Gastroenterology delegated methods
  async saveIbdAssessment(ibdAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(ibdAssessment) ? ibdAssessment : [ibdAssessment];
    return await this.saveToCollectionDynamic('ibd_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveDiseaseActivityScores(diseaseActivityScores, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(diseaseActivityScores) ? diseaseActivityScores : [diseaseActivityScores];
    return await this.saveToCollectionDynamic('disease_activity_scores', items, patientId, documentId, extractedData, context);
  }


  async saveEndoscopyFindings(endoscopyFindings, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(endoscopyFindings) ? endoscopyFindings : [endoscopyFindings];
    return await this.saveToCollectionDynamic('endoscopy_findings', items, patientId, documentId, extractedData, context);
  }


  async saveIbdBiomarkers(ibdBiomarkers, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(ibdBiomarkers) ? ibdBiomarkers : [ibdBiomarkers];
    return await this.saveToCollectionDynamic('ibd_biomarkers', items, patientId, documentId, extractedData, context);
  }


  async saveBiologicTherapy(biologicTherapy, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(biologicTherapy) ? biologicTherapy : [biologicTherapy];
    return await this.saveToCollectionDynamic('biologic_therapy', items, patientId, documentId, extractedData, context);
  }


  async saveExtraintestinalManifestations(extraintestinalManifestations, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(extraintestinalManifestations) ? extraintestinalManifestations : [extraintestinalManifestations];
    return await this.saveToCollectionDynamic('extraintestinal_manifestations', items, patientId, documentId, extractedData, context);
  }


  async saveNutritionalAssessment(nutritionalAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(nutritionalAssessment) ? nutritionalAssessment : [nutritionalAssessment];
    return await this.saveToCollectionDynamic('nutritional_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveIbdSurgicalPlanning(ibdSurgicalPlanning, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(ibdSurgicalPlanning) ? ibdSurgicalPlanning : [ibdSurgicalPlanning];
    return await this.saveToCollectionDynamic('ibd_surgical_planning', items, patientId, documentId, extractedData, context);
  }


  async saveFlareManagement(flareManagement, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(flareManagement) ? flareManagement : [flareManagement];
    return await this.saveToCollectionDynamic('flare_management', items, patientId, documentId, extractedData, context);
  }


  async saveCancerSurveillance(cancerSurveillance, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(cancerSurveillance) ? cancerSurveillance : [cancerSurveillance];
    return await this.saveToCollectionDynamic('cancer_surveillance', items, patientId, documentId, extractedData, context);
  }


  // Geriatric Assessment delegated methods
  async saveFunctionalStatus(functionalStatus, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(functionalStatus) ? functionalStatus : [functionalStatus];
    return await this.saveToCollectionDynamic('functional_status', items, patientId, documentId, extractedData, context);
  }


  async saveGeriatricCognitiveAssessment(geriatricCognitiveAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(geriatricCognitiveAssessment) ? geriatricCognitiveAssessment : [geriatricCognitiveAssessment];
    return await this.saveToCollectionDynamic('geriatric_cognitive_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveFallsPreventionProgramAssessment(fallsRiskAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(fallsRiskAssessment) ? fallsRiskAssessment : [fallsRiskAssessment];
    return await this.saveToCollectionDynamic('falls_prevention_program_assessment', items, patientId, documentId, extractedData, context);
  }


  async savePolypharmacyReview(polypharmacyReview, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(polypharmacyReview) ? polypharmacyReview : [polypharmacyReview];
    return await this.saveToCollectionDynamic('polypharmacy_reviews', items, patientId, documentId, extractedData, context);
  }


  async saveGeriatricNutritionalAssessment(geriatricNutritionalAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(geriatricNutritionalAssessment) ? geriatricNutritionalAssessment : [geriatricNutritionalAssessment];
    return await this.saveToCollectionDynamic('geriatric_nutritional_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveMoodPsychologicalAssessment(moodPsychologicalAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(moodPsychologicalAssessment) ? moodPsychologicalAssessment : [moodPsychologicalAssessment];
    return await this.saveToCollectionDynamic('mood_psychological_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveSocialFunctionalAssessment(socialFunctionalAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(socialFunctionalAssessment) ? socialFunctionalAssessment : [socialFunctionalAssessment];
    return await this.saveToCollectionDynamic('social_functional_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveFrailtyAssessment(frailtyAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(frailtyAssessment) ? frailtyAssessment : [frailtyAssessment];
    return await this.saveToCollectionDynamic('frailty_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveGeriatricCarePlanning(geriatricCarePlanning, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(geriatricCarePlanning) ? geriatricCarePlanning : [geriatricCarePlanning];
    return await this.saveToCollectionDynamic('geriatric_care_planning', items, patientId, documentId, extractedData, context);
  }


  async saveCaregiverAssessment(caregiverAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(caregiverAssessment) ? caregiverAssessment : [caregiverAssessment];
    return await this.saveToCollectionDynamic('caregiver_assessment', items, patientId, documentId, extractedData, context);
  }


  // Nephrology/Renal delegated methods
  async saveCkdAssessment(ckdAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(ckdAssessment) ? ckdAssessment : [ckdAssessment];
    return await this.saveToCollectionDynamic('ckd_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveProteinuriaAssessment(proteinuriaAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(proteinuriaAssessment) ? proteinuriaAssessment : [proteinuriaAssessment];
    return await this.saveToCollectionDynamic('proteinuria_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveDialysisPlanning(dialysisPlanning, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(dialysisPlanning) ? dialysisPlanning : [dialysisPlanning];
    return await this.saveToCollectionDynamic('dialysis_planning', items, patientId, documentId, extractedData, context);
  }


  async saveCurrentDialysis(currentDialysis, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(currentDialysis) ? currentDialysis : [currentDialysis];
    return await this.saveToCollectionDynamic('current_dialysis', items, patientId, documentId, extractedData, context);
  }


  async saveTransplantEvaluation(transplantEvaluation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(transplantEvaluation) ? transplantEvaluation : [transplantEvaluation];
    return await this.saveToCollectionDynamic('transplant_evaluations', items, patientId, documentId, extractedData, context);
  }


  async saveMineralBoneDisease(mineralBoneDisease, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(mineralBoneDisease) ? mineralBoneDisease : [mineralBoneDisease];
    return await this.saveToCollectionDynamic('mineral_bone_disease', items, patientId, documentId, extractedData, context);
  }


  async saveRenalAnemia(renalAnemia, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(renalAnemia) ? renalAnemia : [renalAnemia];
    return await this.saveToCollectionDynamic('renal_anemia', items, patientId, documentId, extractedData, context);
  }


  async saveFluidElectrolyteManagement(fluidElectrolyteManagement, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(fluidElectrolyteManagement) ? fluidElectrolyteManagement : [fluidElectrolyteManagement];
    return await this.saveToCollectionDynamic('fluid_electrolyte_management', items, patientId, documentId, extractedData, context);
  }


  async saveRenalNutrition(renalNutrition, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(renalNutrition) ? renalNutrition : [renalNutrition];
    return await this.saveToCollectionDynamic('renal_nutrition', items, patientId, documentId, extractedData, context);
  }


  async saveMedicationRenalDosing(medicationRenalDosing, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(medicationRenalDosing) ? medicationRenalDosing : [medicationRenalDosing];
    return await this.saveToCollectionDynamic('medication_renal_dosing', items, patientId, documentId, extractedData, context);
  }


  async saveGlomerularDisease(glomerularDisease, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(glomerularDisease) ? glomerularDisease : [glomerularDisease];
    return await this.saveToCollectionDynamic('glomerular_disease', items, patientId, documentId, extractedData, context);
  }


  async saveAcuteKidneyInjury(acuteKidneyInjury, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(acuteKidneyInjury) ? acuteKidneyInjury : [acuteKidneyInjury];
    return await this.saveToCollectionDynamic('acute_kidney_injury', items, patientId, documentId, extractedData, context);
  }


  async savePolycysticKidneyDisease(polycysticKidneyDisease, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(polycysticKidneyDisease) ? polycysticKidneyDisease : [polycysticKidneyDisease];
    return await this.saveToCollectionDynamic('polycystic_kidney_disease', items, patientId, documentId, extractedData, context);
  }


  async saveDiabeticNephropathy(diabeticNephropathy, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(diabeticNephropathy) ? diabeticNephropathy : [diabeticNephropathy];
    return await this.saveToCollectionDynamic('diabetic_nephropathy', items, patientId, documentId, extractedData, context);
  }


  async saveHypertensiveNephropathy(hypertensiveNephropathy, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(hypertensiveNephropathy) ? hypertensiveNephropathy : [hypertensiveNephropathy];
    return await this.saveToCollectionDynamic('hypertensive_nephropathy', items, patientId, documentId, extractedData, context);
  }


  // Neurology/Movement Disorder delegated methods
  async saveMovementDisorderAssessment(movementDisorderAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(movementDisorderAssessment) ? movementDisorderAssessment : [movementDisorderAssessment];
    return await this.saveToCollectionDynamic('movement_disorder_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveParkinsonianFeatures(parkinsonianFeatures, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(parkinsonianFeatures) ? parkinsonianFeatures : [parkinsonianFeatures];
    return await this.saveToCollectionDynamic('parkinsonian_features', items, patientId, documentId, extractedData, context);
  }


  async saveGaitAnalysis(gaitAnalysis, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(gaitAnalysis) ? gaitAnalysis : [gaitAnalysis];
    return await this.saveToCollectionDynamic('gait_analysis', items, patientId, documentId, extractedData, context);
  }


  async saveMotorComplications(motorComplications, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(motorComplications) ? motorComplications : [motorComplications];
    return await this.saveToCollectionDynamic('motor_complications', items, patientId, documentId, extractedData, context);
  }


  async saveNonMotorSymptoms(nonMotorSymptoms, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(nonMotorSymptoms) ? nonMotorSymptoms : [nonMotorSymptoms];
    return await this.saveToCollectionDynamic('non_motor_symptoms', items, patientId, documentId, extractedData, context);
  }


  async saveNeurologicalExam(neurologicalExam, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(neurologicalExam) ? neurologicalExam : [neurologicalExam];
    return await this.saveToCollectionDynamic('neurological_exam', items, patientId, documentId, extractedData, context);
  }


  async saveParkinsonMedications(parkinsonMedications, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(parkinsonMedications) ? parkinsonMedications : [parkinsonMedications];
    return await this.saveToCollectionDynamic('parkinson_medications', items, patientId, documentId, extractedData, context);
  }


  async saveDeepBrainStimulation(deepBrainStimulation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(deepBrainStimulation) ? deepBrainStimulation : [deepBrainStimulation];
    return await this.saveToCollectionDynamic('deep_brain_stimulation', items, patientId, documentId, extractedData, context);
  }


  async saveEpilepsyAssessment(epilepsyAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(epilepsyAssessment) ? epilepsyAssessment : [epilepsyAssessment];
    return await this.saveToCollectionDynamic('epilepsy_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveHeadacheAssessment(headacheAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(headacheAssessment) ? headacheAssessment : [headacheAssessment];
    return await this.saveToCollectionDynamic('headache_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveMultipleSclerosisAssessment(multipleSclerosisAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(multipleSclerosisAssessment) ? multipleSclerosisAssessment : [multipleSclerosisAssessment];
    return await this.saveToCollectionDynamic('multiple_sclerosis_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveStrokeAssessment(strokeAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(strokeAssessment) ? strokeAssessment : [strokeAssessment];
    return await this.saveToCollectionDynamic('stroke_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveDementiaAssessment(dementiaAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(dementiaAssessment) ? dementiaAssessment : [dementiaAssessment];
    return await this.saveToCollectionDynamic('dementia_assessment', items, patientId, documentId, extractedData, context);
  }


  async savePeripheralNeuropathy(peripheralNeuropathy, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(peripheralNeuropathy) ? peripheralNeuropathy : [peripheralNeuropathy];
    return await this.saveToCollectionDynamic('peripheral_neuropathy', items, patientId, documentId, extractedData, context);
  }


  async saveNeuromuscularDisorder(neuromuscularDisorder, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(neuromuscularDisorder) ? neuromuscularDisorder : [neuromuscularDisorder];
    return await this.saveToCollectionDynamic('neuromuscular_disorder', items, patientId, documentId, extractedData, context);
  }


  // Obstetric/Prenatal delegated methods
  async savePrenatalVisit(prenatalVisit, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(prenatalVisit) ? prenatalVisit : [prenatalVisit];
    return await this.saveToCollectionDynamic('prenatal_visits', items, patientId, documentId, extractedData, context);
  }


  async saveMaternalWeightMonitoring(maternalWeightMonitoring, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(maternalWeightMonitoring) ? maternalWeightMonitoring : [maternalWeightMonitoring];
    return await this.saveToCollectionDynamic('maternal_weight_monitoring', items, patientId, documentId, extractedData, context);
  }


  async saveFetalAssessment(fetalAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(fetalAssessment) ? fetalAssessment : [fetalAssessment];
    return await this.saveToCollectionDynamic('fetal_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveContractionMonitoring(contractionMonitoring, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(contractionMonitoring) ? contractionMonitoring : [contractionMonitoring];
    return await this.saveToCollectionDynamic('contraction_monitoring', items, patientId, documentId, extractedData, context);
  }


  async savePregnancySymptoms(pregnancySymptoms, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(pregnancySymptoms) ? pregnancySymptoms : [pregnancySymptoms];
    return await this.saveToCollectionDynamic('pregnancy_symptoms', items, patientId, documentId, extractedData, context);
  }


  async savePrenatalEducation(prenatalEducation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(prenatalEducation) ? prenatalEducation : [prenatalEducation];
    return await this.saveToCollectionDynamic('prenatal_education', items, patientId, documentId, extractedData, context);
  }


  async saveBirthPlan(birthPlan, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(birthPlan) ? birthPlan : [birthPlan];
    return await this.saveToCollectionDynamic('birth_plan', items, patientId, documentId, extractedData, context);
  }


  async savePostpartumPlanning(postpartumPlanning, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(postpartumPlanning) ? postpartumPlanning : [postpartumPlanning];
    return await this.saveToCollectionDynamic('postpartum_planning', items, patientId, documentId, extractedData, context);
  }


  async savePregnancyRiskAssessment(pregnancyRiskAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(pregnancyRiskAssessment) ? pregnancyRiskAssessment : [pregnancyRiskAssessment];
    return await this.saveToCollectionDynamic('pregnancy_risk_assessment', items, patientId, documentId, extractedData, context);
  }


  async savePsychosocialAssessment(...args) {
    return obstetricFieldMappingService.savePsychosocialAssessment(...args);
  }

  async saveCervicalAssessment(cervicalAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(cervicalAssessment) ? cervicalAssessment : [cervicalAssessment];
    return await this.saveToCollectionDynamic('cervical_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveImmunizationRecord(immunizationRecord, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(immunizationRecord) ? immunizationRecord : [immunizationRecord];
    return await this.saveToCollectionDynamic('immunization_record', items, patientId, documentId, extractedData, context);
  }


  async saveObstetricHistory(obstetricHistory, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(obstetricHistory) ? obstetricHistory : [obstetricHistory];
    return await this.saveToCollectionDynamic('obstetric_history', items, patientId, documentId, extractedData, context);
  }


  async saveCurrentPregnancy(currentPregnancy, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(currentPregnancy) ? currentPregnancy : [currentPregnancy];
    return await this.saveToCollectionDynamic('current_pregnancy', items, patientId, documentId, extractedData, context);
  }


  // ===== ONCOLOGY FIELD MAPPINGS =====
  async saveTreatmentSummary(treatmentSummary, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(treatmentSummary) ? treatmentSummary : [treatmentSummary];
    return await this.saveToCollectionDynamic('treatment_summary', items, patientId, documentId, extractedData, context);
  }


  async saveSurgicalOncology(surgicalOncology, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(surgicalOncology) ? surgicalOncology : [surgicalOncology];
    return await this.saveToCollectionDynamic('surgical_oncology', items, patientId, documentId, extractedData, context);
  }


  async saveRadiationOncology(radiationOncology, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(radiationOncology) ? radiationOncology : [radiationOncology];
    return await this.saveToCollectionDynamic('radiation_oncology', items, patientId, documentId, extractedData, context);
  }


  async saveEndocrineTherapy(endocrineTherapy, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(endocrineTherapy) ? endocrineTherapy : [endocrineTherapy];
    return await this.saveToCollectionDynamic('endocrine_therapy', items, patientId, documentId, extractedData, context);
  }


  async saveSurvivorshipCarePlan(survivorshipCarePlan, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(survivorshipCarePlan) ? survivorshipCarePlan : [survivorshipCarePlan];
    return await this.saveToCollectionDynamic('survivorship_care_plan', items, patientId, documentId, extractedData, context);
  }


  async saveCancerRelatedSideEffects(cancerRelatedSideEffects, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(cancerRelatedSideEffects) ? cancerRelatedSideEffects : [cancerRelatedSideEffects];
    return await this.saveToCollectionDynamic('cancer_related_side_effects', items, patientId, documentId, extractedData, context);
  }


  async saveOncologicEmergencies(oncologicEmergencies, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(oncologicEmergencies) ? oncologicEmergencies : [oncologicEmergencies];
    return await this.saveToCollectionDynamic('oncologic_emergencies', items, patientId, documentId, extractedData, context);
  }


  async savePalliativeCare(palliativeCare, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(palliativeCare) ? palliativeCare : [palliativeCare];
    return await this.saveToCollectionDynamic('palliative_care', items, patientId, documentId, extractedData, context);
  }


  async savePsychosocialOncology(psychosocialOncology, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(psychosocialOncology) ? psychosocialOncology : [psychosocialOncology];
    return await this.saveToCollectionDynamic('psychosocial_oncology', items, patientId, documentId, extractedData, context);
  }


  async saveGeneticOncology(geneticOncology, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(geneticOncology) ? geneticOncology : [geneticOncology];
    return await this.saveToCollectionDynamic('genetic_oncology', items, patientId, documentId, extractedData, context);
  }


  async savePrognosticFactors(prognosticFactors, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(prognosticFactors) ? prognosticFactors : [prognosticFactors];
    return await this.saveToCollectionDynamic('prognostic_factors', items, patientId, documentId, extractedData, context);
  }


  async saveIntegrativeOncology(integrativeOncology, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(integrativeOncology) ? integrativeOncology : [integrativeOncology];
    return await this.saveToCollectionDynamic('integrative_oncology', items, patientId, documentId, extractedData, context);
  }


  async saveCancerDiagnosis(cancerDiagnosis, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(cancerDiagnosis) ? cancerDiagnosis : [cancerDiagnosis];
    return await this.saveToCollectionDynamic('cancer_diagnosis', items, patientId, documentId, extractedData, context);
  }


  async saveChemotherapyRegimen(chemotherapyRegimen, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(chemotherapyRegimen) ? chemotherapyRegimen : [chemotherapyRegimen];
    return await this.saveToCollectionDynamic('chemotherapy_regimen', items, patientId, documentId, extractedData, context);
  }


  async saveTumorMarkers(tumorMarkers, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(tumorMarkers) ? tumorMarkers : [tumorMarkers];
    return await this.saveToCollectionDynamic('tumor_markers', items, patientId, documentId, extractedData, context);
  }


  // ===== SURGICAL FIELD MAPPINGS =====
  async saveSurgicalTeam(surgicalTeam, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(surgicalTeam) ? surgicalTeam : [surgicalTeam];
    return await this.saveToCollectionDynamic('surgical_team', items, patientId, documentId, extractedData, context);
  }


  async saveOperativeDetails(operativeDetails, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(operativeDetails) ? operativeDetails : [operativeDetails];
    return await this.saveToCollectionDynamic('operative_details', items, patientId, documentId, extractedData, context);
  }


  async saveAnesthesiaRecord(anesthesiaRecord, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(anesthesiaRecord) ? anesthesiaRecord : [anesthesiaRecord];
    return await this.saveToCollectionDynamic('anesthesia_records', items, patientId, documentId, extractedData, context);
  }


  async saveSurgicalApproach(surgicalApproach, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(surgicalApproach) ? surgicalApproach : [surgicalApproach];
    return await this.saveToCollectionDynamic('surgical_approach', items, patientId, documentId, extractedData, context);
  }


  async saveIntraoperativeFindings(intraoperativeFindings, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(intraoperativeFindings) ? intraoperativeFindings : [intraoperativeFindings];
    return await this.saveToCollectionDynamic('intraoperative_findings', items, patientId, documentId, extractedData, context);
  }


  async saveOperativeTechnique(operativeTechnique, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(operativeTechnique) ? operativeTechnique : [operativeTechnique];
    return await this.saveToCollectionDynamic('operative_technique', items, patientId, documentId, extractedData, context);
  }


  async saveIntraoperativeImaging(intraoperativeImaging, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(intraoperativeImaging) ? intraoperativeImaging : [intraoperativeImaging];
    return await this.saveToCollectionDynamic('intraoperative_imaging', items, patientId, documentId, extractedData, context);
  }


  async saveSurgicalSpecimens(surgicalSpecimens, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(surgicalSpecimens) ? surgicalSpecimens : [surgicalSpecimens];
    return await this.saveToCollectionDynamic('surgical_specimens', items, patientId, documentId, extractedData, context);
  }


  async saveEstimatedBloodLoss(estimatedBloodLoss, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(estimatedBloodLoss) ? estimatedBloodLoss : [estimatedBloodLoss];
    return await this.saveToCollectionDynamic('estimated_blood_loss', items, patientId, documentId, extractedData, context);
  }


  async saveSurgicalComplications(surgicalComplications, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(surgicalComplications) ? surgicalComplications : [surgicalComplications];
    return await this.saveToCollectionDynamic('surgical_complications', items, patientId, documentId, extractedData, context);
  }


  async savePostoperativeOrders(postoperativeOrders, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(postoperativeOrders) ? postoperativeOrders : [postoperativeOrders];
    return await this.saveToCollectionDynamic('postoperative_orders', items, patientId, documentId, extractedData, context);
  }


  async saveSurgicalDischargePlanning(surgicalDischargePlanning, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(surgicalDischargePlanning) ? surgicalDischargePlanning : [surgicalDischargePlanning];
    return await this.saveToCollectionDynamic('surgical_discharge_planning', items, patientId, documentId, extractedData, context);
  }


  // ===== ORTHOPEDIC FIELD MAPPINGS =====
  async saveMechanismOfInjury(mechanismOfInjury, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(mechanismOfInjury) ? mechanismOfInjury : [mechanismOfInjury];
    return await this.saveToCollectionDynamic('mechanism_of_injury', items, patientId, documentId, extractedData, context);
  }


  async saveOrthopedicImaging(orthopedicImaging, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(orthopedicImaging) ? orthopedicImaging : [orthopedicImaging];
    return await this.saveToCollectionDynamic('orthopedic_imaging', items, patientId, documentId, extractedData, context);
  }


  async saveLigamentReconstruction(ligamentReconstruction, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(ligamentReconstruction) ? ligamentReconstruction : [ligamentReconstruction];
    return await this.saveToCollectionDynamic('ligament_reconstruction', items, patientId, documentId, extractedData, context);
  }


  async saveMeniscusRepair(meniscusRepair, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(meniscusRepair) ? meniscusRepair : [meniscusRepair];
    return await this.saveToCollectionDynamic('meniscus_repair', items, patientId, documentId, extractedData, context);
  }


  async saveArticularCartilage(articularCartilage, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(articularCartilage) ? articularCartilage : [articularCartilage];
    return await this.saveToCollectionDynamic('articular_cartilage', items, patientId, documentId, extractedData, context);
  }


  async saveTourniquetData(tourniquetData, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(tourniquetData) ? tourniquetData : [tourniquetData];
    return await this.saveToCollectionDynamic('tourniquet_data', items, patientId, documentId, extractedData, context);
  }


  async savePostOpTesting(postOpTesting, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(postOpTesting) ? postOpTesting : [postOpTesting];
    return await this.saveToCollectionDynamic('post_op_testing', items, patientId, documentId, extractedData, context);
  }


  async saveRehabilitationProtocol(rehabilitationProtocol, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(rehabilitationProtocol) ? rehabilitationProtocol : [rehabilitationProtocol];
    return await this.saveToCollectionDynamic('rehabilitation_protocol', items, patientId, documentId, extractedData, context);
  }


  async saveReturnToSport(returnToSport, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(returnToSport) ? returnToSport : [returnToSport];
    return await this.saveToCollectionDynamic('return_to_sport', items, patientId, documentId, extractedData, context);
  }


  async saveDvtProphylaxis(dvtProphylaxis, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(dvtProphylaxis) ? dvtProphylaxis : [dvtProphylaxis];
    return await this.saveToCollectionDynamic('dvt_prophylaxis', items, patientId, documentId, extractedData, context);
  }


  async saveNeurovascularExam(neurovascularExam, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(neurovascularExam) ? neurovascularExam : [neurovascularExam];
    return await this.saveToCollectionDynamic('neurovascular_exam', items, patientId, documentId, extractedData, context);
  }


  async saveAthleteSpecificData(athleteSpecificData, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(athleteSpecificData) ? athleteSpecificData : [athleteSpecificData];
    return await this.saveToCollectionDynamic('athlete_specific_data', items, patientId, documentId, extractedData, context);
  }


  // ===== PEDIATRIC FIELD MAPPINGS =====
  async saveBirthHistory(birthHistory, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(birthHistory) ? birthHistory : [birthHistory];
    return await this.saveToCollectionDynamic('birth_history', items, patientId, documentId, extractedData, context);
  }


  async saveGrowthParameters(growthParameters, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(growthParameters) ? growthParameters : [growthParameters];
    return await this.saveToCollectionDynamic('growth_parameters', items, patientId, documentId, extractedData, context);
  }


  async saveDevelopmentalMilestones(developmentalMilestones, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(developmentalMilestones) ? developmentalMilestones : [developmentalMilestones];
    return await this.saveToCollectionDynamic('developmental_milestones', items, patientId, documentId, extractedData, context);
  }


  async savePediatricScreening(pediatricScreening, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(pediatricScreening) ? pediatricScreening : [pediatricScreening];
    return await this.saveToCollectionDynamic('pediatric_screening', items, patientId, documentId, extractedData, context);
  }


  async saveImmunizationRecord(...args) {
    return pediatricFieldMappingService.saveImmunizationRecord(...args);
  }

  async saveSchoolPerformance(schoolPerformance, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(schoolPerformance) ? schoolPerformance : [schoolPerformance];
    return await this.saveToCollectionDynamic('school_performance', items, patientId, documentId, extractedData, context);
  }


  async saveNutritionalAssessment(...args) {
    return pediatricFieldMappingService.saveNutritionalAssessment(...args);
  }

  async saveAnticipatoryGuidance(anticipatoryGuidance, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(anticipatoryGuidance) ? anticipatoryGuidance : [anticipatoryGuidance];
    return await this.saveToCollectionDynamic('anticipatory_guidance', items, patientId, documentId, extractedData, context);
  }


  async saveBehavioralAssessment(behavioralAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(behavioralAssessment) ? behavioralAssessment : [behavioralAssessment];
    return await this.saveToCollectionDynamic('behavioral_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveParentalConcerns(parentalConcerns, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(parentalConcerns) ? parentalConcerns : [parentalConcerns];
    return await this.saveToCollectionDynamic('parental_concerns', items, patientId, documentId, extractedData, context);
  }


  async saveWellChildSummary(wellChildSummary, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(wellChildSummary) ? wellChildSummary : [wellChildSummary];
    return await this.saveToCollectionDynamic('well_child_summary', items, patientId, documentId, extractedData, context);
  }


  async saveEarlyChildhoodDevelopment(earlyChildhoodDevelopment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(earlyChildhoodDevelopment) ? earlyChildhoodDevelopment : [earlyChildhoodDevelopment];
    return await this.saveToCollectionDynamic('early_childhood_development', items, patientId, documentId, extractedData, context);
  }


  async saveAdhdAssessment(adhdAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(adhdAssessment) ? adhdAssessment : [adhdAssessment];
    return await this.saveToCollectionDynamic('adhd_assessment', items, patientId, documentId, extractedData, context);
  }


  // ===== PSYCHIATRIC FIELD MAPPINGS =====
  async savePsychiatricHistory(psychiatricHistory, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(psychiatricHistory) ? psychiatricHistory : [psychiatricHistory];
    return await this.saveToCollectionDynamic('psychiatric_history', items, patientId, documentId, extractedData, context);
  }


  async saveMentalStatusExam(mentalStatusExam, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(mentalStatusExam) ? mentalStatusExam : [mentalStatusExam];
    return await this.saveToCollectionDynamic('mental_status_exam', items, patientId, documentId, extractedData, context);
  }


  async saveSuicideRiskAssessment(suicideRiskAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(suicideRiskAssessment) ? suicideRiskAssessment : [suicideRiskAssessment];
    return await this.saveToCollectionDynamic('suicide_risk_assessment', items, patientId, documentId, extractedData, context);
  }


  async savePsychiatricAssessmentScales(psychiatricAssessmentScales, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(psychiatricAssessmentScales) ? psychiatricAssessmentScales : [psychiatricAssessmentScales];
    return await this.saveToCollectionDynamic('psychiatric_assessment_scales', items, patientId, documentId, extractedData, context);
  }


  async saveSubstanceUseAssessment(substanceUseAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(substanceUseAssessment) ? substanceUseAssessment : [substanceUseAssessment];
    return await this.saveToCollectionDynamic('substance_use_assessment', items, patientId, documentId, extractedData, context);
  }


  async savePsychotropicMedications(psychotropicMedications, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(psychotropicMedications) ? psychotropicMedications : [psychotropicMedications];
    return await this.saveToCollectionDynamic('psychotropic_medications', items, patientId, documentId, extractedData, context);
  }


  async savePsychiatricTreatmentPlan(psychiatricTreatmentPlan, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(psychiatricTreatmentPlan) ? psychiatricTreatmentPlan : [psychiatricTreatmentPlan];
    return await this.saveToCollectionDynamic('psychiatric_treatment_plan', items, patientId, documentId, extractedData, context);
  }


  async savePsychosocialFactors(psychosocialFactors, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(psychosocialFactors) ? psychosocialFactors : [psychosocialFactors];
    return await this.saveToCollectionDynamic('psychosocial_factors', items, patientId, documentId, extractedData, context);
  }


  async saveHomicideRiskAssessment(homicideRiskAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(homicideRiskAssessment) ? homicideRiskAssessment : [homicideRiskAssessment];
    return await this.saveToCollectionDynamic('homicide_risk_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveBiopsychosocialFormulation(biopsychosocialFormulation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(biopsychosocialFormulation) ? biopsychosocialFormulation : [biopsychosocialFormulation];
    return await this.saveToCollectionDynamic('biopsychosocial_formulation', items, patientId, documentId, extractedData, context);
  }


  async saveDiagnosticImpression(diagnosticImpression, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(diagnosticImpression) ? diagnosticImpression : [diagnosticImpression];
    return await this.saveToCollectionDynamic('diagnostic_impression', items, patientId, documentId, extractedData, context);
  }


  async saveTreatmentGoals(treatmentGoals, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(treatmentGoals) ? treatmentGoals : [treatmentGoals];
    return await this.saveToCollectionDynamic('treatment_goals', items, patientId, documentId, extractedData, context);
  }


  async saveCareCoordination(careCoordination, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(careCoordination) ? careCoordination : [careCoordination];
    return await this.saveToCollectionDynamic('care_coordination', items, patientId, documentId, extractedData, context);
  }


  async savePsychiatricReview(psychiatricReview, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(psychiatricReview) ? psychiatricReview : [psychiatricReview];
    return await this.saveToCollectionDynamic('psychiatric_review', items, patientId, documentId, extractedData, context);
  }


  async saveFunctionalAssessment(functionalAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(functionalAssessment) ? functionalAssessment : [functionalAssessment];
    return await this.saveToCollectionDynamic('functional_assessments', items, patientId, documentId, extractedData, context);
  }


  // ========== PULMONARY DELEGATIONS ==========
  async savePulmonaryFunctionTests(pulmonaryFunctionTests, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(pulmonaryFunctionTests) ? pulmonaryFunctionTests : [pulmonaryFunctionTests];
    return await this.saveToCollectionDynamic('pulmonary_function_tests', items, patientId, documentId, extractedData, context);
  }


  async saveAsthmaAssessment(asthmaAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(asthmaAssessment) ? asthmaAssessment : [asthmaAssessment];
    return await this.saveToCollectionDynamic('asthma_assessments', items, patientId, documentId, extractedData, context);
  }


  async saveAsthmaActionPlan(asthmaActionPlan, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(asthmaActionPlan) ? asthmaActionPlan : [asthmaActionPlan];
    return await this.saveToCollectionDynamic('asthma_action_plan', items, patientId, documentId, extractedData, context);
  }


  async saveRespiratoryMedications(respiratoryMedications, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(respiratoryMedications) ? respiratoryMedications : [respiratoryMedications];
    return await this.saveToCollectionDynamic('respiratory_medications', items, patientId, documentId, extractedData, context);
  }


  async saveAllergyAssessment(allergyAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(allergyAssessment) ? allergyAssessment : [allergyAssessment];
    return await this.saveToCollectionDynamic('allergy_assessments', items, patientId, documentId, extractedData, context);
  }


  async saveEnvironmentalExposures(environmentalExposures, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(environmentalExposures) ? environmentalExposures : [environmentalExposures];
    return await this.saveToCollectionDynamic('environmental_exposures', items, patientId, documentId, extractedData, context);
  }


  async saveCopdAssessment(copdAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(copdAssessment) ? copdAssessment : [copdAssessment];
    return await this.saveToCollectionDynamic('copd_assessments', items, patientId, documentId, extractedData, context);
  }


  async savePulmonaryImaging(pulmonaryImaging, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(pulmonaryImaging) ? pulmonaryImaging : [pulmonaryImaging];
    return await this.saveToCollectionDynamic('pulmonary_imaging', items, patientId, documentId, extractedData, context);
  }


  async saveRespiratoryInfections(respiratoryInfections, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(respiratoryInfections) ? respiratoryInfections : [respiratoryInfections];
    return await this.saveToCollectionDynamic('respiratory_infections', items, patientId, documentId, extractedData, context);
  }


  async savePulmonaryRehabilitation(pulmonaryRehabilitation, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(pulmonaryRehabilitation) ? pulmonaryRehabilitation : [pulmonaryRehabilitation];
    return await this.saveToCollectionDynamic('pulmonary_rehabilitation', items, patientId, documentId, extractedData, context);
  }


  async saveRespiratoryDevices(respiratoryDevices, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(respiratoryDevices) ? respiratoryDevices : [respiratoryDevices];
    return await this.saveToCollectionDynamic('respiratory_devices', items, patientId, documentId, extractedData, context);
  }


  // ========== RHEUMATOLOGY DELEGATIONS ==========
  async saveRheumatologicAssessment(rheumatologicAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(rheumatologicAssessment) ? rheumatologicAssessment : [rheumatologicAssessment];
    return await this.saveToCollectionDynamic('rheumatologic_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveAutoantibodyProfile(autoantibodyProfile, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(autoantibodyProfile) ? autoantibodyProfile : [autoantibodyProfile];
    return await this.saveToCollectionDynamic('autoantibody_profile', items, patientId, documentId, extractedData, context);
  }


  async saveInflammatoryMarkers(inflammatoryMarkers, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(inflammatoryMarkers) ? inflammatoryMarkers : [inflammatoryMarkers];
    return await this.saveToCollectionDynamic('inflammatory_markers', items, patientId, documentId, extractedData, context);
  }


  async saveConnectiveTissueDiseaseAssessment(connectiveTissueDiseaseAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(connectiveTissueDiseaseAssessment) ? connectiveTissueDiseaseAssessment : [connectiveTissueDiseaseAssessment];
    return await this.saveToCollectionDynamic('connective_tissue_disease_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveLupusAssessment(lupusAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(lupusAssessment) ? lupusAssessment : [lupusAssessment];
    return await this.saveToCollectionDynamic('lupus_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveRheumatoidArthritisAssessment(rheumatoidArthritisAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(rheumatoidArthritisAssessment) ? rheumatoidArthritisAssessment : [rheumatoidArthritisAssessment];
    return await this.saveToCollectionDynamic('rheumatoid_arthritis_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveVascularSurgeryAssessment(vascularSurgeryAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(vascularSurgeryAssessment) ? vascularSurgeryAssessment : [vascularSurgeryAssessment];
    return await this.saveToCollectionDynamic('vascular_surgery_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveJobHazardAnalysis(jobHazardAnalysis, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(jobHazardAnalysis) ? jobHazardAnalysis : [jobHazardAnalysis];
    return await this.saveToCollectionDynamic('job_hazard_analysis', items, patientId, documentId, extractedData, context);
  }


  async saveVascularBypassSurgery(vascularBypassSurgery, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(vascularBypassSurgery) ? vascularBypassSurgery : [vascularBypassSurgery];
    return await this.saveToCollectionDynamic('vascular_bypass_surgery', items, patientId, documentId, extractedData, context);
  }


  async saveVenousInsufficiencyAssessment(venousInsufficiencyAssessment, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(venousInsufficiencyAssessment) ? venousInsufficiencyAssessment : [venousInsufficiencyAssessment];
    return await this.saveToCollectionDynamic('venous_insufficiency_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveAorticAneurysmSurveillance(aorticAneurysmSurveillance, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(aorticAneurysmSurveillance) ? aorticAneurysmSurveillance : [aorticAneurysmSurveillance];
    return await this.saveToCollectionDynamic('aortic_aneurysm_surveillance', items, patientId, documentId, extractedData, context);
  }


  async saveTraumaFlowSheets(traumaFlowSheets, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(traumaFlowSheets) ? traumaFlowSheets : [traumaFlowSheets];
    return await this.saveToCollectionDynamic('trauma_flow_sheets', items, patientId, documentId, extractedData, context);
  }


  async saveTraumaAssessment(traumaAssessment, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(traumaAssessment) ? traumaAssessment : [traumaAssessment];
    return await this.saveToCollectionDynamic('trauma_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveTraumaScoring(traumaScoring, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(traumaScoring) ? traumaScoring : [traumaScoring];
    return await this.saveToCollectionDynamic('trauma_scoring', items, patientId, documentId, extractedData, context);
  }


  async saveEmergencyProcedures(emergencyProcedures, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(emergencyProcedures) ? emergencyProcedures : [emergencyProcedures];
    return await this.saveToCollectionDynamic('emergency_procedures', items, patientId, documentId, extractedData, context);
  }


  async saveImmunizationSchedule(immunizationSchedule, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(immunizationSchedule) ? immunizationSchedule : [immunizationSchedule];
    return await this.saveToCollectionDynamic('immunization_schedule', items, patientId, documentId, extractedData, context);
  }


  async saveTravelVaccinationRecords(travelVaccinationRecords, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(travelVaccinationRecords) ? travelVaccinationRecords : [travelVaccinationRecords];
    return await this.saveToCollectionDynamic('travel_vaccination_records', items, patientId, documentId, extractedData, context);
  }


  async saveFacialTraumaAssessment(facialTraumaAssessment, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(facialTraumaAssessment) ? facialTraumaAssessment : [facialTraumaAssessment];
    return await this.saveToCollectionDynamic('facial_trauma_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveImmediateRecommendations(immediateRecommendations, patientId, documentId, extractedData, context) {
    // Uses saveToCollectionDynamic (reads unified schema dynamically)
    const items = Array.isArray(immediateRecommendations) ? immediateRecommendations : [immediateRecommendations];
    return await this.saveToCollectionDynamic('immediate_recommendations', items, patientId, documentId, extractedData, context);
  }


  async saveVasculitisAssessment(vasculitisAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(vasculitisAssessment) ? vasculitisAssessment : [vasculitisAssessment];
    return await this.saveToCollectionDynamic('vasculitis_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveSpondyloarthritisAssessment(spondyloarthritisAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(spondyloarthritisAssessment) ? spondyloarthritisAssessment : [spondyloarthritisAssessment];
    return await this.saveToCollectionDynamic('spondyloarthritis_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveMyositisAssessment(myositisAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(myositisAssessment) ? myositisAssessment : [myositisAssessment];
    return await this.saveToCollectionDynamic('myositis_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveSjogrensSyndromeAssessment(sjogrensSyndromeAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(sjogrensSyndromeAssessment) ? sjogrensSyndromeAssessment : [sjogrensSyndromeAssessment];
    return await this.saveToCollectionDynamic('sjogrens_syndrome_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveSclerodermaAssessment(sclerodermaAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(sclerodermaAssessment) ? sclerodermaAssessment : [sclerodermaAssessment];
    return await this.saveToCollectionDynamic('scleroderma_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveGoutAssessment(goutAssessment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(goutAssessment) ? goutAssessment : [goutAssessment];
    return await this.saveToCollectionDynamic('gout_assessment', items, patientId, documentId, extractedData, context);
  }


  async saveRheumatologicTreatment(rheumatologicTreatment, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(rheumatologicTreatment) ? rheumatologicTreatment : [rheumatologicTreatment];
    return await this.saveToCollectionDynamic('rheumatologic_treatment', items, patientId, documentId, extractedData, context);
  }


  async saveRheumatologicMonitoring(rheumatologicMonitoring, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(rheumatologicMonitoring) ? rheumatologicMonitoring : [rheumatologicMonitoring];
    return await this.saveToCollectionDynamic('rheumatologic_monitoring', items, patientId, documentId, extractedData, context);
  }


  // ===== NEW HANDLERS FOR 6 MISSING FIELDS =====

  async saveTreatmentPlan(treatmentPlan, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(treatmentPlan) ? treatmentPlan : [treatmentPlan];
    return await this.saveToCollectionDynamic('treatment_plans', items, patientId, documentId, extractedData, context);
  }


  async saveMonitoringPlan(monitoringPlan, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(monitoringPlan) ? monitoringPlan : [monitoringPlan];
    return await this.saveToCollectionDynamic('monitoring_plans', items, patientId, documentId, extractedData, context);
  }


  async saveReferrals(referrals, patientId, documentId, extractedData, context) {
    // MIGRATED TO USE saveToCollectionDynamic (reads unified schema dynamically)
    // This ensures field names match what Claude extracted from tool schemas
    const items = Array.isArray(referrals) ? referrals : [referrals];
    return await this.saveToCollectionDynamic('referrals', items, patientId, documentId, extractedData, context);
  }


  async savePulmonaryFunctionTests(pft, patientId, documentId, extractedData, context) {
    try {
      const pftData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        date: extractedData.date ? new Date(extractedData.date) : new Date(),
        preBronchodilator: pft.preBronchodilator || {},
        postBronchodilator: pft.postBronchodilator || {},
        reversibility: pft.reversibility || '',
        interpretation: pft.interpretation || '',
        technician: pft.technician || '',
        qualityGrade: pft.qualityGrade || '',
        provider: extractedData.providers?.primary || extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('pulmonary_function_tests', pftData, context);
      return { success: true };
    } catch (error) {
      console.error('[medicalFieldMappingService] Error saving pulmonary function tests:', error);
      return { success: false, error: error.message };
    }
  }

  async saveAsthmaAssessment(asthma, patientId, documentId, extractedData, context) {
    try {
      const asthmaData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        date: extractedData.date ? new Date(extractedData.date) : new Date(),
        severity: asthma.severity || '',
        control: asthma.control || '',
        exacerbationHistory: asthma.exacerbationHistory || [],
        triggers: asthma.triggers || [],
        peakFlowPersonalBest: asthma.peakFlowPersonalBest || {},
        fenoLevel: asthma.fenoLevel || '',
        nocturnal: asthma.nocturnal || '',
        exerciseLimitation: asthma.exerciseLimitation || '',
        rescueUseFrequency: asthma.rescueUseFrequency || '',
        provider: extractedData.providers?.primary || extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('asthma_assessments', asthmaData, context);
      return { success: true };
    } catch (error) {
      console.error('[medicalFieldMappingService] Error saving asthma assessment:', error);
      return { success: false, error: error.message };
    }
  }

  async saveAllergyAssessment(allergy, patientId, documentId, extractedData, context) {
    try {
      const allergyData = {
        patientId: new ObjectId(patientId),
        documentId: documentId,
        date: extractedData.date ? new Date(extractedData.date) : new Date(),
        environmentalAllergens: allergy.environmentalAllergens || [],
        totalIge: allergy.totalIge || '',
        eosinophilCount: allergy.eosinophilCount || '',
        skinTestResults: allergy.skinTestResults || [],
        specificIgE: allergy.specificIgE || {},
        provider: extractedData.providers?.primary || extractedData.providerName || '',
        source: 'document_analysis',
        aiProcessed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('allergy_assessments', allergyData, context);
      return { success: true };
    } catch (error) {
      console.error('[medicalFieldMappingService] Error saving allergy assessment:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MedicalFieldMappingService();
