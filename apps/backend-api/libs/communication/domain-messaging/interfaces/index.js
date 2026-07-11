// Communication Domain Interfaces
module.exports = {
  IMessageService: require('./IMessageService'),
  INotificationProvider: require('./INotificationProvider'),
  ITemplateEngine: require('./ITemplateEngine'),
  ICommunicationChannel: require('./ICommunicationChannel'),
  IDeliveryTracker: require('./IDeliveryTracker')
};