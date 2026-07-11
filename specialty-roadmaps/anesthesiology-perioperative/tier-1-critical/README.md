# Tier 1: Critical Safety Tools

**Priority**: IMMEDIATE
**Timeline**: 2-3 weeks
**Impact**: Patient safety, surgical clearance, controlled substance compliance

---

## Overview

These 5 tools are **critical blockers** for safe perioperative care. Without them, Richard Phillips' surgery cannot proceed safely.

---

## Tool Priority Order

### 🔴 CRITICAL (Week 1)
**Tool #5**: Prescription Auto-Generator
- **Why First**: ZERO prescriptions for 8 active meds - legal/compliance requirement
- **Blocks**: Controlled substance verification, refill tracking, postop planning
- **Timeline**: 3-4 days

**Tool #2**: Opioid MME Dashboard
- **Why Second**: 140mg/day = high-dose, needs risk assessment + weaning plan
- **Blocks**: Safe perioperative opioid management
- **Timeline**: 4-5 days

**Tool #4**: Sleep Apnea Assessment
- **Why Third**: CPAP user needs postop respiratory monitoring protocol
- **Blocks**: Anesthesia plan, PACU protocols
- **Timeline**: 3-4 days

### ⚠️ HIGH PRIORITY (Week 2)
**Tool #1**: Anesthesia Risk Calculator
- **Why Fourth**: ASA/Mallampati needed for anesthesia planning
- **Blocks**: Informed consent, airway management plan
- **Timeline**: 4-5 days

**Tool #3**: Perioperative Optimization Tracker
- **Why Fifth**: Surgical clearance + HbA1c trends + BMI tracking
- **Blocks**: Surgical scheduling, optimization protocols
- **Timeline**: 5-6 days

---

## Task Files

- `01-anesthesia-risk-calculator.md` - ASA, Mallampati, airway assessment
- `02-opioid-mme-dashboard.md` - MME calculation, risk scoring, weaning protocols
- `03-perioperative-optimization.md` - Surgical clearance, lab trends, BMI tracking
- `04-sleep-apnea-management.md` - STOP-Bang, CPAP compliance, postop monitoring
- `05-prescription-generator.md` - **START HERE** - Auto-create prescriptions from med list

---

## Dependencies

### Existing Infrastructure
- ✅ SecureDataAccess framework
- ✅ Medication collection
- ✅ Lab results collection
- ✅ Vital signs collection
- ✅ Multi-tenant architecture

### New Collections Needed
- `prescriptions` (if not exists)
- `risk_assessments`
- `perioperative_checklists`
- `opioid_risk_scores`

### External APIs/Data
- ICD-10 code validation
- Drug formulary database
- Clinical calculator libraries (ASA, RCRI, STOP-Bang)

---

## Success Criteria

### Week 1 Complete
- ✅ All medications have prescriptions
- ✅ Opioid MME calculated and tracked
- ✅ Sleep apnea risk quantified

### Week 2 Complete
- ✅ ASA score documented
- ✅ Perioperative optimization checklist started
- ✅ Richard Phillips cleared for surgery (pending optimization)

### Week 3 Complete
- ✅ All 5 tools deployed to production
- ✅ Full preoperative assessment complete
- ✅ Safety protocols in place

---

## Testing Strategy

**Use Richard Phillips Case:**
- 8 medications → Should generate 8 prescriptions
- Opioid list → Should calculate 140mg MME
- CPAP history → Should calculate STOP-Bang score
- Diabetes + HTN + obesity → Should calculate ASA 3
- Labs + vitals → Should populate optimization tracker

---

## Implementation Notes

### Security Requirements
- All tools use SecureDataAccess
- Practice-level isolation
- Audit trail for controlled substances
- Encrypted prescription data

### Integration Points
- agentServiceV4.js - Function execution
- aiHelpers.js - Function registration
- agentSystemPrompt.js - Claude awareness
- generatedMedicalFunctions.js - Auto-generated CRUD

### Quality Assurance
- Multi-tenant testing
- Duplicate prevention
- Data validation
- Error handling
- Audit logging

---

**START WITH**: Tool #5 (Prescription Generator)
**REASON**: Blocks all other workflows until prescriptions exist
