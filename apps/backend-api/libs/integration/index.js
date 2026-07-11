// Integration Context Barrel Export
// External API connections and standards compliance
module.exports = {
  // Feature: FDA Integration
  ...require('./feature-fda/services'),
  
  // Feature: CDC Integration  
  ...require('./feature-cdc/services'),
  
  // Feature: Medicare/Medicaid Integration
  ...require('./feature-medicare/services'),
  
  // Feature: HL7 Standards
  ...require('./feature-hl7/services'),
  
  // Feature: FHIR Standards
  ...require('./feature-fhir/services'),
  
  // Data Access Layer
  ...require('./data-access-external'),
  
  // Domain Models
  ...require('./domain-integration/models'),
  
  // Domain Interfaces
  ...require('./domain-integration/interfaces'),
  
  // API Adapters
  ...require('./util-adapters')
};