/**
 * Compliance Security Feature Audit - Library Exports
 * DDD/NX Architecture Export Index
 */

// Export Immutable Audit Service
const ImmutableAuditService = require('./src/lib/immutable-audit-service');

// Export all audit-related services
module.exports = {
  ImmutableAuditService,
  
  // Re-export with legacy name for compatibility
  immutableAuditService: ImmutableAuditService
};