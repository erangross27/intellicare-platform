// Infrastructure Context Barrel Export
// Core system services for reliability and performance
module.exports = {
  // Feature: Service Orchestration
  ...require('./feature-orchestration/services'),
  
  // Feature: Database Management
  ...require('./feature-database/services'),
  
  // Feature: Caching Layer
  ...require('./feature-cache/services'),
  
  // Feature: System Monitoring
  ...require('./feature-monitoring/services'),
  
  // Data Access Layer
  ...require('./data-access-infra'),
  
  // Domain Models
  ...require('./domain-system/models'),
  
  // Domain Interfaces
  ...require('./domain-system/interfaces'),
  
  // Pooling Utilities
  ...require('./util-pooling')
};