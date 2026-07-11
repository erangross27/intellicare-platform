// AI & Analytics Context Barrel Export
// Intelligence and reporting for the medical platform
module.exports = {
  // Feature: Claude AI Services (Primary AI)
  ...require('./feature-claude/services'),
  
  // Feature: Gemini Medical AI Services (Medical Specialist)
  ...require('./feature-gemini/services'),
  
  // Feature: Analytics Services
  ...require('./feature-analytics/services'),
  
  // Feature: Reporting Services
  ...require('./feature-reporting/services'),
  
  // Feature: Machine Learning Services
  ...require('./feature-ml/services'),
  
  // Data Access Layer
  ...require('./data-access-ai'),
  
  // Domain Models
  ...require('./domain-intelligence/models'),
  
  // Domain Interfaces
  ...require('./domain-intelligence/interfaces'),
  
  // Prompt Utilities
  ...require('./util-prompts')
};