# Task 36: Move Patient Management Services

## Objective
Move 28 patient-related services to patient-management context (includes AgentServiceV4 modules)

## Prerequisites
- Tasks 1-35 completed
- Patient context structure ready
- AgentServiceV4 patient modules extracted

## Implementation Steps

### 1. Original Patient Services to Move (16)
```
FROM: backend/services/
TO: libs/patient-management/

- patientDataEnrichmentService.js → feature-records/
- patientDeletionService.js → feature-records/
- patientPopulationAnalyticsService.js → feature-records/
- patientPortalMessagingService.js → feature-portal/
- consentManagementService.js → feature-consent/
- demographicsService.js → feature-records/
- patientSearchService.js → feature-records/
- patientMergeService.js → feature-records/
- patientExportService.js → feature-records/
- patientImportService.js → feature-records/
- patientValidationService.js → util-validators/
- patientHistoryService.js → feature-records/
- patientNotificationService.js → feature-portal/
- patientPreferencesService.js → feature-portal/
- patientRelationshipService.js → feature-records/
- patientRiskAssessmentService.js → feature-records/
```

### 2. AgentServiceV4 Patient Modules (25)
Already extracted in Task_18, now integrate:
```
FROM: Temporary extraction location
TO: libs/patient-management/feature-agent-patient/
- All 25 patient modules from AgentServiceV4
```

### 3. Additional New Services (3)
Create if not existing:
- patientTimelineService.js
- patientCareTeamService.js
- patientGoalsService.js

### 4. Update Service Registry
Register all 28 services:
- Service IDs
- API keys
- Permissions
- Dependencies

### 5. Update Import Paths
Change all imports to use:
```
@intellicare/patient-management
```

### 6. Add Authentication
Each service needs:
- ServiceAccount registration
- API key in KMS
- Context passing
- Audit logging

### 7. Test Service Loading
Verify all 28 services:
- Load successfully
- Authenticate properly
- Function correctly
- No circular dependencies

### 8. Update Patient Index
Export all services properly

### 9. Run Integration Tests
Test patient workflows end-to-end

### 10. Document Service Map
Create documentation of all 28 services

## Expected Outcomes
- ✅ 28 patient services migrated
- ✅ All services authenticated
- ✅ Import paths updated
- ✅ Tests passing
- ✅ Documentation complete

## Validation Steps
1. Count services = 28
2. All authenticate successfully
3. Integration tests pass
4. No circular dependencies
5. Performance acceptable

## Rollback Plan
- Move services back
- Restore original imports
- Revert authentication
- Fix any issues

## Time Estimate
- Implementation: 4 hours
- Testing: 2 hours
- Documentation: 1 hour

## Dependencies
- Tasks 1-35 (infrastructure and extraction complete)

## Next Task
Task_37_MOVE_CLINICAL_SERVICES.md

## Notes for Agent
- Include ALL patient services
- Verify authentication
- Test thoroughly
- Update all imports
- Document everything