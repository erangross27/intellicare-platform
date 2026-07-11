# Task 11: Set Up AI & Analytics Context

## Objective
Create the AI & Analytics bounded context for intelligence and reporting

## Prerequisites
- Task_10 completed (communication context)
- libs/ai-analytics/ directory exists

## Implementation Steps

### 1. Create Subdirectory Structure
```
libs/ai-analytics/
├── feature-claude/       # Claude AI integration
├── feature-gemini/       # Gemini medical AI
├── feature-analytics/    # Analytics engine
├── feature-reporting/    # Report generation
├── feature-ml/          # Machine learning
├── data-access-ai/      # AI data layer
├── domain-intelligence/ # AI domain models
├── util-prompts/        # Prompt engineering
└── index.js            # Barrel export
```

### 2. List Services to Migrate (35 services)
- agentServiceClaude
- agentServiceV4
- agentServiceV4Modular
- agentServiceWrapper
- agentServiceHelpers
- agentServiceSmart
- claudeBatchService
- claudeBatchProcessor
- claudeMemoryService
- claudeCacheMonitor
- analyticsApiGateway
- analyticsSecurityService
- clinicalAnalyticsService
- businessIntelligenceDashboardService
- conversationalAnalyticsService
- benchmarkingAnalysisService
- aiResponseCacheService
- aiCircuitBreakerService
- aiSecurityWrapper
- backupAIProviderService
- (35 total services)

### 3. Define AI Domain Models
- AIConversation entity
- AnalyticsReport entity
- MLModel entity
- Prediction entity
- InsightEntity

### 4. Set Up Prompt Management
- Medical prompts
- Administrative prompts
- Conversation templates
- Response validators

### 5. Configure AI Providers
- Claude configuration
- Gemini configuration
- Fallback providers
- Rate limiting

### 6. Create Analytics Pipeline
Data processing and reporting flow

## Expected Outcomes
- ✅ AI context structured
- ✅ 35 services organized
- ✅ Prompt system ready
- ✅ Analytics pipeline configured
- ✅ Multiple AI providers setup

## Validation Steps
1. Verify all 35 services mapped
2. Check AI configurations
3. Test prompt system
4. Review analytics setup

## Rollback Plan
1. Remove AI directories
2. Delete configurations
3. Restore original structure

## Time Estimate
- Implementation: 40 minutes
- Testing: 20 minutes
- Documentation: 15 minutes

## Dependencies
- Task_10 (communication context)

## Next Task
Task_12_INFRASTRUCTURE_CONTEXT.md

## Notes for Agent
- Keep Claude and Gemini separate
- Organize by AI function
- Document prompt engineering
- Consider AI fallback strategy