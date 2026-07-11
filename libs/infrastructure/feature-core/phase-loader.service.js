// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Phase Loader Service
 * Manages phased loading and initialization of system components
 */
class PhaseLoader {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.phases = new Map();
    this.currentPhase = 0;
  }

  async initialize() {
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('phase-loader-service');
      await this.defineLoadingPhases();
      this.initialized = true;
      console.log('✅ Phase Loader Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Phase Loader Service:', error);
      throw error;
    }
  }

  async defineLoadingPhases() {
    const phases = [
      { id: 1, name: 'Core Services', dependencies: [] },
      { id: 2, name: 'Security Services', dependencies: [1] },
      { id: 3, name: 'Database Services', dependencies: [1, 2] },
      { id: 4, name: 'Business Services', dependencies: [1, 2, 3] },
      { id: 5, name: 'API Services', dependencies: [1, 2, 3, 4] }
    ];

    phases.forEach(phase => {
      this.phases.set(phase.id, phase);
    });
  }

  async loadPhase(phaseId) {
    const phase = this.phases.get(phaseId);
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found`);
    }

    console.log(`Loading phase ${phaseId}: ${phase.name}`);
    
    // Check dependencies
    for (const depId of phase.dependencies) {
      if (depId > this.currentPhase) {
        throw new Error(`Phase ${phaseId} depends on phase ${depId} which is not loaded`);
      }
    }

    // Simulate loading
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.currentPhase = Math.max(this.currentPhase, phaseId);
    
    return { phaseId, name: phase.name, status: 'loaded' };
  }

  async loadAllPhases() {
    const results = [];
    for (const [phaseId] of this.phases) {
      const result = await this.loadPhase(phaseId);
      results.push(result);
    }
    return results;
  }

  getCurrentPhase() {
    return this.currentPhase;
  }

  getPhaseStatus() {
    return {
      currentPhase: this.currentPhase,
      totalPhases: this.phases.size,
      completed: this.currentPhase === this.phases.size
    };
  }
}

module.exports = new PhaseLoader();