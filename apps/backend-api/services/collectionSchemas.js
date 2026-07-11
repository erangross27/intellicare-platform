/**
 * Collection Schemas Service
 *
 * UPDATED November 2025: Now uses unified schema system (unifiedMedicalSchemas.js)
 * as single source of truth for all 758 medical collections.
 *
 * This service ensures data integrity and proper field mapping
 * for all medical document types in the system.
 */

const { ObjectId } = require('mongodb');
const unifiedMedicalSchemas = require('./unifiedMedicalSchemas');

class CollectionSchemas {
  constructor() {
    // Universal fields that are ALWAYS handled by separate collections
    // These should NEVER be dumped into additionalData
    this.universalFieldsToExclude = [
      // Patient Demographics (handled separately)
      'patientName', 'dateOfBirth', 'age', 'gender', 'race', 'ethnicity',

      // Core Medical Data (saved to separate collections by medicalFieldMappingService)
      'medications',           // → medications collection
      'dischargeMedications',  // → medications collection
      'allergies',            // → allergies collection
      'diagnoses',            // → diagnoses collection
      'labResults',           // → lab_results collection
      'imaging',              // → imaging_reports collection
      'vitalSigns',           // → vital_signs collection
      'vitalSignsTable',      // → vital_signs_logs collection
      'procedures',           // → medical_procedures collection
      'vaccinations',         // → vaccinations collection
      'followUpAppointments', // → appointments collection
      'medicalHistory',       // → past_medical_history collection
      'riskFactors',          // → risk_factors collection

      // AI-Generated Intelligence (saved to separate collections)
      'clinicalDecisionSupport',        // → clinical_decision_support
      'intelligentRecommendations',     // → intelligent_recommendations
      'trendingAnalysis',               // → trending_analysis
      'patientSpecificCarePlan',        // → patient_specific_care_plan
      'followUpIntelligence',           // → follow_up_intelligence
      'medicationsOptimizations',       // → medication_optimization
      'medicationOptimizations',        // → medication_optimization (alias)
      'patientEducationContext',        // → patient_education_context
      'guidelineCompliance',            // → guideline_compliance
      'outcomesPrediction',             // → outcomes_prediction
      'careGaps',                       // → care_gaps
      'doctorsMedicationsRecommendations',              // → recommendations collection (NEW)
      'doctorsMedicationsRecommendationsOptimizations', // → medication_optimization (NEW)

      // Clinical Data (saved to separate collections)
      'clinicalScores',       // → clinical_scores collection
      'pathologyFindings',    // → pathology_reports collection
      'implants',             // → medical_devices collection
      'treatmentCourse',      // → treatment_courses collection
      'patientEducation',     // → patient_education_records collection
      // REMOVED: chiefComplaint, historyOfPresentIllness, physicalExamination
      // These fields MUST be in unified document for doctor review (complete admission note)
      // They will ALSO be saved to granular collections via handlers

      // New Universal Fields (6 missing fields added Oct 2025)
      'treatmentPlan',        // → treatment_plans collection
      'monitoringPlan',       // → monitoring_plans collection
      'referrals',            // → referrals collection
      'pulmonaryFunctionTests',   // → pulmonary_function_tests collection
      'asthmaAssessment',     // → asthma_assessments collection
      'allergyAssessment',    // → allergy_assessments collection
      'challengeTests',       // → challenge_tests collection (Food/Drug/Aspirin/Exercise tests)

      // Neurosurgery/Radiology Fields (routed to specialized collections)
      'flexibleData',         // → handled by neurosurgeryFieldMappingService (fMRI, tractography, tumor characteristics)

      // Metadata
      'category', 'patientId', 'documentId', 'source', 'documentType', 'documentDate',
    ];

    // Base fields that every collection should have (kept for backward compatibility)
    this.baseFields = {
      _id: { type: 'ObjectId', auto: true },
      patientId: { type: 'ObjectId', required: true },
      documentId: { type: 'string', required: false },
      createdAt: { type: 'Date', auto: true },
      updatedAt: { type: 'Date', auto: true },
      source: { type: 'string', default: 'document_analysis' },
      aiProcessed: { type: 'boolean', default: true }
    };

    // UPDATED: Load schemas from unified source instead of building inline
    this.schemas = this.loadSchemasFromUnified();

    console.log(`✅ CollectionSchemas initialized with ${Object.keys(this.schemas).length} schemas from unified source`);
    console.log(`✅ Universal field exclusion list: ${this.universalFieldsToExclude.length} fields`);
  }

  /**
   * Load all schemas from unified medical schemas (storage view)
   * Replaces the old buildAllSchemas() method
   */
  loadSchemasFromUnified() {
    const allCollections = unifiedMedicalSchemas.getAllCollections();
    const schemas = {};

    for (const collectionName of allCollections) {
      // Get storage schema (all storable fields) from unified source
      schemas[collectionName] = unifiedMedicalSchemas.getStorageSchema(collectionName);
    }

    // Add generic schema for backward compatibility
    schemas.generic = { ...this.baseFields };

    return schemas;
  }

  /**
   * Get schema for a specific collection
   * Returns schema from unified source
   */
  getSchema(collectionName) {
    return this.schemas[collectionName] || this.schemas.generic;
  }

  /**
   * Transform data according to schema rules
   * Validates and transforms field values based on schema types
   */
  transformData(data, schema) {
    const transformed = {};

    for (const [key, value] of Object.entries(data)) {
      const fieldDef = schema[key];

      if (!fieldDef) {
        // Keep unknown fields as-is
        transformed[key] = value;
        continue;
      }

      // Apply transformations based on field type
      if (fieldDef.type === 'Date' && value) {
        transformed[key] = new Date(value);
      } else if (fieldDef.type === 'ObjectId' && value) {
        transformed[key] = new ObjectId(value);
      } else if (fieldDef.type === 'number' && value) {
        transformed[key] = Number(value);
      } else if (fieldDef.type === 'boolean') {
        transformed[key] = Boolean(value);
      } else {
        transformed[key] = value;
      }
    }

    return transformed;
  }

  // ============= REMOVED buildAllSchemas_DEPRECATED() =============
  // This 1,320-line method was removed November 2025
  // All schemas now loaded from unifiedMedicalSchemas.js
  // The old method can be found in git history if needed for reference
}

// Export singleton instance
module.exports = new CollectionSchemas();
