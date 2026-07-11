const path = require('path');

// Whitelist of allowed modules
const allowedModules = {
  // Services
  'authService': '../services/authAIService',
  'agentService': '../services/agentServiceWrapper',
  'documentService': '../services/documentAnalysisService',
  'secureDataAccess': '../services/secureDataAccess',
  'auditLogger': '../middleware/auditLog',
  
  // Models
  'User': '../models/User',
  'Patient': '../models/PatientSchemaFactory',
  'Practice': '../models/Practice',
  'Document': '../models/Document',
  'Appointment': '../models/Appointment',
  
  // Utils
  'databaseFactory': '../utils/databaseFactory',
  'documentEncryption': '../utils/documentEncryption',
  'securityUtils': '../utils/securityUtils',
  
  // Middleware
  'auth': '../middleware/auth',
  'practiceAuth': '../middleware/practiceAuth',
  'practiceContext': '../middleware/practiceContext'
};

function safeRequire(moduleName) {
  // Check if module is in whitelist
  const modulePath = allowedModules[moduleName];
  if (!modulePath) {
    console.error('Module not in whitelist:', moduleName);
    throw new Error(`Module not allowed: ${moduleName}`);
  }
  
  try {
    return require(modulePath);
  } catch (error) {
    console.error('Failed to load module:', moduleName, error.message);
    throw new Error(`Failed to load module: ${moduleName}`);
  }
}

function isModuleAllowed(moduleName) {
  return moduleName in allowedModules;
}

function getAllowedModules() {
  return Object.keys(allowedModules);
}

module.exports = { 
  safeRequire,
  isModuleAllowed,
  getAllowedModules
};
