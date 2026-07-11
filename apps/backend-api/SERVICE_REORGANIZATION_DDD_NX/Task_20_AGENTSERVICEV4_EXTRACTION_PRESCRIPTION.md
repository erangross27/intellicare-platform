# Task 20: Extract AgentServiceV4 Prescription Modules

## Objective
Extract 20 prescription-related modules from AgentServiceV4.js

## Prerequisites
- Task_19 completed (clinical modules extracted)
- Prescription module directories created
- Medical standards understood

## Implementation Steps

### 1. Extract Medication Modules (5 files)
```
Target: libs/clinical-care/feature-agent-prescription/medications/
- medication-search.js (~140 lines)
- medication-database.js (~140 lines)
- medication-alternatives.js (~140 lines)
- medication-information.js (~140 lines)
- medication-formulary.js (~140 lines)
```

### 2. Extract Dosage Modules (4 files)
```
Target: libs/clinical-care/feature-agent-prescription/dosage/
- dosage-calculation.js (~140 lines)
- dosage-adjustment.js (~140 lines)
- dosage-pediatric.js (~140 lines)
- dosage-geriatric.js (~140 lines)
```

### 3. Extract Interaction Modules (4 files)
```
Target: libs/clinical-care/feature-agent-prescription/interactions/
- drug-drug-interactions.js (~140 lines)
- drug-food-interactions.js (~140 lines)
- drug-condition-interactions.js (~140 lines)
- interaction-severity.js (~140 lines)
```

### 4. Extract Allergy Modules (4 files)
```
Target: libs/clinical-care/feature-agent-prescription/allergies/
- allergy-checking.js (~140 lines)
- allergy-documentation.js (~140 lines)
- allergy-alerts.js (~140 lines)
- cross-sensitivity.js (~140 lines)
```

### 5. Extract Refill Modules (3 files)
```
Target: libs/clinical-care/feature-agent-prescription/refills/
- refill-management.js (~140 lines)
- refill-authorization.js (~140 lines)
- refill-tracking.js (~140 lines)
```

### 6. Add Prescription Safety
Each module needs:
- DEA compliance
- Controlled substance checks
- Prior authorization
- Insurance verification

### 7. Implement Drug Databases
- FDA drug database
- NDC codes
- RxNorm
- Drug classifications

### 8. Create Safety Tests
Drug safety validation tests

### 9. Validate Prescription Logic
Ensure safety checks preserved

### 10. Update Prescription Index
Export all prescription modules

## Expected Outcomes
- ✅ 20 prescription modules extracted
- ✅ Drug safety preserved
- ✅ Interaction checks working
- ✅ DEA compliance
- ✅ Tests comprehensive

## Validation Steps
1. All drug checks working
2. Interaction detection accurate
3. Dosage calculations correct
4. Allergy checks functional
5. Compliance verified

## Rollback Plan
- Critical safety system
- Extensive testing required
- Immediate rollback if issues

## Time Estimate
- Implementation: 6 hours
- Testing: 3 hours
- Documentation: 1 hour

## Dependencies
- Task_19 (clinical modules done)

## Next Task
Task_21_AGENTSERVICEV4_EXTRACTION_BILLING.md

## Notes for Agent
- PATIENT SAFETY CRITICAL
- Drug interactions must work
- Allergy checks mandatory
- DEA compliance required
- Test extensively