// Education Feature Module
// Handles continuing education and certification

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

export { default as ContinuingEducationService } from './continuing-education-service';
export { default as CertificationService } from './certification-service';
export { default as OnboardingService } from './onboarding-service';