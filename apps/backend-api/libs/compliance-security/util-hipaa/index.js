// HIPAA Utilities Barrel Export
module.exports = {
  PHIDetection: require('./phiDetection'),
  AuditTrailGenerator: require('./auditTrailGenerator'),
  BreachNotifier: require('./breachNotifier'),
  AccessLogger: require('./accessLogger'),
  HIPAAValidator: require('./hipaaValidator'),
  ComplianceChecker: require('./complianceChecker')
};