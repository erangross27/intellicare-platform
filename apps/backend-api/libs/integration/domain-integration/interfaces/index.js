// Integration Domain Interfaces
module.exports = {
  IExternalAPIProvider: require('./IExternalAPIProvider'),
  IDataTransformer: require('./IDataTransformer'),
  IIntegrationLogger: require('./IIntegrationLogger'),
  IRateLimitManager: require('./IRateLimitManager'),
  IAPIAdapter: require('./IAPIAdapter')
};