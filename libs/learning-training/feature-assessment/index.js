// Assessment Feature Module
// Handles competency assessment and evaluation

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

export { default as CompetencyAssessmentService } from './competency-assessment-service';
export { default as AssessmentEngine } from './assessment-engine';
export { default as CompetencyEvaluator } from './competency-evaluator';