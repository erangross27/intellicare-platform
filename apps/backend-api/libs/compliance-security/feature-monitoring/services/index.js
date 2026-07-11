// Security Monitoring Services Barrel Export
module.exports = {
  SecurityHeaderValidator: require('./securityHeaderValidator'),
  SecurityMonitoringService: require('./securityMonitoringService'),
  SecurityAlerts: require('./securityAlerts'),
  SecurityChaosService: require('./securityChaosService'),
  SecurityTrainingService: require('./securityTrainingService'),
  SecurityHeadersOptimizationService: require('./securityHeadersOptimizationService')
};