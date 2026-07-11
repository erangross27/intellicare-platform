/**
 * Master Service Loader
 * Centralized service loading at server startup with dependency order management
 */

const serviceProxyManager = require('./serviceProxyManager');

class MasterServiceLoader {
    constructor() {
        this.loadPhases = {
            // Phase 1: Core Config & KMS (no dependencies)
            core: [
                'productionKMS',         // MUST BE FIRST - Root of trust, provides API keys
                'secureConfigService',   // Config service (needs productionKMS for keys)
                'encryptionService',     // Core encryption
                'serviceHealthMonitor',  // Health monitoring
                'keyManagementService',  // Key management
                'secretsManagementService' // Secrets management
            ],
            
            // Phase 2: Database Foundation (needs config)
            foundation: [
                'databaseFactory',       // Database connections
                'globalModelLoader',     // Loads models (needs databaseFactory)
                'serviceRegistry',       // Service registration
                'baseService',           // Base service class
                'dbOptimizationService', // Database optimization
                'dataRetentionService'   // Data retention policies
            ],
            
            // Phase 3: Audit & Security (needs database)
            security: [
                'immutableAuditService',     // Audit logging (needed by serviceAccountManager)
                'serviceAccountManager',     // Service authentication (needs immutableAuditService)
                'SecureSessionManager',      // Session management
                'e2eEncryptionService',      // End-to-end encryption
                'securityMonitoringService', // Security monitoring
                'blockchainAuditService',    // Blockchain audit
                'zeroTrustService',          // Zero trust security
                'securityChaosService',      // Security chaos testing
                'serviceAccountRotation',    // Service account rotation
                'complianceScorecard',       // Compliance scoring
                'complianceReportingService', // Compliance reporting
                'securityAuditService',      // Security audit logging
                'mfaService',                // Multi-factor authentication
                'threatIntelligenceService', // Threat intelligence
                'threatDetectionService',    // Threat detection
                'zeroKnowledgeAuthService',  // Zero knowledge auth
                'securityHeadersOptimizationService', // Security headers
                'graphqlSecurityService',    // GraphQL security
                'cspService'                 // Content Security Policy
            ],
            
            // Phase 4: Data Access (needs security)
            database: [
                'secureDataAccess',      // Secure data access layer
                'practiceDatabaseManager', // Practice database management
                'emergencyResponse',     // Emergency response service
                'batchStateManager',     // Batch state persistence (NEW - stores batch jobs in DB)
                'batchResultsWorker',    // Batch processing
                'medicalDataService',    // Medical data storage service
                'documentStorageService', // Document storage service
                'patientDeletionService' // Patient deletion service
            ],
            
            // Phase 5: Infrastructure Services (needs database)
            infrastructure: [
                'universalCache',           // Universal caching service - MUST BE FIRST
                'redisCache',               // Redis caching service
                'mongoChangeStreams',       // MongoDB Change Streams for automatic cache invalidation
                // 'redisDataSync' removed - using simple cache on first request approach
                'apiVersioningService',      // API versioning
                'tracingService',           // Request tracing
                'circuitBreakerService',    // Circuit breaker pattern
                'retryService',             // Retry logic
                'loadBalancingService',     // Load balancing
                'disasterRecoveryService',  // Disaster recovery
                'costTrackingServiceDB',    // Cost tracking
                'reminderService',          // Reminder service
                'batchProgressCache',       // Batch progress cache for real-time updates
                'patientMatchingService',   // Automatic patient matching
                'documentQueueService',     // Document queue management for concurrent users
                'backupService',            // Database and KMS backup service
                // 'geocodingService',         // Geocoding service - REMOVED, not using anymore
                'blueButtonOAuthService',   // Blue Button OAuth
                'fileCleanup',              // File cleanup service
                'claudeCacheMonitor',       // Claude cache monitor
                'externalApiGatewayService', // External API gateway
                'webhookSubscriptionService', // Webhook subscriptions
                'webhookManagementService'  // Webhook management
            ],
            
            // Phase 6: Communication Services (needs infrastructure)
            communication: [
                'emailService',          // Email service
                'otpService',           // OTP service
                'learningWebSocketServer', // WebSocket server
                'communicationAuditService', // Communication audit
                'smsService',            // SMS service
                'bulkCommunicationService', // Bulk communication
                'patientPortalMessagingService' // Patient portal messaging
            ],
            
            // Phase 7: Learning & Memory (needs communication)
            learning: [
                'learningServicesInitializer',  // Learning services
                'proceduralMemoryService',      // Procedural memory
                'claudeMemoryService',          // Claude-specific memory
                'workflowEngine'                // Workflow engine
            ],
            
            // Phase 7: Business Services (needs communication)
            business: [
                // 🔄 REFACTORED SERVICES - Extracted from agentServiceV4
                'patientService',         // Patient management (32 functions)
                'appointmentService',     // Appointment management (9 functions)
                'documentService',        // Document management (10 functions)
                'medicationService',      // Medication management (5 functions)
                'prescriptionService',    // Prescription management (2 functions)
                'labService',             // Lab results management (11 functions)
                'providerService',        // Provider management (13 functions)
                'userService',            // User management (7 functions)
                'clinicService',          // Clinic management (6 functions)
                'communicationService',   // Communication management (4 functions)
                'diagnosisService',       // Diagnosis management

                // 🛠️ UTILITY HELPERS - Extracted helper functions (109 total)
                'utils/utilityHelpers',      // 15 utility functions
                'utils/aiHelpers',           // 10 AI helper functions
                'utils/medicalHelpers',      // 8 medical logic functions
                'utils/allergyHelpers',      // 12 allergy functions
                'utils/medicationHelpers',   // 3 medication formatting functions
                'utils/documentHelpers',     // 12 document analysis functions
                'utils/chatHelpers',         // 11 chat/session functions
                'utils/searchHelpers',       // 3 search utility functions
                'utils/userHelpers',         // 9 user/role functions
                'utils/accessHelpers',       // 1 access control function
                'utils/vaccinationHelpers',  // 18 vaccination functions
                'utils/reportHelpers',       // 7 report generation functions

                'billingService',         // Billing service
                'calendarSyncService',    // Calendar sync
                'drugInformationService', // Drug information
                'rxNormService',          // RxNorm drug nomenclature (NLM)
                'dailyMedService',        // DailyMed drug labeling (NLM)
                'medicalParsingService',   // Medical parsing
                'allergiesAssessmentsService', // Allergies assessments CRUD operations

                // Medical Field Mapping Services (35 total)
                'ibdFieldMappingService',
                'geriatricFieldMappingService',
                'nephrologyFieldMappingService',
                'neurologyFieldMappingService',
                'obstetricFieldMappingService',
                'oncologyFieldMappingService',
                'surgicalFieldMappingService',
                'orthopedicFieldMappingService',
                'pediatricFieldMappingService',
                'psychiatricFieldMappingService',
                'pulmonaryFieldMappingService',
                'rheumatologyFieldMappingService',
                'cardiologyFieldMappingService',
                'endocrinologyFieldMappingService',
                'emergencyMedicineFieldMappingService',
                'dermatologyFieldMappingService',
                'anesthesiologyFieldMappingService',
                'radiologyFieldMappingService',
                'pathologyFieldMappingService',
                'ophthalmologyFieldMappingService',
                'entFieldMappingService',
                'infectiousDiseaseFieldMappingService',
                'urologyFieldMappingService',
                'familyMedicineFieldMappingService',
                'pmrFieldMappingService',
                'nuclearMedicineFieldMappingService',
                'plasticSurgeryFieldMappingService',
                'thoracicSurgeryFieldMappingService',
                'colorectalSurgeryFieldMappingService',
                'neurosurgeryFieldMappingService',
                'preventiveMedicineFieldMappingService',
                'medicalGeneticsFieldMappingService',
                'allergyImmunologyFieldMappingService',
                'hematologyFieldMappingService',
                'medicalFieldMappingService'
            ],

            // Phase 8: AI Services (needs all base services)
            ai: [
                'claudeBatchProcessor',     // Claude batch processing (1M context, 50% cheaper)
                'documentAnalysisService',  // Document analysis with AI
                'claudeMedicalImageService', // Claude Vision medical image analysis
                'agentCapabilityManager',   // Agent capability management (needed by agentServiceClaude)
                'enhancedSemanticSelector', // Enhanced semantic selector (MUST be before agentServiceClaude)
                'agentSDKService',          // Agent SDK service
                'agentServiceV4',           // Initialize V4 with learning system at startup
                'agentServiceClaude',
                'agentServiceSmart',
                'aiSecurityWrapper',
                'selfImprovingMemory',
                'workflowPredictorService',
                'personalAssistantService',
                'authAIService',         // Auth AI service
                'elevenLabsSttService',  // ElevenLabs real-time STT for voice visits
                'elevenLabsTtsService'   // ElevenLabs TTS for voice mode audio output
            ],
            
            // Phase 9: Wrapper Services (depends on AI services)
            wrappers: [
                'agentServiceWrapper'
            ]
            
            // Note: Routes are loaded AFTER server creation via loadRoutes() method
        };
        
        this.loadedServices = new Set();
        this.failedServices = new Set();
    }

    /**
     * Initialize all services in correct order
     */
    async initializeAll() {
        const startTime = Date.now();
        console.log('🚀 Starting Master Service Loader...');
        console.log(`Phases: ${Object.keys(this.loadPhases).join(', ')}`);
        console.log(`Total services: ${Object.values(this.loadPhases).flat().length}`);
        
        for (const [phase, services] of Object.entries(this.loadPhases)) {
            console.log(`\n===== PHASE ${phase.toUpperCase()} STARTING =====`);
            const phaseStart = Date.now();
            
            for (const serviceName of services) {
                await this.loadService(serviceName, phase);
            }
            
            const phaseDuration = Date.now() - phaseStart;
            console.log(`===== PHASE ${phase.toUpperCase()} COMPLETE (${phaseDuration}ms) =====`);
        }
        
        const totalDuration = Date.now() - startTime;
        
        console.log('\n✅ Service loading complete!');
        console.log(`   Duration: ${totalDuration}ms`);
        console.log(`   Loaded: ${this.loadedServices.size}`);
        console.log(`   Failed: ${this.failedServices.size}`);
        
        if (this.failedServices.size > 0) {
            console.error('⚠️ Failed services:', Array.from(this.failedServices));
        }
        
        return {
            loaded: Array.from(this.loadedServices),
            failed: Array.from(this.failedServices)
        };
    }

    /**
     * Load a single service
     */
    async loadService(serviceName, phase) {
        const startTime = Date.now();
        
        try {
            console.log(`   Loading ${serviceName}...`);
            
            // Log dependencies if any
            const deps = this.getServiceDependencies(serviceName);
            if (deps.length > 0) {
                console.log(`      Dependencies: ${deps.join(', ')}`);
            }
            
            // FIRST: Register service loader with proxy manager BEFORE initialization
            // This ensures other services can reference it during their initialization
            serviceProxyManager.register(serviceName, () => {
                return this.requireService(serviceName);
            });
            
            // SECOND: Initialize the service if needed
            // Now other services can safely access this one via serviceProxyManager
            if (this.needsInitialization(serviceName)) {
                const service = this.requireService(serviceName);
                if (service && typeof service.initialize === 'function') {
                    console.log(`   🔧 Initializing ${serviceName}...`);
                    await service.initialize();
                    console.log(`   ✅ ${serviceName} initialized`);
                } else if (this.needsInitialization(serviceName)) {
                    console.log(`   ⚠️ ${serviceName} needs init but has no initialize() function`);
                }
            }
            
            const duration = Date.now() - startTime;
            console.log(`   ✓ ${serviceName} loaded (${duration}ms)`);
            this.loadedServices.add(serviceName);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`   ✗ ${serviceName} FAILED (${duration}ms):`, error.message);
            if (error.stack) {
                console.error(`      Stack: ${error.stack.split('\n')[1]}`);
            }
            this.failedServices.add(serviceName);
        }
    }

    /**
     * Require a service module
     */
    requireService(serviceName) {
        const servicePaths = {
            // Core services
            'secureConfigService': './secureConfigService',
            'productionKMS': './productionKMS',
            'encryptionService': './encryptionService',
            'serviceHealthMonitor': './serviceHealthMonitor',
            'keyManagementService': './keyManagementService',
            'secretsManagementService': './secretsManagementService',
            
            // Foundation services
            'databaseFactory': '../utils/databaseFactory',
            'globalModelLoader': './globalModelLoader',
            'serviceRegistry': './serviceRegistry',
            'baseService': './baseService',
            'dbOptimizationService': './dbOptimizationService',
            'dataRetentionService': './dataRetentionService',
            
            // Security services
            'immutableAuditService': './immutableAuditService',
            'serviceAccountManager': './serviceAccountManager',
            'SecureSessionManager': './secureSessionManager',
            'e2eEncryptionService': './e2eEncryptionService',
            'securityMonitoringService': './securityMonitoringService',
            'blockchainAuditService': './blockchainAuditService',
            'zeroTrustService': './zeroTrustService',
            'securityChaosService': './securityChaosService',
            'serviceAccountRotation': './serviceAccountRotation',
            'complianceScorecard': './complianceScorecard',
            'complianceReportingService': './complianceReportingService',
            'securityAuditService': './securityAuditService',
            'mfaService': './mfaService',
            'threatIntelligenceService': './threatIntelligenceService',
            'threatDetectionService': './threatDetectionService',
            'zeroKnowledgeAuthService': './zeroKnowledgeAuthService',
            'securityHeadersOptimizationService': './securityHeadersOptimizationService',
            'graphqlSecurityService': './graphqlSecurityService',
            'cspService': './cspService',
            
            // Database services
            'secureDataAccess': './secureDataAccess',
            'practiceDatabaseManager': './practiceDatabaseManager',
            'emergencyResponse': './emergencyResponse',
            'batchStateManager': './batchStateManager',
            'batchResultsWorker': './batchResultsWorker',
            'medicalDataService': './medicalDataService',
            'documentStorageService': './documentStorageService',
            'patientDeletionService': './patientDeletionService',

            // Phase 4 Refactored Business Services
            'patientService': './patientService',
            'appointmentService': './appointmentService',
            'documentService': './documentService',
            'medicationService': './medicationService',
            'prescriptionService': './prescriptionService',
            'labService': './labService',
            'providerService': './providerService',
            'userService': './userService',
            'clinicService': './clinicService',
            'communicationService': './communicationService',
            'diagnosisService': './diagnosisService',

            // Infrastructure services
            'universalCache': './universalCache',
            'redisCache': './redisCache',
            'mongoChangeStreams': './mongoChangeStreams',
            // 'redisDataSync': './redisDataSync',  // Removed - not needed
            'apiVersioningService': './apiVersioningService',
            'tracingService': './tracingService',
            'circuitBreakerService': './circuitBreakerService',
            'retryService': './retryService',
            'loadBalancingService': './loadBalancingService',
            'disasterRecoveryService': './disasterRecoveryService',
            'costTrackingServiceDB': './costTrackingServiceDB',
            'reminderService': './reminderService',
            'batchProgressCache': './batchProgressCache', // Batch progress cache for real-time batch progress updates (exports class)
            // 'geminiBatchService': './geminiBatchService', // REMOVED
            // 'geminiOptimizedService': './geminiOptimizedService', // REMOVED - switched to Claude
            'patientMatchingService': './patientMatchingService',
            'documentQueueService': './documentQueueService',
            'backupService': './backupService',
            // 'geocodingService': './geocodingService', // REMOVED - not using anymore
            'blueButtonOAuthService': './blueButtonOAuthService',
            'fileCleanup': './fileCleanup',
            'claudeCacheMonitor': './claudeCacheMonitor',
            'externalApiGatewayService': './externalApiGatewayService',
            'webhookSubscriptionService': './webhookSubscriptionService',
            'webhookManagementService': './webhookManagementService',
            
            // Communication services
            'emailService': './emailService',
            'otpService': './otpService',
            'learningWebSocketServer': './learning/learningWebSocketServer',
            'communicationAuditService': './communicationAuditService',
            'smsService': './smsService',
            'bulkCommunicationService': './bulkCommunicationService',
            'patientPortalMessagingService': './patientPortalMessagingService',
            
            // Learning & Memory services
            'learningServicesInitializer': './learning/learningServicesInitializer',
            'proceduralMemoryService': './learning/proceduralMemoryService',
            'claudeMemoryService': './claudeMemoryService',
            'workflowEngine': './workflowEngine',

            // Business services
            'billingService': './billingService',
            'calendarSyncService': './calendarSyncService',
            'drugInformationService': './drugInformationService',
            'rxNormService': './rxNormService',
            'dailyMedService': './dailyMedService',
            'medicalParsingService': './medicalParsingService',
            'allergiesAssessmentsService': './allergiesAssessmentsService',
            'providerDirectoryService': './providerDirectoryService',
            'clinicalResearchService': './clinicalResearchService',
            'regulatoryComplianceService': './regulatoryComplianceService',
            'medicationEntitlementService': './medicationEntitlementService',

            // Medical Field Mapping Services
            'ibdFieldMappingService': './ibdFieldMappingService',
            'geriatricFieldMappingService': './geriatricFieldMappingService',
            'nephrologyFieldMappingService': './nephrologyFieldMappingService',
            'neurologyFieldMappingService': './neurologyFieldMappingService',
            'obstetricFieldMappingService': './obstetricFieldMappingService',
            'oncologyFieldMappingService': './oncologyFieldMappingService',
            'surgicalFieldMappingService': './surgicalFieldMappingService',
            'orthopedicFieldMappingService': './orthopedicFieldMappingService',
            'pediatricFieldMappingService': './pediatricFieldMappingService',
            'psychiatricFieldMappingService': './psychiatricFieldMappingService',
            'pulmonaryFieldMappingService': './pulmonaryFieldMappingService',
            'rheumatologyFieldMappingService': './rheumatologyFieldMappingService',
            'cardiologyFieldMappingService': './cardiologyFieldMappingService',
            'endocrinologyFieldMappingService': './endocrinologyFieldMappingService',
            'emergencyMedicineFieldMappingService': './emergencyMedicineFieldMappingService',
            'dermatologyFieldMappingService': './dermatologyFieldMappingService',
            'anesthesiologyFieldMappingService': './anesthesiologyFieldMappingService',
            'radiologyFieldMappingService': './radiologyFieldMappingService',
            'pathologyFieldMappingService': './pathologyFieldMappingService',
            'ophthalmologyFieldMappingService': './ophthalmologyFieldMappingService',
            'entFieldMappingService': './entFieldMappingService',
            'infectiousDiseaseFieldMappingService': './infectiousDiseaseFieldMappingService',
            'urologyFieldMappingService': './urologyFieldMappingService',
            'familyMedicineFieldMappingService': './familyMedicineFieldMappingService',
            'pmrFieldMappingService': './pmrFieldMappingService',
            'nuclearMedicineFieldMappingService': './nuclearMedicineFieldMappingService',
            'plasticSurgeryFieldMappingService': './plasticSurgeryFieldMappingService',
            'thoracicSurgeryFieldMappingService': './thoracicSurgeryFieldMappingService',
            'colorectalSurgeryFieldMappingService': './colorectalSurgeryFieldMappingService',
            'neurosurgeryFieldMappingService': './neurosurgeryFieldMappingService',
            'preventiveMedicineFieldMappingService': './preventiveMedicineFieldMappingService',
            'medicalGeneticsFieldMappingService': './medicalGeneticsFieldMappingService',
            'allergyImmunologyFieldMappingService': './allergyImmunologyFieldMappingService',
            'hematologyFieldMappingService': './hematologyFieldMappingService',
            'medicalFieldMappingService': './medicalFieldMappingService',

            // AI services
            'claudeMedicalImageService': './claudeMedicalImageService', // Claude Vision medical image analysis
            'claudeBatchProcessor': './claudeBatchProcessor',  // Claude batch processing (1M context, 50% cheaper)
            // 'geminiMedicalService': './geminiMedicalService', // REMOVED - switched to Claude
            'documentAnalysisService': './documentAnalysisService',
            'enhancedSemanticSelector': './enhancedSemanticSelector', // Function selection with pattern matching
            'functionRegistry': './functionRegistry', // O(1) function lookup
            'nativeVectorSearch': './nativeVectorSearch', // Native HNSW vector search for Windows
            'agentSDKService': './agentSDKService',  // Agent SDK service
            'agentServiceClaude': './agentServiceClaude',
            'agentServiceV4': './agentServiceV4', // Restored for learning system
            'agentServiceSmart': './agentServiceSmart',
            'aiSecurityWrapper': './aiSecurityWrapper',
            'selfImprovingMemory': './selfImprovingMemory',
            'workflowPredictorService': './learning/workflowPredictorService',
            'personalAssistantService': './learning/personalAssistantService',
            'authAIService': './authAIService',
            'elevenLabsSttService': './elevenLabsSttService',
            'elevenLabsTtsService': './elevenLabsTtsService',

            // Wrapper services
            'agentServiceWrapper': './agentServiceWrapper',
            
            // Route loader
            'routeLoaderService': './routeLoaderService'
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
            'secureConfigService',
            'productionKMS',
            'databaseFactory',
            'globalModelLoader',
            'immutableAuditService',
            'serviceAccountManager',
            'SecureSessionManager',
            'secureDataAccess',
            'practiceDatabaseManager',
            'medicalDataService',       // Added - needs initialization for service auth
            'documentStorageService',   // Added - needs initialization for service auth
            'universalCache',           // Added - needs initialization to connect to Redis and check ENABLE_UNIVERSAL_CACHE
            'mongoChangeStreams',       // Added - needs initialization to start watching
            // 'redisDataSync' removed - using simple cache on first request approach
            'learningServicesInitializer',
            'proceduralMemoryService',
            'claudeMemoryService',
            'workflowEngine',
            'claudeMedicalImageService', // Needs init for KMS API key + service auth
            'claudeBatchProcessor',     // CRITICAL - Batch API with 1M context (pre-load for fast first upload)
            'documentAnalysisService',  // Added - needs initialization for API keys
            'agentServiceV4',           // Added - needs initialization for service authentication
            'enhancedSemanticSelector', // CRITICAL - initialize at startup for fast function selection (~195ms)
            'functionRegistry',         // CRITICAL - initialize at startup for O(1) lookup (<1ms)
            // 'nativeVectorSearch',    // DISABLED - using two-stage Claude selector instead (avoiding 1413 embeddings)
            // 'naturalLanguageQueryService', // REMOVED - needs initialization for embedding service and database connections
            'agentServiceClaude',
            'agentServiceWrapper',  // Added - needs initialization after dependencies
            'patientMatchingService', // Added - needs initialization for service auth
            'documentQueueService',  // Added - needs initialization for queue management
            'batchProgressCache',    // Added - needs initialization for service auth and cleanup
            'batchStateManager',     // CRITICAL - needs initialization for service auth and batch recovery on startup
            // Phase 4 Refactored Services - need initialization for service auth
            'patientService',
            'appointmentService',
            'documentService',
            'medicationService',
            'prescriptionService',
            'labService',
            'providerService',
            'userService',
            'clinicService',
            'communicationService',

            // Restored services that need initialization
            'patientDeletionService',
            'billingService',
            'securityAuditService',
            'smsService',
            'mfaService',
            'blueButtonOAuthService',
            'geocodingService',
            'threatDetectionService',
            'zeroKnowledgeAuthService',
            'communicationAuditService',
            'bulkCommunicationService',
            'calendarSyncService',
            'drugInformationService',
            'rxNormService',
            'dailyMedService',
            'medicalParsingService',
            'webhookManagementService',
            'patientPortalMessagingService',
            'externalApiGatewayService',
            'providerDirectoryService',
            'allergiesAssessmentsService', // Allergies assessments service - ensure loaded at startup
            // 'geocodingService' // REMOVED - not using anymore
            'elevenLabsSttService',  // ElevenLabs real-time STT — needs init for KMS API key
            'elevenLabsTtsService'   // ElevenLabs TTS — needs init for KMS API key
        ];
        return initServices.includes(serviceName);
    }

    /**
     * Get service dependencies
     */
    getServiceDependencies(serviceName) {
        // Define known service dependencies for better tracking
        const dependencies = {
            'secureConfigService': ['productionKMS'],
            'globalModelLoader': ['databaseFactory'],
            'serviceAccountManager': ['immutableAuditService', 'globalModelLoader'],
            'secureDataAccess': ['serviceAccountManager', 'databaseFactory'],
            'clinicDatabaseManager': ['databaseFactory', 'secureDataAccess'],
            'agentServiceClaude': ['serviceAccountManager', 'secureDataAccess'],
            'agentServiceV4': ['serviceAccountManager', 'secureDataAccess'], // Restored for learning system
            'agentServiceWrapper': [
                'secureConfigService',      // Phase 1 - for API key checks
                'immutableAuditService',    // Phase 3 - for audit logging
                'agentServiceClaude',       // Phase 8 - main AI service
                'agentServiceSmart',        // Phase 8 - smart agent
                'aiSecurityWrapper',        // Phase 8 - security wrapper
                // 'naturalLanguageQueryService', // REMOVED - Phase 8 - natural language query service
                'selfImprovingMemory',      // Phase 8 - memory service
                'workflowPredictorService', // Phase 8 - workflow prediction
                'personalAssistantService'  // Phase 8 - personal assistant
            ],
            // 'geminiBatchService': [  // REMOVED
            //     'productionKMS',
            //     'serviceAccountManager'
            // ],
            'documentAnalysisService': [
                'serviceAccountManager',    // Phase 3 - for authentication
                'claudeBatchProcessor'      // Phase 8 - for processing documents
            ],
            'claudeBatchProcessor': [
                'productionKMS',            // Phase 1 - for Claude API key
                'serviceAccountManager'     // Phase 3 - for authentication
            ],
            'documentQueueService': [
                'serviceAccountManager',    // Phase 3 - for authentication
                'documentAnalysisService'   // Phase 8 - for processing documents inline
            ],
            'patientMatchingService': [
                'serviceAccountManager',    // Phase 3 - for authentication
                'secureDataAccess'         // Phase 3 - for database operations
            ],
            'medicalDataService': [
                'serviceAccountManager',    // Phase 3 - for authentication
                'secureDataAccess'         // Phase 4 - for database operations
            ],
            'documentStorageService': [
                'serviceAccountManager',    // Phase 3 - for authentication
                'secureDataAccess'         // Phase 4 - for database operations
            ]
        };
        
        return dependencies[serviceName] || [];
    }

    /**
     * Get service loading report
     */
    getReport() {
        return {
            phases: Object.keys(this.loadPhases),
            totalServices: Object.values(this.loadPhases).flat().length,
            loaded: this.loadedServices.size,
            failed: this.failedServices.size,
            loadedList: Array.from(this.loadedServices),
            failedList: Array.from(this.failedServices)
        };
    }
}

// Export singleton instance
module.exports = new MasterServiceLoader();
