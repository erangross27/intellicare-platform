# Task 18: Extract AgentServiceV4 Patient Modules

## Objective
Extract 25 patient-related modules from AgentServiceV4.js

## Prerequisites
- Task_17 completed (directory structure ready)
- Patient module directories created
- Analysis document available

## Implementation Steps

### 1. Extract Registration Modules (5 files)
```
Target: libs/patient-management/feature-agent-patient/registration/
- patient-registration-init.js (~140 lines)
- patient-registration-validation.js (~140 lines)
- patient-registration-processing.js (~140 lines)
- patient-registration-confirmation.js (~140 lines)
- patient-registration-utilities.js (~140 lines)
```

### 2. Extract Demographics Modules (5 files)
```
Target: libs/patient-management/feature-agent-patient/demographics/
- patient-demographics-crud.js (~140 lines)
- patient-demographics-validation.js (~140 lines)
- patient-demographics-search.js (~140 lines)
- patient-demographics-update.js (~140 lines)
- patient-demographics-export.js (~140 lines)
```

### 3. Extract History Modules (5 files)
```
Target: libs/patient-management/feature-agent-patient/history/
- patient-medical-history.js (~140 lines)
- patient-family-history.js (~140 lines)
- patient-surgical-history.js (~140 lines)
- patient-medication-history.js (~140 lines)
- patient-allergy-history.js (~140 lines)
```

### 4. Extract Document Modules (5 files)
```
Target: libs/patient-management/feature-agent-patient/documents/
- patient-document-upload.js (~140 lines)
- patient-document-retrieval.js (~140 lines)
- patient-document-processing.js (~140 lines)
- patient-document-categorization.js (~140 lines)
- patient-document-sharing.js (~140 lines)
```

### 5. Extract Communication Modules (5 files)
```
Target: libs/patient-management/feature-agent-patient/communication/
- patient-messaging.js (~140 lines)
- patient-notifications.js (~140 lines)
- patient-reminders.js (~140 lines)
- patient-portal-access.js (~140 lines)
- patient-communication-preferences.js (~140 lines)
```

### 6. Add Authentication to Each Module
Each module needs:
- Service registration
- API key handling
- Context creation
- Secure data access

### 7. Update Imports
Change internal function calls to module imports

### 8. Create Module Tests
Basic test for each extracted module

### 9. Validate Extraction
Ensure no functionality lost

### 10. Update Main Index
Export all patient modules

## Expected Outcomes
- ✅ 25 patient modules extracted
- ✅ Each ~140 lines
- ✅ Authentication added
- ✅ Tests created
- ✅ No functionality lost

## Validation Steps
1. Line count per module <200
2. All functions accounted for
3. Tests pass
4. No circular dependencies
5. Authentication working

## Rollback Plan
- Keep original file intact
- Can revert extractions
- Tests verify functionality

## Time Estimate
- Implementation: 6 hours
- Testing: 2 hours
- Documentation: 1 hour

## Dependencies
- Task_17 (structure created)

## Next Task
Task_19_AGENTSERVICEV4_EXTRACTION_CLINICAL.md

## Notes for Agent
- Preserve ALL functionality
- Add proper authentication
- Test each module
- Update documentation
- Keep line count reasonable