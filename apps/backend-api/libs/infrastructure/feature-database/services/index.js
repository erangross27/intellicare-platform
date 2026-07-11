// Database Management Services Barrel Export
module.exports = {
  ConnectionPoolManager: require('./connectionPoolManager'),
  DatabaseConnectionProvider: require('./databaseConnectionProvider'),
  DatabaseEventBus: require('./databaseEventBus'),
  ClinicDatabaseManager: require('./clinicDatabaseManager'),
  DBOptimizationService: require('./dbOptimizationService')
};