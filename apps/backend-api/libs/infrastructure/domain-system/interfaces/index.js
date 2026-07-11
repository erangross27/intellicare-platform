// System Domain Interfaces
module.exports = {
  IServiceOrchestrator: require('./IServiceOrchestrator'),
  IHealthMonitor: require('./IHealthMonitor'),
  IConnectionManager: require('./IConnectionManager'),
  ICircuitBreaker: require('./ICircuitBreaker'),
  ISystemMetricsCollector: require('./ISystemMetricsCollector')
};