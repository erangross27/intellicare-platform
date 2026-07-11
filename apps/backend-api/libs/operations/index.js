/**
 * Operations Context - Barrel Export
 * System operations, maintenance, backup, and deployment management
 */

// Feature modules
const backupFeature = require('./feature-backup');
const recoveryFeature = require('./feature-recovery');
const maintenanceFeature = require('./feature-maintenance');
const deploymentFeature = require('./feature-deployment');

// Data access layer
const operationsDataAccess = require('./data-access-ops');

// Domain models
const operationsDomain = require('./domain-operations');

// Utilities
const schedulingUtil = require('./util-scheduling');

module.exports = {
  // Features
  backup: backupFeature,
  recovery: recoveryFeature,
  maintenance: maintenanceFeature,
  deployment: deploymentFeature,
  
  // Data layer
  dataAccess: operationsDataAccess,
  
  // Domain
  domain: operationsDomain,
  
  // Utilities
  scheduling: schedulingUtil
};