# Task 05: Set Up Patient Management Context

## Objective
Create the Patient Management bounded context structure and prepare for service migration

## Prerequisites
- Task_04 completed (module boundaries configured)
- libs/patient-management/ directory exists

## Implementation Steps

### 1. Create Subdirectory Structure
```
libs/patient-management/
├── feature-records/      # Patient record management
├── feature-consent/      # Consent management
├── feature-portal/       # Patient portal features
├── data-access-api/      # API layer
├── domain-models/        # Patient domain entities
├── util-validators/      # Validation utilities
└── index.js             # Barrel export
```

### 2. Create Index.js Barrel Export
Main export file for the bounded context

### 3. List Services to Migrate
- patientDataEnrichmentService
- patientDeletionService
- patientPopulationAnalyticsService
- patientPortalMessagingService
- consentManagementService
- (16 total services)

### 4. Create Migration Map
Document which service goes to which subdirectory

### 5. Set Up Domain Models
Define Patient, Consent, Demographics entities

### 6. Configure Context Metadata
Add to nx.json and workspace.json

## Expected Outcomes
- ✅ Patient context structure created
- ✅ Subdirectories organized by type
- ✅ Index.js barrel export ready
- ✅ Migration map documented
- ✅ Domain models defined

## Validation Steps
1. Check directory structure
2. Verify index.js exists
3. Review migration map
4. Test barrel export

## Rollback Plan
1. Delete subdirectories
2. Remove index.js
3. Revert nx.json changes

## Time Estimate
- Implementation: 20 minutes
- Testing: 10 minutes
- Documentation: 10 minutes

## Dependencies
- Task_04 (module boundaries)

## Next Task
Task_06_CLINICAL_CONTEXT_SETUP.md

## Notes for Agent
- DO NOT move services yet
- Only create structure
- Document migration plan
- Prepare for service moves