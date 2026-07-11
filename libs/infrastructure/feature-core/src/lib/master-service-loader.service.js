/**
 * MasterServiceLoader - Orchestrates 7-phase service loading
 * 
 * This critical service implements the 7-phase loading sequence to ensure
 * all services start in the correct order without circular dependencies:
 * 
 * Phase 1: Core Infrastructure
 * Phase 2: Security Services  
 * Phase 3: Database Services
 * Phase 4: Audit Services
 * Phase 5: Learning Services
 * Phase 6: AI Services
 * Phase 7: Wrapper Services
 */

const path = require('path');

// Add this service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class MasterServiceLoader {
    constructor() {
        this.serviceToken = null;
        this.initialized = false;
        this.phases = new Map();
        this.loadedServices = new Set();
        this.failedServices = new Set();
        this.loadingProgress = {
            currentPhase: 0,
            totalPhases: 7,
            servicesLoaded: 0,
            totalServices: 0,
            startTime: null,
            phaseStartTime: null
        };
        this.logger = this.createLogger();
        
        this.defineLoadingPhases();
    }

    /**
     * Define the 7 loading phases with their services
     */
    defineLoadingPhases() {
        this.phases.set(1, {
            name: 'Core Infrastructure',
            description: 'Essential infrastructure services that everything depends on',
            services: [
                'productionKMS',        // MUST BE FIRST - encryption keys
                'encryptionService',    // Core encryption functionality
                'customKMS'            // Additional key management
            ],
            timeout: 30000,
            critical: true,
            parallel: false  // Load sequentially for infrastructure
        });

        this.phases.set(2, {
            name: 'Security Services',
            description: 'Authentication, authorization, and security validation',
            services: [
                'serviceAccountManager',
                'securityHeaderValidator', 
                'authAIService'
            ],
            timeout: 25000,
            critical: true,
            parallel: true
        });

        this.phases.set(3, {
            name: 'Database Services',
            description: 'Database connections and data access layer',
            services: [
                'clinicDatabaseManager',
                'databaseConnectionProvider',
                'connectionPoolManager'
            ],
            timeout: 20000,
            critical: true,
            parallel: true
        });

        this.phases.set(4, {
            name: 'Audit Services',
            description: 'Compliance and security auditing',
            services: [
                'complianceAuditService',
                'securityAuditService',
                'auditLogService'
            ],
            timeout: 15000,
            critical: false,
            parallel: true
        });

        this.phases.set(5, {
            name: 'Learning Services',
            description: 'AI learning and memory systems',
            services: [
                'learningSystemManager',
                'learningOrchestrator',
                'proceduralMemory'
            ],
            timeout: 20000,
            critical: false,
            parallel: true
        });

        this.phases.set(6, {
            name: 'AI Services',
            description: 'AI agents and medical services',
            services: [
                'agentServiceClaude',
                'agentServiceV4',        // Contains 175+ functions
                'geminiMedicalService'
            ],
            timeout: 30000,
            critical: false,
            parallel: false  // AI services may have complex dependencies
        });

        this.phases.set(7, {
            name: 'Wrapper Services',
            description: 'High-level orchestration and wrapper services',
            services: [
                'agentServiceWrapper',
                'aiSecurityWrapper'
            ],
            timeout: 15000,
            critical: false,
            parallel: true
        });

        // Calculate total services
        this.loadingProgress.totalServices = Array.from(this.phases.values())
            .reduce((total, phase) => total + phase.services.length, 0);
    }

    /**
     * Initialize and start the 7-phase loading sequence
     */
    async initialize() {
        if (this.initialized) {
            this.logger.warn('⚠️ MasterServiceLoader already initialized');
            return this;
        }

        try {
            // Get services through proxy to avoid circular dependencies  
            const proxy = getServiceProxy();
            const serviceAccountManager = proxy.getService('serviceAccountManager');
            
            // Authenticate service
            this.serviceToken = await serviceAccountManager.authenticate('master-service-loader');

            this.logger.info('🚀 Starting MasterServiceLoader - 7-Phase Loading Sequence');
            this.logger.info(`📊 Loading ${this.loadingProgress.totalServices} services across ${this.loadingProgress.totalPhases} phases`);
            
            this.loadingProgress.startTime = Date.now();

            // Initialize ServiceProxyManager first
            await proxy.initialize();

            // Execute each phase sequentially
            for (let phaseNumber = 1; phaseNumber <= 7; phaseNumber++) {
                await this.executePhase(phaseNumber);
            }

            this.initialized = true;
            this.reportFinalStatus();

        } catch (error) {
            this.logger.error('❌ Critical error during service loading:', error.message);
            throw error;
        }

        return this;
    }

    /**
     * Execute a specific loading phase
     */
    async executePhase(phaseNumber) {
        const phase = this.phases.get(phaseNumber);
        if (!phase) {
            throw new Error(`Invalid phase number: ${phaseNumber}`);
        }

        this.loadingProgress.currentPhase = phaseNumber;
        this.loadingProgress.phaseStartTime = Date.now();

        this.logger.info(`\n🔄 Phase ${phaseNumber}: ${phase.name}`);
        this.logger.info(`📝 ${phase.description}`);
        this.logger.info(`⚙️ Services: ${phase.services.join(', ')}`);

        // Validate phase prerequisites
        await this.validatePhasePrerequisites(phaseNumber);

        try {
            if (phase.parallel) {
                await this.loadServicesParallel(phase);
            } else {
                await this.loadServicesSequential(phase);
            }

            // Verify all services in phase loaded successfully
            await this.verifyPhaseCompletion(phase);

            const phaseTime = Date.now() - this.loadingProgress.phaseStartTime;
            this.logger.info(`✅ Phase ${phaseNumber} completed in ${phaseTime}ms`);

        } catch (error) {
            this.handlePhaseError(phaseNumber, phase, error);
        }
    }

    /**
     * Load services in parallel
     */
    async loadServicesParallel(phase) {
        const promises = phase.services.map(async (serviceName) => {
            try {
                await this.loadSingleService(serviceName, phase.timeout);
                this.loadedServices.add(serviceName);
                this.loadingProgress.servicesLoaded++;
                this.logger.debug(`✅ Loaded: ${serviceName}`);
            } catch (error) {
                this.failedServices.add(serviceName);
                this.logger.error(`❌ Failed to load ${serviceName}:`, error.message);
                throw error;
            }
        });

        await Promise.all(promises);
    }

    /**
     * Load services sequentially
     */
    async loadServicesSequential(phase) {
        for (const serviceName of phase.services) {
            try {
                await this.loadSingleService(serviceName, phase.timeout);
                this.loadedServices.add(serviceName);
                this.loadingProgress.servicesLoaded++;
                this.logger.debug(`✅ Loaded: ${serviceName}`);
            } catch (error) {
                this.failedServices.add(serviceName);
                this.logger.error(`❌ Failed to load ${serviceName}:`, error.message);
                
                if (phase.critical) {
                    throw new Error(`Critical service failed: ${serviceName} - ${error.message}`);
                }
            }
        }
    }

    /**
     * Load a single service with timeout
     */
    async loadSingleService(serviceName, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Service loading timeout: ${serviceName}`));
            }, timeout);

            try {
                // Use ServiceProxyManager to load the service
                const proxy = getServiceProxy();
                const service = proxy.getService(serviceName);
                
                // If service has an initialize method, call it
                if (service && typeof service.initialize === 'function') {
                    const result = service.initialize();
                    
                    // Handle async initialization
                    if (result && typeof result.then === 'function') {
                        result
                            .then(() => {
                                clearTimeout(timer);
                                resolve(service);
                            })
                            .catch((error) => {
                                clearTimeout(timer);
                                reject(error);
                            });
                    } else {
                        clearTimeout(timer);
                        resolve(service);
                    }
                } else {
                    clearTimeout(timer);
                    resolve(service);
                }
                
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    /**
     * Require a service module
     */
    requireService(serviceName) {
        const servicePaths = {
            // Core services
            'productionKMS': '../../../../../backend/services/productionKMS',
            'encryptionService': '../../../../../backend/services/encryptionService',
            'serviceHealthMonitor': '../../../../../backend/services/serviceHealthMonitor',
            
            // Security services
            'serviceAutoRegistration': '../../../../../backend/services/serviceAutoRegistration',
            'serviceAccountManager': '../../../../../backend/services/serviceAccountManager',
            'globalModelLoader': '../../../../../backend/services/globalModelLoader',
            
            // Database services
            'clinicDatabaseManager': '../../../../../backend/services/clinicDatabaseManager',
            'baseService': '../../../../../backend/services/baseService',
            'serviceRegistry': '../../../../../backend/services/serviceRegistry',
            'secureDataAccess': '../../../../../backend/services/secureDataAccess',
            
            // Audit services
            'immutableAuditService': '../../../../../backend/services/immutableAuditService',
            'emergencyResponse': '../../../../../backend/services/emergencyResponse',
            
            // Learning services
            'learningServicesInitializer': '../../../../../backend/services/learning/learningServicesInitializer',
            
            // AI services
            'geminiMedicalService': '../../../../../backend/services/geminiMedicalService',
            'agentServiceClaude': '../../../../../backend/services/agentServiceClaude',
            'agentServiceV4': '../../../../../backend/services/agentServiceV4',
            'agentServiceSmart': '../../../../../backend/services/agentServiceSmart',
            'aiSecurityWrapper': '../../../../../backend/services/aiSecurityWrapper',
            'selfImprovingMemory': '../../../../../backend/services/selfImprovingMemory',
            'workflowPredictorService': '../../../../../backend/services/learning/workflowPredictorService',
            'personalAssistantService': '../../../../../backend/services/learning/personalAssistantService',
            'secureConfigService': '../../../../../backend/services/secureConfigService',
            
            // Wrapper services
            'agentServiceWrapper': '../../../../../backend/services/agentServiceWrapper'
        };
        
        const path = servicePaths[serviceName];
        if (!path) {
            throw new Error(`Unknown service: ${serviceName}`);
        }
        
        try {
            return require(path);
        } catch (error) {
            // If service doesn't exist yet, return null
            if (error.code === 'MODULE_NOT_FOUND') {
                console.warn(`   Service ${serviceName} not found, skipping`);
                return null;
            }
            throw error;
        }
    }

    /**
     * Check if service needs explicit initialization
     */
    needsInitialization(serviceName) {
        const initServices = [
            'serviceAccountManager',
            'clinicDatabaseManager',
            'learningServicesInitializer',
            'agentServiceClaude',
            'agentServiceV4'
        ];
        return initServices.includes(serviceName);
    }

    /**
     * Report final loading status
     */
    reportFinalStatus() {
        const totalTime = Date.now() - this.loadingProgress.startTime;
        const successCount = this.loadedServices.size;
        const failureCount = this.failedServices.size;

        this.logger.info('\n🎉 SERVICE LOADING COMPLETE');
        this.logger.info(`⏱️ Total time: ${totalTime}ms`);
        this.logger.info(`✅ Loaded: ${successCount} services`);
        this.logger.info(`❌ Failed: ${failureCount} services`);
        this.logger.info(`📊 Success rate: ${((successCount / this.loadingProgress.totalServices) * 100).toFixed(1)}%`);

        if (failureCount > 0) {
            this.logger.warn('⚠️ Failed services:', Array.from(this.failedServices).join(', '));
        }

        // Display metrics
        this.displayMetrics();
    }

    /**
     * Display performance metrics
     */
    displayMetrics() {
        const proxy = getServiceProxy();
        const metrics = proxy.getMetrics ? proxy.getMetrics() : {};
        
        this.logger.info('\n📊 PERFORMANCE METRICS:');
        this.logger.info(`🏪 Services registered: ${metrics.services.registered}`);
        this.logger.info(`💾 Services loaded: ${metrics.services.loaded}`);
        this.logger.info(`🔄 Proxy cache hit rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`);
    }

    /**
     * Get current loading progress
     */
    getProgress() {
        return {
            ...this.loadingProgress,
            loadedServices: Array.from(this.loadedServices),
            failedServices: Array.from(this.failedServices)
        };
    }

    /**
     * Validate prerequisites for a phase
     */
    async validatePhasePrerequisites(phaseNumber) {
        // Phase 1 has no prerequisites
        if (phaseNumber === 1) return;

        // Verify all previous phases completed
        for (let i = 1; i < phaseNumber; i++) {
            const previousPhase = this.phases.get(i);
            
            for (const serviceName of previousPhase.services) {
                if (!this.loadedServices.has(serviceName) && previousPhase.critical) {
                    throw new Error(`Prerequisite failed: ${serviceName} (required for Phase ${phaseNumber})`);
                }
            }
        }
    }

    /**
     * Verify phase completion
     */
    async verifyPhaseCompletion(phase) {
        for (const serviceName of phase.services) {
            if (phase.critical && !this.loadedServices.has(serviceName)) {
                throw new Error(`Critical service failed to load: ${serviceName}`);
            }
        }
    }

    /**
     * Handle phase loading errors
     */
    handlePhaseError(phaseNumber, phase, error) {
        this.logger.error(`❌ Phase ${phaseNumber} (${phase.name}) failed:`, error.message);
        
        if (phase.critical) {
            throw new Error(`Critical phase ${phaseNumber} failed: ${error.message}`);
        } else {
            this.logger.warn(`⚠️ Non-critical phase ${phaseNumber} failed, continuing...`);
        }
    }

    /**
     * Create logger instance
     */
    createLogger() {
        return {
            debug: (msg, ...args) => console.log(`[MasterLoader] DEBUG: ${msg}`, ...args),
            info: (msg, ...args) => console.log(`[MasterLoader] INFO: ${msg}`, ...args),
            warn: (msg, ...args) => console.warn(`[MasterLoader] WARN: ${msg}`, ...args),
            error: (msg, ...args) => console.error(`[MasterLoader] ERROR: ${msg}`, ...args)
        };
    }
}

// Export singleton instance
const masterServiceLoader = new MasterServiceLoader();

// Register with service proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('masterServiceLoader', () => {
    return masterServiceLoader;
  });
}

module.exports = masterServiceLoader;