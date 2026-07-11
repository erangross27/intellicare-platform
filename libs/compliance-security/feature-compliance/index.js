/**
 * Compliance Security Feature Compliance - Library Exports
 * DDD/NX Architecture Export Index
 */

// Export HIPAA Compliance Service
const HIPAAComplianceService = require('./src/lib/hipaa-compliance-service');

// Export all compliance-related services
module.exports = {
  HIPAAComplianceService,
  
  // Re-export with legacy name for compatibility
  hipaaComplianceService: HIPAAComplianceService
};