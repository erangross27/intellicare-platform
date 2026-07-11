// Medical Records Context - Barrel Export
// Manages EMR, document management, imaging, and lab results

// Feature Modules
exports.emr = require('./feature-emr');
exports.documents = require('./feature-documents');
exports.imaging = require('./feature-imaging');
exports.lab = require('./feature-lab');

// Data Access
exports.records = require('./data-access-records');

// Domain Models  
exports.domain = require('./domain-records');

// Utilities
exports.parsers = require('./util-parsers');

// Context Metadata
exports.contextInfo = {
  name: 'medical-records',
  description: 'Medical Records bounded context for EMR and document management',
  services: [
    'documentAnalysisService',
    'medicalParsingService',
    'batchDocumentProcessor', 
    'imagingService',
    'labResultsService',
    'recordsManagementService',
    'documentationService',
    'medicalModelService'
  ],
  features: ['emr', 'documents', 'imaging', 'lab'],
  compliance: ['HIPAA', 'DICOM', 'HL7', 'FHIR']
};