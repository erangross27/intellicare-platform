/**
 * Collection Display Configuration
 *
 * Defines how each collection should be displayed in the artifact panel:
 * - GRID: Shows all items in a formatted table (uses grid configs)
 * - DOCUMENT: Shows list of documents, then detail view (for rich content)
 */

const DISPLAY_MODE = {
  GRID: 'grid',
  DOCUMENT: 'document'
};

/**
 * AI/Analysis collections that need rich document display
 * These have complex nested structures that don't fit in a grid
 */
const DOCUMENT_MODE_COLLECTIONS = [
  // Patient Information
  'patient_details',

  // AI-Generated Clinical Insights
  'clinical_decision_support',
  'intelligent_recommendations',
  'recommendations',
  'trending_analysis',
  'patient_specific_care_plan',
  'medication_optimization',
  'follow_up_intelligence',
  'patient_education_context',
  'quality_metrics',
  'care_gaps',
  'clinical_scores',
  'outcomes_prediction',
  'guideline_compliance',
  'doctors_medications_recommendations_optimizations',

  // Medication Collections (complex data, better as documents)
  'current_medications',
  'doctors_medications_recommendations',
  'medications_optimizations',
  'medications',

  // Complex Assessments
  'psychiatric_evaluations',
  'neuropsychological_assessments',
  'geriatric_assessments',
  'functional_assessment',
  'allergy_assessment',
  'allergy_immunology_assessment',
  'asthma_assessments',  // Asthma severity, control, and exacerbation assessments
  'physical_examinations',
  'anesthesia_records',  // Complex pre-op assessments with nested structures
  'cardiology_admission_notes',  // Complex cardiology admission with nested cardiac data

  // Diagnoses
  'diagnoses',

  // Lab Results (with medical interpretations)
  'lab_results',

  // Long-form Clinical Notes
  'consultation_notes',
  'progress_notes',
  'discharge_summaries',
  'hospital_discharge_summaries',
  'emergency_discharge_summaries',
  'operative_reports',
  'admission_assessments',
  'hospital_admission_notes',
  'history_present_illness',

  // Complex Reports
  'pathology_reports',
  'biopsy_reports',
  'case_summaries',
  'second_opinion_reports',
  'prognosis',

  // Care Planning
  'care_coordination_notes',
  'assessment_plans',
  'treatment_courses',
  'care_coordination',
  'monitoring_plan',

  // Patient Education Records
  'patient_education_records'
];

/**
 * Collections stored in unified_medical_documents collection
 * These categories are stored as unified documents with category field
 * rather than in separate granular collections
 */
const UNIFIED_DOCUMENT_COLLECTIONS = [
  // Medical Record Collections
  'cardiology_admission_notes',
  'anesthesia_records',
  'hospital_discharge_summaries',
  // Add more unified collections here as they are migrated
];

/**
 * Get display mode for a collection
 * @param {string} collectionName - Name of the collection
 * @returns {string} 'grid' or 'document'
 */
function getDisplayMode(collectionName) {
  if (DOCUMENT_MODE_COLLECTIONS.includes(collectionName)) {
    return DISPLAY_MODE.DOCUMENT;
  }
  return DISPLAY_MODE.GRID;
}

/**
 * Check if collection uses grid display
 * @param {string} collectionName - Name of the collection
 * @returns {boolean}
 */
function isGridMode(collectionName) {
  return getDisplayMode(collectionName) === DISPLAY_MODE.GRID;
}

/**
 * Check if collection uses document display
 * @param {string} collectionName - Name of the collection
 * @returns {boolean}
 */
function isDocumentMode(collectionName) {
  return getDisplayMode(collectionName) === DISPLAY_MODE.DOCUMENT;
}

/**
 * Check if collection is stored in unified_medical_documents
 * @param {string} collectionName - Name of the collection
 * @returns {boolean}
 */
function isUnifiedCollection(collectionName) {
  return UNIFIED_DOCUMENT_COLLECTIONS.includes(collectionName);
}

module.exports = {
  DISPLAY_MODE,
  DOCUMENT_MODE_COLLECTIONS,
  UNIFIED_DOCUMENT_COLLECTIONS,
  getDisplayMode,
  isGridMode,
  isDocumentMode,
  isUnifiedCollection
};
