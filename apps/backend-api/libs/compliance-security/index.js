// Compliance & Security Context Barrel Export
// Critical security context for regulatory and security operations
module.exports = {
  // Feature: Audit Services
  ...require('./feature-audit/services'),
  
  // Feature: Compliance Services  
  ...require('./feature-compliance/services'),
  
  // Feature: Encryption Services
  ...require('./feature-encryption/services'),
  
  // Feature: Authentication Services
  ...require('./feature-auth/services'),
  
  // Feature: Security Monitoring
  ...require('./feature-monitoring/services'),
  
  // Data Access Layer
  ...require('./data-access-security'),
  
  // Domain Models
  ...require('./domain-security/models'),
  
  // Domain Interfaces
  ...require('./domain-security/interfaces'),
  
  // HIPAA Utilities
  ...require('./util-hipaa')
};