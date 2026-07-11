# Tier 1: Critical Data Capture Tools

**Priority**: IMMEDIATE
**Timeline**: 2-3 weeks
**Impact**: Enables complete discharge summary data extraction

## Overview

These 6 tools are essential for capturing structured medical data from hospital discharge summaries. Without them, approximately 40% of critical clinical data is lost during document processing.

## Tools in This Tier

1. **01-create-diagnosis.md** - `createDiagnosis()` - ICD-10 diagnosis management
2. **02-add-vital-signs.md** - `addVitalSigns()` - Vital signs recording
3. **03-schedule-specialist-followup.md** - `schedulePulmonologyFollowup()` - Specialist scheduling
4. **04-order-diagnostic-test.md** - `orderPulmonaryFunctionTest()` - Test ordering
5. **05-add-vaccination.md** - `addVaccination()` - Immunization tracking
6. **06-create-care-plan.md** - `createCarePlan()` - Care plan documentation

## Implementation Order

### Phase 1: Data Storage (Week 1)
1. createDiagnosis() - Foundation for clinical coding
2. addVitalSigns() - Foundation for trending
3. addVaccination() - Foundation for immunization tracking

### Phase 2: Workflow Integration (Week 2)
4. schedulePulmonologyFollowup() - Care coordination
5. orderPulmonaryFunctionTest() - Diagnostic follow-through
6. createCarePlan() - Patient engagement

### Phase 3: Testing (Week 3)
- Integration testing with David Wilson discharge summary
- Verify complete data capture
- Test SecureDataAccess patterns
- Validate multi-tenant isolation

## Success Criteria

- ✅ All 6 tools implemented following IntelliCare security patterns
- ✅ Complete data extraction from discharge summary (95%+ capture rate)
- ✅ SecureDataAccess integration verified
- ✅ Multi-tenant isolation maintained
- ✅ Function registry updated (aiHelpers.js)
- ✅ Agent system prompt updated
- ✅ Frontend endpoints created (if needed)

## Dependencies

**Existing Infrastructure**:
- SecureDataAccess framework ✅
- Medical collections (diagnoses, vital_signs, etc.) ✅
- Agent SDK with function calling ✅
- Claude Batch API for document processing ✅

**New Collections Needed**:
- diagnoses (may already exist, verify schema)
- vital_signs (may already exist, verify schema)
- vaccinations (may already exist, verify schema)
- care_plans (may already exist, verify schema)
- test_orders (may need creation)

## Testing Strategy

1. **Unit Testing**: Each tool tested independently
2. **Integration Testing**: Full discharge summary processing
3. **Security Testing**: Multi-tenant isolation verification
4. **Data Quality Testing**: Verify 95%+ capture rate

## References

- **IntelliCare 6-Step Checklist**: CLAUDE.md lines 21-69
- **Security Doctrine**: CLAUDE.md lines 71-100
- **Function Registry**: aiHelpers.js getAllPlatformFunctions()
- **Agent System Prompt**: agentSystemPrompt.js
