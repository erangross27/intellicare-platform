// Patient Management Context - Barrel Export
// Manages patient records, consent, and portal features

// Feature Modules
exports.records = require('./feature-records');
exports.consent = require('./feature-consent');
exports.portal = require('./feature-portal');

// Data Access
exports.api = require('./data-access-api');

// Domain Models
exports.models = require('./domain-models');

// Utilities
exports.validators = require('./util-validators');

// Context Metadata
exports.contextInfo = {
  name: 'patient-management',
  description: 'Patient Management bounded context',
  services: [
    'patientDataEnrichmentService',
    'patientDeletionService', 
    'patientPopulationAnalyticsService',
    'patientPortalMessagingService',
    'consentManagementService'
  ],
  features: ['records', 'consent', 'portal'],
  compliance: ['HIPAA', 'GDPR']
};