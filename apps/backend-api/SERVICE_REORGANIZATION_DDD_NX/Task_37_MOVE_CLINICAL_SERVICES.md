# Task 37: Move Clinical Care Services

## Objective
Move 43 clinical-related services to clinical-care context (includes AgentServiceV4 modules)

## Prerequisites
- Task_36 completed (patient services moved)
- Clinical context structure ready
- AgentServiceV4 clinical modules extracted

## Implementation Steps

### 1. Original Clinical Services to Move (18)
```
FROM: backend/services/
TO: libs/clinical-care/

- clinicalAnalyticsService.js → feature-analytics/
- clinicalDecisionSupport.js → feature-diagnosis/
- clinicalNotesService.js → feature-notes/
- clinicalResearchService.js → feature-research/
- diagnosisSupportService.js → feature-diagnosis/
- treatmentPlanningService.js → feature-treatment/
- treatmentRecommender.js → feature-treatment/
- prescriptionGenerator.js → feature-prescription/
- allergyChecker.js → util-medical/
- drugInteractionService.js → feature-prescription/
- drugInformationService.js → feature-prescription/
- medicalModelService.js → domain-clinical/
- medicalParsingService.js → util-medical/
- symptomAnalyzer.js → feature-diagnosis/
- labOrderService.js → feature-diagnosis/
- referralManagementService.js → feature-treatment/
- careCoordinationService.js → feature-treatment/
- clinicalPathwayService.js → feature-treatment/
```

### 2. AgentServiceV4 Clinical Modules (30)
From Task_19, integrate:
```
TO: libs/clinical-care/feature-agent-clinical/
- All 30 clinical modules from AgentServiceV4
```

### 3. AgentServiceV4 Prescription Modules (20)
From Task_20, integrate:
```
TO: libs/clinical-care/feature-agent-prescription/
- All 20 prescription modules from AgentServiceV4
```

### 4. Create Missing Services
If not existing:
- clinicalProtocolService.js
- clinicalGuidelinesService.js
- clinicalQualityService.js

### 5. Medical Standards Integration
Ensure all services support:
- ICD-10 coding
- CPT codes
- SNOMED CT
- LOINC codes

### 6. HIPAA Compliance
Every service must have:
- PHI encryption
- Audit logging
- Access controls
- Consent checking

### 7. Clinical Workflow Testing
Test complete workflows:
- Diagnosis flow
- Treatment planning
- Prescription generation
- Lab ordering

### 8. Medical Validation
Verify medical accuracy:
- Drug interactions work
- Allergy checking functional
- Clinical decisions appropriate
- Guidelines followed

### 9. Performance Testing
Ensure acceptable performance:
- Response times
- Concurrent users
- Data processing
- Report generation

### 10. Clinical Documentation
Document all 43 services:
- Purpose
- Medical standards
- Workflows
- Integration points

## Expected Outcomes
- ✅ 43 clinical services migrated
- ✅ Medical logic preserved
- ✅ HIPAA compliant
- ✅ Standards integrated
- ✅ Workflows functional

## Validation Steps
1. Count services = 43
2. Medical workflows test
3. Standards compliance check
4. Performance acceptable
5. Documentation complete

## Rollback Plan
- CRITICAL medical functions
- Extensive testing required
- Rollback if any issues
- Clinical review needed

## Time Estimate
- Implementation: 6 hours
- Testing: 4 hours
- Documentation: 2 hours

## Dependencies
- Task_36 (patient services moved)

## Next Task
Task_38_MOVE_SECURITY_SERVICES.md

## Notes for Agent
- PATIENT SAFETY CRITICAL
- Preserve ALL medical logic
- Test drug interactions
- Verify clinical decisions
- Document thoroughly