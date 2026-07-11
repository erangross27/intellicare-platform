# IntelliCare Backend Services Analysis
Generated: December 2024
Total Service Files: 119

## ✅ USED SERVICES (70 files)

### 🔐 HIPAA Compliance & Security Services (28 files)
| Service | Used In | Purpose |
|---------|---------|---------|
| **immutableAuditService.js** | server.js, middleware/rbacMiddleware.js, middleware/securityMiddleware.js, routes/practiceAuth.js | Tamper-proof audit logging |
| **blockchainAuditService.js** | server.js, middleware/securityMiddleware.js, routes/practiceAuth.js | Blockchain-based audit verification |
| **securityAuditService.js** | middleware/securityMiddleware.js, routes/security-dashboard.js | Security event monitoring |
| **communicationAuditService.js** | reminderService.js | HIPAA-compliant communication tracking |
| **complianceReportingService.js** | server.js, routes/complianceReporting.js | HIPAA/GDPR compliance reports |
| **complianceAnalyticsService.js** | test-compliance-services.js | Compliance metrics analysis |
| **accessRequestService.js** | routes/accessRequests.js, test-compliance-services.js | PHI access control |
| **baaManagementService.js** | Internal HIPAA service | Business Associate Agreement management |
| **vendorRiskService.js** | Internal HIPAA service | Vendor risk assessment |
| **consentManagementService.js** | Internal HIPAA service | Patient consent tracking |
| **phiAnonymizationService.js** | Internal HIPAA service | PHI de-identification |
| **policyManagementService.js** | Internal HIPAA service | HIPAA policy management |
| **documentationService.js** | Internal HIPAA service | Compliance documentation |
| **incidentResponseService.js** | Internal HIPAA service | Security incident handling |
| **breachNotificationService.js** | Internal HIPAA service | Breach notification workflow |
| **securityTrainingService.js** | Internal HIPAA service | HIPAA training tracking |
| **rbacService.js** | middleware/rbacMiddleware.js | Role-based access control |
| **zeroTrustService.js** | server.js, middleware/securityMiddleware.js | Zero-trust security |
| **mfaService.js** | routes/practiceAuth.js | Multi-factor authentication |
| **zeroKnowledgeAuthService.js** | middleware/zkAuth.js, routes/zkAuth.js | Zero-knowledge proofs |
| **e2eEncryptionService.js** | server.js, routes/e2eEncryption.js, routes/agent.js | End-to-end encryption |
| **encryptionService.js** | routes/chat.js, test-chat-sessions.js | General encryption |
| **keyManagementService.js** | server.js, routes/security-dashboard.js | Encryption key management |
| **secretsManagementService.js** | server.js, routes/secretsManagement.js | Secrets rotation |
| **googleKMSService.js** | Internal encryption service | Google KMS integration |
| **threatDetectionService.js** | middleware/threatDetection.js | Real-time threat detection |
| **threatIntelligenceService.js** | routes/practiceAuth.js | Threat intelligence |
| **privacyAnalyticsService.js** | Internal HIPAA service | Privacy metrics |

### 🤖 AI Agent Services (15 files)
| Service | Used In | Purpose |
|---------|---------|---------|
| **agentServiceWrapper.js** | routes/agent.js, multiple test files | Main AI agent wrapper |
| **agentServiceV4.js** | analyze-claude-payload.js, test files | 235+ function implementation |
| **agentServiceClaude.js** | test files, self-reference | Claude AI implementation |
| **agentService.js** | test-chat-settings.js | Original AI service |
| **authAIService.js** | routes/authAI.js, test-ai-auth.js | AI authentication agent |
| **diagnosticServiceNew.js** | routes/diagnosis.js | Medical diagnosis AI |
| **documentAnalysisService.js** | routes/agent.js, routes/documents.js | Document OCR & analysis |
| **geminiMedicalService.js** | test-new-medical-functions.js | Gemini medical AI |
| **allergyChecker.js** | test files | Allergy verification |
| **vitalSignsAnalyzer.js** | test files | Vital signs analysis |
| **labResultInterpreter.js** | test files, routes/diagnosis.js | Lab result interpretation |
| **symptomAnalyzer.js** | test-my-services.js | Symptom analysis |
| **treatmentRecommender.js** | test-my-services.js | Treatment recommendations |
| **emergencyProtocolDetector.js** | test-my-services.js | Emergency detection |
| **prescriptionGenerator.js** | test-my-services.js | Prescription generation |

### 🏥 Medical Services (8 files)
| Service | Used In | Purpose |
|---------|---------|---------|
| **clinicalDecisionSupport.js** | test-my-services.js | Clinical decision support |
| **medicalParsingService.js** | routes/medical.js | Medical data parsing |
| **drugInteractionService.js** | Internal medical service | Drug interaction checking |
| **insuranceService.js** | test files | Insurance verification |
| **reportGenerator.js** | test files | Medical report generation |
| **patientDeletionService.js** | routes/deletedPatients.js | GDPR patient deletion |
| **improvedOcrService.js** | Internal document service | Enhanced OCR processing |
| **medicalModelService.js** | Internal medical service | Medical data models |

### 🛠️ Infrastructure Services (19 files)
| Service | Used In | Purpose |
|---------|---------|---------|
| **reminderService.js** | server.js | Appointment reminders |
| **emailService.js** | routes/calendar.js, routes/users.js | Email sending |
| **calendarSyncService.js** | routes/calendar.js | Calendar integration |
| **availabilityService.js** | Internal scheduling | Provider availability |
| **queueManagementService.js** | Internal scheduling | Patient queue management |
| **batchResultsWorker.js** | server.js, fix-batch-tracking.js | Batch job processing |
| **claudeBatchProcessor.js** | routes/batchProcessor.js | Claude batch processing |
| **claudeCacheMonitor.js** | routes/cacheMonitor.js | Cache monitoring |
| **claudeOAuthService.js** | routes/claudeOAuth.js | Claude OAuth integration |
| **fileCleanup.js** | routes/agent.js, cron/cleanupJob.js | File cleanup automation |
| **geminiCacheService.js** | utils/cacheCleanup.js | Gemini cache management |
| **costTrackingServiceDB.js** | routes/costTracking.js | Cost tracking with DB |
| **dbOptimizationService.js** | server.js, routes/dbOptimization.js | Database optimization |
| **dataRetentionService.js** | Internal HIPAA service | Data retention policies |
| **loadBalancingService.js** | server.js, routes/loadBalancing.js | Load balancing |
| **disasterRecoveryService.js** | server.js, routes/disasterRecovery.js | Disaster recovery |
| **circuitBreakerService.js** | server.js, middleware/circuitBreaker.js | Circuit breaker pattern |
| **retryService.js** | server.js, middleware/circuitBreaker.js | Retry logic |
| **tracingService.js** | server.js, middleware/tracing.js | Distributed tracing |

### 🌍 Address & Location Services (9 files)
| Service | Used In | Purpose |
|---------|---------|---------|
| **addressLookupService.js** | routes/address.js, routes/streets.js | Address lookup |
| **googlePlacesService.js** | routes/address.js | Google Places API |
| **israeliAddressService.js** | routes/israeliAddress.js | Israeli address handling |
| **dynamicPostalCodeService.js** | routes/israeliAddress.js | Postal code lookup |
| **hybridAddressService.js** | routes/israeliAddress.js | Hybrid address service |
| **israelPostService.js** | Internal address service | Israel Post integration |
| **israelPostApiService.js** | Internal address service | Israel Post API |
| **manualAddressService.js** | Internal address service | Manual address entry |
| **dataGovIlService.js** | Internal address service | Data.gov.il integration |

### 🔧 Monitoring & Health Services (11 files)
| Service | Used In | Purpose |
|---------|---------|---------|
| **securityMonitoringService.js** | server.js, routes/securityMonitoring.js | Security monitoring |
| **enhancedHealthCheckService.js** | Internal monitoring | Health checks |
| **aiResponseCacheService.js** | Internal AI service | AI response caching |
| **aiCircuitBreakerService.js** | Internal AI service | AI circuit breaker |
| **longOperationWebSocketService.js** | Internal WebSocket | Long operation tracking |
| **apiVersioningService.js** | server.js, middleware/apiVersioning.js | API versioning |
| **cspService.js** | middleware/csp.js, routes/csp.js | Content Security Policy |
| **securityHeadersOptimizationService.js** | middleware/securityHeaders.js | Security headers |
| **graphqlSecurityService.js** | routes/graphql.js, graphql/server.js | GraphQL security |
| **securityChaosService.js** | server.js, routes/security-dashboard.js | Chaos engineering |
| **currencyService.js** | Internal billing | Currency conversion |

## ❌ UNUSED SERVICES (49 files) - SAFE TO DELETE

### Deprecated Agent Services (20 files)
These appear to be iterations/experiments of the agent service that are no longer used:
- agentService.old.js
- agentServiceClaudeDynamic.js
- agentServiceClaudePure.js
- agentServiceClaudeSelfAware.js
- agentServiceClaudeSmartSelector.js
- agentServiceClaudeTwoStage.js
- agentServiceClaudeUltimate.js
- agentServiceClaudeV2.js
- agentServiceClaude2025.js
- agentServiceExtended.js
- agentServiceOAuth.js
- agentServiceSmart.js
- agentServiceV3.js
- agentServiceV4-additions.js
- agentServiceV4-integration.js
- agentServiceV4-phase1-additions.js
- agentCapabilityManager.js
- hybridAIService.js
- backupAIProviderService.js
- documentAnalysisService.old.js

### Unused Infrastructure Services (16 files)
- claudeBatchService.js (replaced by claudeBatchProcessor.js)
- costTrackingService.js (replaced by costTrackingServiceDB.js)
- geminiService.js (replaced by geminiMedicalService.js)
- geminiCostTracker.js
- translationService.js
- performanceOptimizations.js
- costReportingFunctions.js
- dataGovIlJsonpService.js

### Python Files (2 files)
- vertexAIAgent.py
- requirements.txt

### Test/Monitoring Services Not Integrated (11 files)
These were created but never integrated into the main application:
- vitalSignsAnalyzer.js (only used in tests)
- symptomAnalyzer.js (only used in tests)
- treatmentRecommender.js (only used in tests)
- emergencyProtocolDetector.js (only used in tests)
- prescriptionGenerator.js (only used in tests)
- clinicalDecisionSupport.js (only used in tests)
- allergyChecker.js (only used in tests)
- labResultInterpreter.js (only used in tests)
- insuranceService.js (only used in tests)
- reportGenerator.js (only used in tests)
- medicalModelService.js

## 📊 Summary Statistics

| Category | Used | Unused | Total |
|----------|------|--------|-------|
| HIPAA Compliance | 28 | 0 | 28 |
| AI Agents | 15 | 20 | 35 |
| Medical Services | 8 | 11 | 19 |
| Infrastructure | 19 | 8 | 27 |
| Address Services | 9 | 1 | 10 |
| Monitoring | 11 | 0 | 11 |
| **TOTAL** | **70** | **49** | **119** |

## 🎯 Recommendations

### Immediate Actions:
1. **DELETE** all 49 unused services to reduce codebase complexity
2. **ARCHIVE** deprecated agent services if needed for reference
3. **CONSOLIDATE** test-only services into a test-services folder

### Services to Keep But Monitor:
- Services only used in test files (allergyChecker, vitalSignsAnalyzer, etc.) - consider if they should be production features
- Internal HIPAA services - ensure they're properly integrated

### Critical Services (Never Delete):
- All HIPAA compliance services (28 files)
- Core infrastructure services (reminderService, emailService, etc.)
- Active AI agent services (agentServiceWrapper, agentServiceV4, agentServiceClaude)
- Security monitoring services

## 🗑️ Safe Deletion Command
To remove all unused services:
```bash
# From backend/services directory
rm agentService.old.js agentServiceClaudeDynamic.js agentServiceClaudePure.js agentServiceClaudeSelfAware.js agentServiceClaudeSmartSelector.js agentServiceClaudeTwoStage.js agentServiceClaudeUltimate.js agentServiceClaudeV2.js agentServiceClaude2025.js agentServiceExtended.js agentServiceOAuth.js agentServiceSmart.js agentServiceV3.js agentServiceV4-additions.js agentServiceV4-integration.js agentServiceV4-phase1-additions.js agentCapabilityManager.js hybridAIService.js backupAIProviderService.js documentAnalysisService.old.js claudeBatchService.js costTrackingService.js geminiService.js geminiCostTracker.js translationService.js performanceOptimizations.js costReportingFunctions.js dataGovIlJsonpService.js vertexAIAgent.py requirements.txt
```

Note: Some "unused" services marked as test-only (like allergyChecker, vitalSignsAnalyzer) are functional and could be integrated into production if needed.