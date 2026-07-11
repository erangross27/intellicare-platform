// Clinical Care Context - Barrel Export
// Manages medical workflows, diagnosis, treatment, and prescriptions

// Feature Modules
exports.diagnosis = require('./feature-diagnosis');
exports.treatment = require('./feature-treatment');
exports.prescription = require('./feature-prescription');
exports.notes = require('./feature-notes');

// Data Access
exports.medical = require('./data-access-medical');

// Domain Models
exports.domain = require('./domain-clinical');

// Utilities
exports.utilities = require('./util-medical');

// Context Metadata
exports.contextInfo = {
  name: 'clinical-care',
  description: 'Clinical Care bounded context for medical workflows',
  services: [
    'clinicalAnalyticsService',
    'clinicalDecisionSupport', 
    'clinicalNotesService',
    'clinicalResearchService',
    'diagnosisSupportService',
    'treatmentPlanningService',
    'treatmentRecommender',
    'prescriptionGenerator',
    'allergyChecker',
    'drugInteractionService'
  ],
  features: ['diagnosis', 'treatment', 'prescription', 'notes'],
  compliance: ['FDA', 'FHIR', 'HIPAA']
};