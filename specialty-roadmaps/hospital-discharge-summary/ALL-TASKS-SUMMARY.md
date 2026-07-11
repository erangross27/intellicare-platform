# Hospital Discharge Summary Tools - Complete Task List

**Last Updated**: October 19, 2025
**Total Tasks**: 6 critical tools
**Timeline**: 2-3 weeks
**Status**: Planning phase

## Quick Overview

This roadmap addresses the **6 missing tools** needed to capture complete structured data from hospital discharge summaries. Each tool enables automated extraction and storage of critical clinical data that is currently lost during document processing.

## Task List

### Tier 1: Critical Data Capture Tools (2-3 weeks)

| # | Task | Tool | Priority | Timeline | Complexity | Status |
|---|------|------|----------|----------|------------|--------|
| 01 | [Diagnosis Management](tier-1-critical/01-create-diagnosis.md) | `createDiagnosis()` | CRITICAL | 3-4 days | Medium | Not Started |
| 02 | [Vital Signs Recording](tier-1-critical/02-add-vital-signs.md) | `addVitalSigns()` | CRITICAL | 2-3 days | Low-Medium | Not Started |
| 03 | [Specialist Scheduling](tier-1-critical/03-schedule-specialist-followup.md) | `schedulePulmonologyFollowup()` | CRITICAL | 3-4 days | Medium | Not Started |
| 04 | [Diagnostic Test Ordering](tier-1-critical/04-order-diagnostic-test.md) | `orderPulmonaryFunctionTest()` | CRITICAL | 3-4 days | Medium | Not Started |
| 05 | [Vaccination Recording](tier-1-critical/05-add-vaccination.md) | `addVaccination()` | CRITICAL | 2-3 days | Low-Medium | Not Started |
| 06 | [Care Plan Creation](tier-1-critical/06-create-care-plan.md) | `createCarePlan()` | CRITICAL | 4-5 days | Medium-High | Not Started |

## Implementation Phases

### Phase 1: Data Storage (Week 1)
**Focus**: Core data capture tools

- Task 01: createDiagnosis() - ICD-10 diagnosis management
- Task 02: addVitalSigns() - Vital signs trending
- Task 05: addVaccination() - Immunization tracking

**Deliverables**:
- 3 new collection schemas (or updates to existing)
- 3 new service files
- Function registration in aiHelpers.js
- Agent system prompt updates

### Phase 2: Workflow Integration (Week 2)
**Focus**: Care coordination and follow-up

- Task 03: schedulePulmonologyFollowup() - Specialist scheduling
- Task 04: orderPulmonaryFunctionTest() - Test ordering
- Task 06: createCarePlan() - Patient engagement

**Deliverables**:
- test_orders collection creation
- Appointment workflow enhancement
- Care plan patient portal integration
- Staff task queue integration

### Phase 3: Testing & Validation (Week 3)
**Focus**: Integration testing and data quality

- Unit tests for all 6 tools
- Integration test with David Wilson discharge summary
- SecureDataAccess pattern verification
- Multi-tenant isolation testing
- Data completeness validation (target: 95%+ capture rate)

**Deliverables**:
- Complete test suite
- David Wilson discharge fully processed
- Data quality report
- Documentation updates

## Success Metrics

### Data Completeness
- **Current**: ~40% of discharge data captured (structured)
- **Target**: 95%+ of discharge data captured (structured)

### Collections Populated
- ✅ discharge_summaries (already working)
- ✅ consultation_notes (already working)
- ✅ imaging_reports (already working)
- ✅ lab_results (already working)
- ✅ medications (already working)
- ⬜ diagnoses (NEW - Task 01)
- ⬜ vital_signs (NEW - Task 02)
- ⬜ appointments (ENHANCED - Task 03)
- ⬜ test_orders (NEW - Task 04)
- ⬜ vaccinations (NEW - Task 05)
- ⬜ care_plans (NEW - Task 06)

### Workflow Automation
- ⬜ Auto-schedule specialist follow-ups (Task 03)
- ⬜ Auto-order diagnostic tests (Task 04)
- ⬜ Auto-create care plans (Task 06)
- ⬜ Auto-detect abnormal vital signs (Task 02)
- ⬜ Auto-prevent duplicate vaccinations (Task 05)

## Dependencies

### Existing Infrastructure (Already Available)
- ✅ SecureDataAccess framework
- ✅ Agent SDK with function calling
- ✅ Claude Batch API for document processing
- ✅ Medical collections service
- ✅ Multi-tenant database architecture

### New Infrastructure Needed
- ⬜ test_orders collection schema
- ⬜ care_plans collection schema (if doesn't exist)
- ⬜ Patient portal care plan viewer (optional but recommended)
- ⬜ Staff task queue enhancements

## Risk Assessment

### Low Risk
- Tasks 02, 05: Simple data storage, minimal dependencies
- Existing patterns can be followed

### Medium Risk
- Tasks 01, 03, 04: Workflow integration required
- Need coordination with existing appointment/provider systems

### Medium-High Risk
- Task 06: Complex data structure, patient engagement features
- May require frontend development

## Related Documentation

- **Source Document**: `2Hospital Discharge Summary.pdf` (David Wilson)
- **Critical Gaps**: [CRITICAL-GAPS.md](CRITICAL-GAPS.md)
- **Implementation Guide**: [README.md](README.md)
- **IntelliCare 6-Step Checklist**: `/home/erangross/Development/IntelliCare/CLAUDE.md` lines 21-69
- **Security Framework**: `/home/erangross/Development/IntelliCare/CLAUDE.md` lines 71-100

## Next Actions

1. **Review**: User reviews all 6 task files
2. **Prioritize**: Confirm implementation order (currently: 1,2,5 → 3,4,6)
3. **Start Implementation**: Begin with Task 01 (createDiagnosis)
4. **Iterate**: Complete one task, test, move to next
5. **Validate**: Process David Wilson discharge summary end-to-end

## Notes

- **Scope**: ONLY tool implementations, NOT medical actions for specific patients
- **Testing**: David Wilson discharge summary serves as reference test case
- **Pattern**: Follow IntelliCare 6-step checklist for each tool
- **Security**: All tools use SecureDataAccess with multi-tenant isolation
