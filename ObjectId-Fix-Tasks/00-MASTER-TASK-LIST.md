# ObjectId Fix Master Task List
## Total: 584 instances across 60 files need manual fixing

## CRITICAL RULE
Each `{ _id: variableName }` must be analyzed to determine:
1. Where does `variableName` come from?
2. Is it already an ObjectId or is it a string?
3. Should we convert it at the source or at the query point?
4. GOAL: Variables should be ObjectIds from the beginning, not converted at query time

## Files to Fix (sorted by priority and instance count)

### PRIORITY 1: Core Medical Functions (368 instances)
- [ ] generatedMedicalFunctions.js - 368 instances

### PRIORITY 2: Main Agent Services (64 instances)
- [ ] agentServiceV4.js - 39 instances
- [ ] agentServiceClaude.js - 7 instances
- [ ] agentServiceHelpers.js - 7 instances
- [ ] agentServiceV4-phase1-additions.js - 7 instances
- [ ] agentService/coreFunctions.js - 4 instances
- [ ] agentService/medicalFunctions.js - 4 instances
- [ ] agentService/adminFunctions.js - 4 instances

### PRIORITY 3: Security & Compliance (41 instances)
- [ ] baaManagementService.js - 11 instances
- [ ] securityTrainingService.js - 6 instances
- [ ] mfaService.js - 4 instances
- [ ] rbacService.js - 4 instances
- [ ] policyManagementService.js - 4 instances
- [ ] hipaaComplianceService.js - 3 instances
- [ ] zeroTrustService.js - 3 instances
- [ ] secureSessionManager.js - 3 instances
- [ ] vendorRiskService.js - 3 instances

### PRIORITY 4: Patient Services (24 instances)
- [ ] patientPortalMessagingService.js - 9 instances
- [ ] patientDeletionService.js - 7 instances
- [ ] patientMatchingService.js - 2 instances
- [ ] reminderService.js - 4 instances
- [ ] healthCampaignService.js - 4 instances

### PRIORITY 5: Communication Services (13 instances)
- [ ] otpService.js - 5 instances
- [ ] smsService.js - 4 instances
- [ ] messageTemplateService.js - 2 instances
- [ ] bulkCommunicationService.js - 1 instance
- [ ] webhookSubscriptionService.js - 1 instance

### PRIORITY 6: Medical Support Services (11 instances)
- [ ] medicalDataService.js - 2 instances
- [ ] medicationPrescriptionService.js - 3 instances
- [ ] documentAnalysisService.js - 2 instances
- [ ] documentStorageService.js - 1 instance
- [ ] diagnosisSupportService.js - 1 instance
- [ ] treatmentPlanningService.js - 1 instance
- [ ] clinicalNotesService.js - 1 instance

### PRIORITY 7: Analytics & Reporting (14 instances)
- [ ] performanceScorecardsService.js - 4 instances
- [ ] providerPerformanceAnalyticsService.js - 2 instances
- [ ] analyticsApiGateway.js - 2 instances
- [ ] financialReportingService.js - 1 instance
- [ ] enhancedDataVisualizationService.js - 1 instance
- [ ] dataWarehouseService.js - 1 instance
- [ ] complianceAnalyticsService.js - 1 instance
- [ ] predictiveAnalyticsService.js - 1 instance
- [ ] benchmarkingAnalysisService.js - 1 instance

### PRIORITY 8: Training & Education (11 instances)
- [ ] competencyAssessmentService.js - 5 instances
- [ ] continuingEducationService.js - 4 instances
- [ ] trainingService.js - 1 instance
- [ ] selfImprovingMemory.js - 2 instances

### PRIORITY 9: Other Services (20 instances)
- [ ] batchResultsWorker.js - 6 instances
- [ ] accessRequestService.js - 4 instances
- [ ] calendarSyncService.js - 3 instances
- [ ] billingService.js - 2 instances
- [ ] authAIService.js - 2 instances
- [ ] complianceAuditService.js - 2 instances
- [ ] breachNotificationService.js - 2 instances
- [ ] claudeMemoryService.js - 1 instance
- [ ] incidentResponseService.js - 1 instance
- [ ] privacyRuleEnforcementService.js - 1 instance
- [ ] workflowEngine.js - 1 instance
- [ ] secureDataAccess.js - 1 instance
- [ ] learning/learningWebSocketServer.js - 1 instance

## Checkpoint System
Each file will have:
1. A task file listing every line that needs fixing
2. A checkpoint entry when completed
3. Verification that the fix uses ObjectId properly at the source

## Fix Approach
For each instance:
1. Trace back where the ID variable originates
2. Ensure it's converted to ObjectId at the source
3. Remove any string-to-ObjectId conversions at query time
4. Verify the fix doesn't break other code

## Progress Tracking
- Total Files: 60
- Total Instances: 584
- Files Completed: 0
- Instances Fixed: 0
- Last Updated: [timestamp]