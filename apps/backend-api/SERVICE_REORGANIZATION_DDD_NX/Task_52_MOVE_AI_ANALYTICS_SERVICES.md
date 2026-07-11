# Task 52: Move AI & Analytics Services

## Objective
Move 65 AI and analytics services to ai-analytics context with Claude and Gemini integration preservation

## Prerequisites
- Task_51 completed (billing services moved)
- AI context ready
- API keys secured in KMS

## Implementation Steps

### 1. AI & Analytics Services (65 services)
```
FROM: backend/services/
TO: libs/ai-analytics/

Core AI Services:
- agentServiceClaude.js → feature-claude/
- agentServiceV4.js → feature-platform-ai/
- agentServiceWrapper.js → feature-orchestration/
- geminiMedicalService.js → feature-gemini/
- aiOrchestrationService.js → feature-orchestration/

Chat & Conversation:
- chatService.js → feature-chat/
- conversationService.js → feature-conversation/
- messageService.js → feature-messaging/
- contextService.js → feature-context/
- sessionChatService.js → feature-chat-sessions/

Medical AI:
- diagnosticAIService.js → feature-medical-ai/
- clinicalDecisionService.js → feature-clinical-ai/
- drugInteractionService.js → feature-drug-ai/
- symptomAnalysisService.js → feature-symptom-ai/
- riskAssessmentService.js → feature-risk-ai/

Analytics Core:
- analyticsService.js → feature-analytics-core/
- metricsService.js → feature-metrics/
- reportingService.js → feature-reporting/
- dashboardService.js → feature-dashboards/
- dataVisualizationService.js → feature-visualization/

Machine Learning:
- mlModelService.js → feature-ml-models/
- predictionService.js → feature-predictions/
- anomalyDetectionService.js → feature-anomaly/
- patternRecognitionService.js → feature-patterns/
- recommendationService.js → feature-recommendations/

AgentServiceV4 Modules (30):
- ai-* modules → feature-agent-ai/
- analytics-* modules → feature-agent-analytics/
- ml-* modules → feature-agent-ml/
```

### 2. Claude AI Service Migration
```javascript
class ClaudeServiceMigrator {
  async migrateClaudeService() {
    // Preserve API key access
    await this.validateClaudeAPIKey();
    
    // Maintain conversation context
    await this.preserveConversationContext();
    
    // Migrate chat sessions
    await this.migrateChatSessions();
    
    // Validate AI functionality
    await this.validateClaudeResponses();
  }
}
```

### 3. Platform AI (AgentServiceV4) Migration
Critical 235+ function preservation:
- Maintain all existing functions
- Preserve function orchestration
- Keep session management
- Maintain error handling
- Preserve performance optimizations

### 4. Medical AI Services Protection
```javascript
class MedicalAIMigrator {
  async migrateMedicalAI() {
    // Preserve Gemini integration (when API key available)
    await this.validateGeminiIntegration();
    
    // Maintain clinical decision support
    await this.preserveClinicalAI();
    
    // Migrate diagnostic algorithms
    await this.migrateDiagnosticAI();
    
    // Validate medical accuracy
    await this.validateMedicalAI();
  }
}
```

### 5. Analytics Engine Migration
Preserve analytics capabilities:
- Data processing pipelines
- Report generation engines
- Dashboard configurations
- Visualization components
- Performance metrics

### 6. Machine Learning Model Migration
```javascript
class MLModelMigrator {
  async migrateMLModels() {
    // Preserve trained models
    await this.preserveTrainedModels();
    
    // Migrate model configurations
    await this.migrateModelConfigs();
    
    // Maintain prediction accuracy
    await this.validatePredictionAccuracy();
    
    // Update model endpoints
    await this.updateModelEndpoints();
  }
}
```

### 7. Chat System Integration
Critical chat functionality:
- Message encryption/decryption
- Session management
- Context preservation
- Multi-language support
- Real-time capabilities

### 8. API Key Management
Secure AI API key handling:
- Claude API key (KMS: ANTHROPIC_API_KEY)
- Gemini API key (KMS: GOOGLE_API_KEY) 
- Other AI service keys
- Secure key rotation
- Access audit logging

### 9. Performance Optimization
Optimize AI performance:
- Response time optimization
- Memory usage management
- Caching strategies
- Load balancing
- Rate limit handling

### 10. Testing and Validation
```javascript
class AIServiceTester {
  async validateAIServices() {
    // Test Claude responses
    await this.testClaudeIntegration();
    
    // Validate chat functionality
    await this.validateChatSystem();
    
    // Test analytics accuracy
    await this.testAnalyticsAccuracy();
    
    // Validate ML predictions
    await this.validateMLPredictions();
  }
}
```

## Expected Outcomes
- ✅ 65 AI services migrated
- ✅ Claude AI functioning
- ✅ Chat system operational
- ✅ Analytics preserved
- ✅ ML models functional

## Validation Steps
1. AI service functionality testing
2. Chat system validation
3. Analytics accuracy verification
4. ML model performance testing
5. API key security audit

## Time Estimate
- AI service migration: 10 hours
- Chat system testing: 4 hours
- Analytics validation: 4 hours
- ML testing: 4 hours
- Performance optimization: 4 hours

## Dependencies
- Task_51 (billing services moved)
- AI context configured
- API keys available in KMS

## Next Task
Task_53_MOVE_INFRASTRUCTURE_SERVICES.md

## Notes for Agent
- CRITICAL: Preserve all AI functionality
- Test chat system extensively
- Validate Claude responses
- Ensure analytics accuracy
- Monitor API usage and costs