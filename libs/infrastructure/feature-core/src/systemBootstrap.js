/**
 * System Bootstrap Service
 * Orchestrates the complete system startup using the 7-phase loading system
 */

// Add ServiceProxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class SystemBootstrap {
  constructor() {
    this.initialized = false;
    this.bootstrapStartTime = null;
    this.bootstrapEndTime = null;
    this.migrationMode = process.env.MIGRATION_MODE === 'true';
    this.status = 'not-started';
    this.serviceToken = null;
  }

  async initialize() {
    if (this.initialized) {
      return { success: true, message: 'Already initialized' };
    }

    console.log('🚀 IntelliCare System Bootstrap Starting...');
    this.bootstrapStartTime = Date.now();
    this.status = 'initializing';

    try {
      // Authenticate service first
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('systemBootstrap');

      // Step 1: Initialize the 7-phase loader
      console.log('📋 Step 1: Initializing Phase Loader...');
      const phaseLoader = proxy.getService('phaseLoader');
      await phaseLoader.initialize();

      // Step 2: Load all phases sequentially
      console.log('📋 Step 2: Loading All System Phases...');
      const phaseResult = await phaseLoader.loadAllPhases();
      
      if (!phaseResult.success) {
        throw new Error(`Phase loading failed: ${phaseResult.error}`);
      }

      // Step 3: Initialize migration services (if in migration mode)
      if (this.migrationMode) {
        console.log('📋 Step 3: Initializing Migration Services...');
        await this.initializeMigrationServices();
      } else {
        console.log('📋 Step 3: Skipping migration services (not in migration mode)');
      }

      // Step 4: Initialize monitoring
      console.log('📋 Step 4: Starting Performance Monitoring...');
      const performanceMonitoringService = proxy.getService('performanceMonitoringService');
      await performanceMonitoringService.initialize();

      // Step 5: Final system validation
      console.log('📋 Step 5: Final System Validation...');
      await this.validateSystemHealth();

      this.bootstrapEndTime = Date.now();
      const totalTime = this.bootstrapEndTime - this.bootstrapStartTime;
      this.status = 'completed';

      console.log(`✅ IntelliCare System Bootstrap Completed Successfully in ${totalTime}ms`);
      
      this.initialized = true;
      return {
        success: true,
        totalTime,
        phasesLoaded: phaseResult.phasesLoaded,
        servicesLoaded: phaseResult.servicesLoaded,
        migrationMode: this.migrationMode
      };

    } catch (error) {
      console.error('❌ System Bootstrap Failed:', error);
      this.status = 'failed';
      
      // Attempt graceful cleanup
      await this.cleanup();
      
      return {
        success: false,
        error: error.message,
        totalTime: Date.now() - this.bootstrapStartTime
      };
    }
  }

  /**
   * Get service context for database operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'systemBootstrap',
      operation: 'database-access',
      practiceId: practiceId
    };
  }

  async initializeMigrationServices() {
    console.log('🔄 Setting up zero-downtime migration services...');

    try {
      // Initialize session bridge for zero-downtime session migration
      console.log('  📡 Initializing Session Bridge...');
      const proxy = getServiceProxy();
      const sessionBridge = proxy.getService('sessionBridge');
      await sessionBridge.initialize();
      
      // Set initial migration phase based on environment
      const sessionPhase = process.env.SESSION_MIGRATION_PHASE || 'mongo-only';
      sessionBridge.setMigrationPhase(sessionPhase);
      
      // Initialize authentication bridge for gradual auth migration
      console.log('  🔐 Initializing Authentication Bridge...');
      const authenticationBridge = proxy.getService('authenticationBridge');
      await authenticationBridge.initialize();
      
      // Set initial auth migration phase
      const authPhase = process.env.AUTH_MIGRATION_PHASE || 'old-system';
      authenticationBridge.setMigrationPhase(authPhase);
      
      // Set traffic split percentage
      const trafficSplit = parseInt(process.env.AUTH_TRAFFIC_SPLIT) || 10;
      authenticationBridge.setTrafficSplit(trafficSplit);

      console.log('✅ Migration services initialized successfully');
      console.log(`   Session Phase: ${sessionPhase}`);
      console.log(`   Auth Phase: ${authPhase} (${trafficSplit}% to new system)`);

    } catch (error) {
      console.error('❌ Failed to initialize migration services:', error);
      throw error;
    }
  }

  async validateSystemHealth() {
    console.log('🏥 Validating system health...');

    const healthChecks = [];

    // Check phase loader health
    const proxy = getServiceProxy();
    const phaseLoader = proxy.getService('phaseLoader');
    healthChecks.push({
      name: 'Phase Loader',
      check: () => phaseLoader.getHealthStatus()
    });

    // Check migration services if enabled
    if (this.migrationMode) {
      const sessionBridge = proxy.getService('sessionBridge');
      const authenticationBridge = proxy.getService('authenticationBridge');
      healthChecks.push({
        name: 'Session Bridge',
        check: () => sessionBridge.getHealthStatus()
      });

      healthChecks.push({
        name: 'Authentication Bridge', 
        check: () => authenticationBridge.getHealthStatus()
      });
    }

    // Check performance monitoring
    const performanceMonitoringService = proxy.getService('performanceMonitoringService');
    healthChecks.push({
      name: 'Performance Monitoring',
      check: () => performanceMonitoringService.getHealthCheck()
    });

    const results = [];
    for (const healthCheck of healthChecks) {
      try {
        const result = await healthCheck.check();
        results.push({
          service: healthCheck.name,
          status: 'healthy',
          details: result
        });
        console.log(`  ✅ ${healthCheck.name}: Healthy`);
      } catch (error) {
        results.push({
          service: healthCheck.name,
          status: 'unhealthy',
          error: error.message
        });
        console.error(`  ❌ ${healthCheck.name}: ${error.message}`);
        throw new Error(`System validation failed - ${healthCheck.name} is unhealthy`);
      }
    }

    console.log('✅ System health validation completed');
    return results;
  }

  async cleanup() {
    console.log('🧹 Performing cleanup...');
    
    try {
      const proxy = getServiceProxy();
      
      // Stop performance monitoring
      const performanceMonitoringService = proxy.getService('performanceMonitoringService');
      if (performanceMonitoringService.initialized) {
        performanceMonitoringService.stop();
      }

      // Rollback phases
      const phaseLoader = proxy.getService('phaseLoader');
      await phaseLoader.rollback();

      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  getBootstrapStatus() {
    const proxy = getServiceProxy();
    const phaseLoader = proxy.getService('phaseLoader');
    const phaseProgress = phaseLoader.getLoadingProgress();
    
    return {
      status: this.status,
      initialized: this.initialized,
      migrationMode: this.migrationMode,
      startTime: this.bootstrapStartTime ? new Date(this.bootstrapStartTime) : null,
      endTime: this.bootstrapEndTime ? new Date(this.bootstrapEndTime) : null,
      totalTime: this.bootstrapEndTime ? this.bootstrapEndTime - this.bootstrapStartTime : null,
      phases: phaseProgress,
      loadedServices: phaseLoader.getAllLoadedServices()
    };
  }

  async restartSystem() {
    console.log('🔄 System restart requested...');
    
    // Cleanup current state
    await this.cleanup();
    
    // Reset state
    this.initialized = false;
    this.bootstrapStartTime = null;
    this.bootstrapEndTime = null;
    this.status = 'not-started';
    
    // Reinitialize
    return await this.initialize();
  }

  // Migration control methods
  async setSessionMigrationPhase(phase) {
    if (!this.migrationMode) {
      throw new Error('Migration mode not enabled');
    }

    const proxy = getServiceProxy();
    const sessionBridge = proxy.getService('sessionBridge');
    const result = sessionBridge.setMigrationPhase(phase);
    if (result) {
      console.log(`🔄 Session migration phase changed to: ${phase}`);
    }
    return result;
  }

  async setAuthMigrationPhase(phase) {
    if (!this.migrationMode) {
      throw new Error('Migration mode not enabled');
    }

    const proxy = getServiceProxy();
    const authenticationBridge = proxy.getService('authenticationBridge');
    const result = authenticationBridge.setMigrationPhase(phase);
    if (result) {
      console.log(`🔄 Auth migration phase changed to: ${phase}`);
    }
    return result;
  }

  async setTrafficSplit(percentage) {
    if (!this.migrationMode) {
      throw new Error('Migration mode not enabled');
    }

    const proxy = getServiceProxy();
    const authenticationBridge = proxy.getService('authenticationBridge');
    const result = authenticationBridge.setTrafficSplit(percentage);
    if (result) {
      console.log(`🔄 Traffic split changed to: ${percentage}%`);
    }
    return result;
  }

  async getMigrationStatus() {
    if (!this.migrationMode) {
      return { migrationMode: false };
    }

    const proxy = getServiceProxy();
    const sessionBridge = proxy.getService('sessionBridge');
    const authenticationBridge = proxy.getService('authenticationBridge');
    const sessionStatus = await sessionBridge.getHealthStatus();
    const authStatus = await authenticationBridge.getHealthStatus();

    return {
      migrationMode: true,
      session: sessionStatus,
      authentication: authStatus,
      recommendations: [
        ...sessionStatus.recommendations || [],
        ...authStatus.recommendations || []
      ]
    };
  }

  async triggerRollback(reason = 'manual') {
    if (!this.migrationMode) {
      throw new Error('Migration mode not enabled - no rollback needed');
    }

    console.log(`🚨 Triggering system rollback - Reason: ${reason}`);
    
    const proxy = getServiceProxy();
    const authenticationBridge = proxy.getService('authenticationBridge');
    const sessionBridge = proxy.getService('sessionBridge');
    const authRollback = authenticationBridge.triggerRollback(reason);
    
    // For sessions, we typically don't need to rollback as they work with both systems
    // But we can change the read preference if needed
    sessionBridge.setReadPreference('mongo');

    console.log('✅ Rollback completed');
    
    return {
      authRollback,
      sessionFallback: 'mongodb',
      reason,
      timestamp: new Date()
    };
  }
}

module.exports = new SystemBootstrap();