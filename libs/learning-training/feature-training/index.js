// Training Feature Module
// Handles training programs and related functionality

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

export { default as TrainingService } from './training-service';
export { default as LearningSystemManager } from './learning-system-manager';
export { default as LearningOrchestrator } from './learning-orchestrator';