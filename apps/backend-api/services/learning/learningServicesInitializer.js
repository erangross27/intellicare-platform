/**
 * Centralized initializer for all learning services
 * Breaks circular dependencies by controlling initialization order
 */

const serviceAccountManager = require('../serviceAccountManager');

class LearningServicesInitializer {
  constructor() {
    this.services = new Map();
    this.initialized = false;
    this.initializationOrder = [
      // Layer 1: Core infrastructure
      'learningConfigService',
      'learningEventBus',
      'learningDataAdapter',
      
      // Layer 2: Data capture
      'interactionCaptureService',
      
      // Layer 3: Pattern engines
      'sequencePatternEngine',
      'temporalPatternEngine',
      
      // Layer 4: Memory services
      'userMemoryService',
      'proceduralMemoryService',
      
      // Layer 5: Analysis services
      'bottleneckDetectorService',
      'automationOpportunityService',
      'efficiencyAnalyzerService',
      
      // Layer 6: AI services
      'personalAssistantService',
      'workflowPredictorService',
      'solverService',
      'challengerService',
      
      // Layer 7: Interceptor
      'functionInterceptor',
      
      // Layer 8: Orchestration (depends on all others)
      'learningOrchestrator',
      
      // Layer 9: API layer (depends on orchestrator)
      'learningAPIGateway',
      'learningWebSocketServer'
    ];
  }
  
  async initialize() {
    if (this.initialized) return;
    
    console.log('🧠 Initializing Learning Services in correct order...');
    
    // Ensure service account manager is ready
    if (!serviceAccountManager.initialized) {
      await serviceAccountManager.initialize();
    }
    
    for (const serviceName of this.initializationOrder) {
      try {
        const service = require(`./${serviceName}`);
        
        // Store reference
        this.services.set(serviceName, service);
        
        // Initialize if has method and NOT auto-initializing
        if (service.initialize && typeof service.initialize === 'function') {
          // Skip if already initialized (like learningOrchestrator auto-init)
          if (!service.initialized) {
            await service.initialize();
            console.log(`  ✅ ${serviceName} initialized`);
          } else {
            console.log(`  ⏭️  ${serviceName} already initialized`);
          }
        }
      } catch (error) {
        console.error(`  ❌ ${serviceName} failed:`, error.message);
        // Continue with other services
      }
    }
    
    this.initialized = true;
    console.log('✅ All learning services initialized');
  }
  
  getService(name) {
    return this.services.get(name);
  }
}

module.exports = new LearningServicesInitializer();