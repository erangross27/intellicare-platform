// Security Domain Interfaces
module.exports = {
  IAuditService: require('./IAuditService'),
  ISecurityMonitor: require('./ISecurityMonitor'),
  IComplianceReporter: require('./IComplianceReporter'),
  IEncryptionProvider: require('./IEncryptionProvider'),
  IAccessController: require('./IAccessController')
};