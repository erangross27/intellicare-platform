// Communication Context Barrel Export
// Manages all messaging and notifications
module.exports = {
  // Feature: Email Services
  ...require('./feature-email/services'),
  
  // Feature: SMS Services
  ...require('./feature-sms/services'),
  
  // Feature: Chat Services
  ...require('./feature-chat/services'),
  
  // Feature: Notification Services
  ...require('./feature-notifications/services'),
  
  // Data Access Layer
  ...require('./data-access-comm'),
  
  // Domain Models
  ...require('./domain-messaging/models'),
  
  // Domain Interfaces
  ...require('./domain-messaging/interfaces'),
  
  // Template Utilities
  ...require('./util-templates')
};