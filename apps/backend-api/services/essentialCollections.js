/**
 * Essential Medical Collections - Core 50 collections for batch extraction
 *
 * Reduced from 676 to 50 most commonly used collections to improve
 * Claude's extraction performance by reducing cognitive load.
 *
 * Selection criteria:
 * - Present in majority of medical documents
 * - Critical for clinical decision making
 * - Broad specialty coverage
 *
 * Created: November 2025
 */

module.exports = [
  // ADMINISTRATIVE (3) - Always present
  'administrative_data',
  'patient',
  'providers',

  // CLINICAL BASICS (10) - Core medical data
  'medications',
  'allergies',
  'diagnoses',
  'problems',
  'chief_complaints',
  'history_present_illness',
  'past_medical_history',
  'family_history',
  'social_history',
  'immunizations',

  // VITAL SIGNS & MEASUREMENTS (4)
  'vital_signs',
  'physical_measurements',
  'pain_scores',
  'functional_status',

  // LABS & DIAGNOSTICS (8)
  'lab_results',
  'lab_orders',
  'chemistry_panel',
  'hematology_results',
  'urinalysis_results',
  'microbiology_reports',
  'pathology_reports',
  'imaging_reports',

  // PROCEDURES (3)
  'medical_procedures',
  'surgical_procedures',
  'procedure_orders',

  // CLINICAL ASSESSMENTS (7)
  'physical_exam_findings',
  'review_of_systems',
  'assessment_plans',
  'progress_notes',
  'discharge_summaries',
  'consultations',
  'referrals',

  // CARE COORDINATION (6)
  'follow_up_appointments',
  'emergency_information',
  'care_coordination_notes',
  'treatment_summary',
  'care_gaps',
  'risk_factors',

  // SPECIALTY-SPECIFIC (5) - Most common
  'cardiology_consultations',
  'diabetes_management_notes',
  'pulmonology_consultations',
  'echo_reports',
  'ecg_reports',

  // ORDERS & PRESCRIPTIONS (4)
  'prescriptions',
  'medication_orders',
  'nutrition_orders',
  'therapy_orders'
];

// Total: 50 collections
