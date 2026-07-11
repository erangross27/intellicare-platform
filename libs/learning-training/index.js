// Learning & Training Context - Barrel Export
// Provides centralized exports for all learning and training services

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

// Feature exports
export * from './feature-training';
export * from './feature-education';
export * from './feature-assessment';
export * from './feature-knowledge';

// Data access exports
export * from './data-access-learning';

// Domain exports
export * from './domain-education';

// Utility exports
export * from './util-tracking';

// Main learning system services
export { default as LearningSystemManager } from './feature-training/learning-system-manager';
export { default as LearningOrchestrator } from './feature-training/learning-orchestrator';
export { default as LearningDataCollector } from './data-access-learning/learning-data-collector';
export { default as ProceduralMemory } from './feature-knowledge/procedural-memory';

// Education services
export { default as ContinuingEducationService } from './feature-education/continuing-education-service';
export { default as CompetencyAssessmentService } from './feature-assessment/competency-assessment-service';
export { default as TrainingService } from './feature-training/training-service';
export { default as KnowledgeBaseService } from './feature-knowledge/knowledge-base-service';

// Certification services
export { default as CertificationService } from './feature-education/certification-service';
export { default as OnboardingService } from './feature-education/onboarding-service';

// Progress tracking utilities
export { default as ProgressTracker } from './util-tracking/progress-tracker';
export { default as LearningAnalytics } from './util-tracking/learning-analytics';

// Domain models
export { default as TrainingProgram } from './domain-education/training-program';
export { default as Assessment } from './domain-education/assessment';
export { default as Certificate } from './domain-education/certificate';
export { default as LearningPath } from './domain-education/learning-path';
export { default as Progress } from './domain-education/progress';