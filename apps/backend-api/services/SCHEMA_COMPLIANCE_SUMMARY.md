# Schema Compliance Analysis - Final Report
**Date:** November 4, 2025
**Patient Sample:** Tyrone Washington
**Batch File:** msgbatch_0138v7ucEP4SwXtv3pUwAg9u_results.jsonl

---

## Executive Summary

**✅ GOOD NEWS:** Claude is **NOT creating random/extra fields**. Claude is following the tool schemas correctly.

**⚠️ THE ISSUE:** The **unified-medical-schemas.json file has GAPS**. It's missing legitimate medical field definitions for complex nested objects.

---

## Analysis Results

### Tool Use Analysis (from JSONL Batch Results)
- **Total Tool Uses:** 37 calls across 1 document
- **Unique Collections:** 27 collections
- **Fields Extracted:** Claude extracted structured medical data using defined tools

### Schema Compliance
- **✅ 100% Compliant:** 11 collections (41%)
- **⚠️  Has Schema Gaps:** 16 collections (59%)
- **❌ No Schema Definition:** 0 collections (0%)

---

## The Answer to Your Question

> **"Do database records contain ONLY the fields we defined in unified-medical-schemas.json, or did Claude create extra fields?"**

**Answer:** Claude is using EXACTLY the fields defined in the **TOOL SCHEMAS** that were sent to it. However, the **unified-medical-schemas.json** file is **INCOMPLETE** - it's missing nested object field definitions.

### What This Means:

1. **buildExtractionTool()** (in claudeBatchProcessorToolUse.js) is building tool schemas
2. **Tool schemas** include nested object structures (e.g., `housingStatus.status`, `phq9.score`)
3. **unified-medical-schemas.json** only defines TOP-LEVEL fields, not nested fields
4. **Claude follows the tool schema** - uses nested fields as instructed
5. **Our validation** flags them as "extra" because unified schema doesn't list them

---

## Collections - Detailed Breakdown

### ✅ 100% COMPLIANT (11 collections)

These collections work perfectly - all fields Claude used are in the schema:

1. **administrative_data** - 3 fields used, 39 in schema ✅
2. **contact_information** - 2 fields used, 22 in schema ✅
3. **diagnoses** - 3 fields used, 16 in schema ✅
4. **vital_signs** - 1 field used, 15 in schema ✅
5. **lab_results** - 5 fields used, 24 in schema ✅
6. **referrals** - 6 fields used, 8 in schema ✅
7. **follow_up_appointments** - 8 fields used, 18 in schema ✅
8. **case_management** - 4 fields used, 16 in schema ✅
9. **care_team** - 3 fields used, 16 in schema ✅
10. **prognosis** - 4 fields used, 21 in schema ✅
11. **additional_notes** - 1 field used, 13 in schema ✅

### ⚠️  HAS SCHEMA GAPS (16 collections)

These collections need schema updates to include nested field definitions:

#### **Critical Schema Gaps (Medical Data):**

1. **social_history** - Missing: `occupation`, `livingSituation`, `financialConcerns`, `transportation`, `insurance`
   - **Reason:** These are VALID fields, but schema doesn't list them

2. **social_determinants_of_health** - Missing 32 nested fields
   - Schema has: `housingStatus`, `financialBarriers`, `foodSecurity`
   - Missing nested: `housingStatus.status`, `housingStatus.barriers`, `financialBarriers.income`, etc.

3. **psychiatric_assessment_scales** - Missing: `phq9.score`, `phq9.severity`
   - Schema has: `phq9` object
   - Missing: Properties inside the object

#### **Complex Schema Gaps (Intelligence Collections):**

4. **clinical_decision_support** - Missing 7 nested fields
5. **intelligent_recommendations** - Missing 23 nested fields
6. **trending_analysis** - Missing 26 nested fields
7. **patient_specific_care_plan** - Missing 16 nested fields
8. **patient_education_context** - Missing 24 nested fields
9. **follow_up_intelligence** - Missing 27 nested fields
10. **guideline_compliance** - Missing 18 nested fields
11. **care_gaps** - Missing 6 nested fields
12. **outcomes_prediction** - Missing 3 nested fields

#### **Other Gaps:**

13. **medication_access_programs** - Missing 7 nested fields
14. **treatment_plan** - Missing 15 nested fields
15. **monitoring_plan** - Missing 5 nested fields
16. **social_work** - Missing 3 nested fields

---

## Root Cause Analysis

### The Problem

The **unified-medical-schemas.json** was created by merging:
1. **claudeBatchProcessor.js** extraction schemas (OLD single-tool format)
2. **collectionSchemas.js** storage schemas

**BUT:** The NEW **Tool Use pattern** (November 2025) creates **richer, nested schemas** for better extraction quality. These nested structures were NOT in the original extraction schemas.

### Example: social_history

**Current Schema (unified-medical-schemas.json):**
```json
{
  "social_history": {
    "smokingStatus": { "type": "string" },
    "alcoholUse": { "type": "string" },
    "drugUse": { "type": "string" },
    ...
  }
}
```

**Tool Schema Sent to Claude:**
```json
{
  "name": "extract_social_history",
  "input_schema": {
    "properties": {
      "occupation": { "type": "string" },           // ← Missing in unified schema!
      "livingSituation": { "type": "string" },      // ← Missing in unified schema!
      "financialConcerns": { "type": "string" },    // ← Missing in unified schema!
      "transportation": { "type": "string" },       // ← Missing in unified schema!
      "insurance": { "type": "string" },            // ← Missing in unified schema!
      ...
    }
  }
}
```

**Claude's Output:**
```json
{
  "occupation": "Previously worked as warehouse worker...",
  "livingSituation": "Housing insecure - Lives in motel...",
  "financialConcerns": "Monthly deficit -$1,470...",
  "transportation": "No car, relies on bus...",
  "insurance": "Medicaid (approved 3 months ago)"
}
```

---

## Database "Violations" Explained

### From Earlier Database Validation:

We found "extra fields" in the database:
- `_securityMetadata` → Backend-added (SecureDataAccess service)
- `createdAtUTC`, `createdAtTimezone`, etc. → Backend-added (CRUD timestamp handling)
- `occupation`, `livingSituation`, etc. → **Claude-extracted, but MISSING from unified schema**
- `"0"` field → **Bug in backend processing** (array item became field)

### Conclusion:
- **Backend fields:** Not a schema issue, these are infrastructure fields
- **Medical fields:** Legitimate data that should BE in the schema
- **"0" field:** Processing bug (separate issue)

---

## Recommendations

### 1. Update Unified Schema (HIGH PRIORITY)

**Add missing fields to 16 collections:**

```bash
# Collections needing updates:
social_history
social_determinants_of_health
psychiatric_assessment_scales
medication_access_programs
treatment_plan
monitoring_plan
social_work
clinical_decision_support
intelligent_recommendations
trending_analysis
patient_specific_care_plan
patient_education_context
follow_up_intelligence
guideline_compliance
care_gaps
outcomes_prediction
```

**Two options:**

**Option A: Extract from Tool Schemas (RECOMMENDED)**
- Read `claudeBatchProcessorToolUse.js` → `buildExtractionTool()` method
- Extract the ACTUAL tool schemas being sent to Claude
- Copy those field definitions into unified-medical-schemas.json
- **Benefit:** Guaranteed match with what Claude receives

**Option B: Manual Field Addition**
- Review the "extra fields" list in tool-use-schema-compliance-report.json
- Add each field with proper type/description to unified-medical-schemas.json
- **Downside:** Tedious, error-prone

### 2. Fix "0" Field Bug (MEDIUM PRIORITY)

**Issue:** 9 collections have a field named `"0"` in database
- **Root cause:** Array processing bug in `extractAnalysisFromToolUse()` or storage layer
- **Location:** claudeBatchProcessor.js line 18640 or medicalFieldMappingService.js
- **Fix:** When processing arrays, ensure items don't become object keys

### 3. Backend Infrastructure Fields (LOW PRIORITY)

**Not a bug, but for clarity:**
- Add `_securityMetadata`, `createdAtUTC`, etc. to unified schema with `extractable: false, storable: true, source: 'backend'`
- **Benefit:** Schema becomes complete documentation of ALL database fields

---

## Final Answer

### Your Original Question:
> "Do database records contain ONLY the fields we defined in unified-medical-schemas.json?"

**Answer:** **NO** - but for a good reason!

The database records contain:
1. **✅ Fields defined in unified schema** (base fields)
2. **✅ Fields defined in TOOL schemas but missing from unified schema** (nested medical data)
3. **✅ Backend infrastructure fields** (_securityMetadata, timestamps)
4. **❌ One bug:** field named "0" (array processing issue)

### The Core Issue:

**The unified-medical-schemas.json file is OUT OF SYNC with the tool schemas.**

- **Tool schemas** (what Claude receives) are RICHER and have nested structures
- **Unified schema** (the JSON file) only has TOP-LEVEL fields
- **Claude is doing the RIGHT thing** - following the tool schemas correctly
- **The unified schema needs updating** to match the tool schemas

---

## Action Items

**Priority 1 (CRITICAL):**
- [ ] Update unified-medical-schemas.json with missing nested fields for 16 collections
- [ ] Re-run validation to verify 100% compliance

**Priority 2 (HIGH):**
- [ ] Fix "0" field bug in array processing
- [ ] Test with new batch to verify fix

**Priority 3 (MEDIUM):**
- [ ] Add backend infrastructure fields to schema for documentation
- [ ] Create schema sync validation as part of CI/CD

**Priority 4 (LOW):**
- [ ] Document schema update process
- [ ] Create tool to auto-sync unified schema with tool schemas

---

## Files Generated

1. **validate-schema-compliance.js** - Database validation script
2. **compare-tool-use-vs-schema.js** - JSONL analysis script
3. **schema-compliance-report.json** - Database validation results (31 collections)
4. **tool-use-schema-compliance-report.json** - Tool use validation results (27 collections)
5. **SCHEMA_COMPLIANCE_SUMMARY.md** - This report

---

**Conclusion:** The system is working correctly. Claude follows instructions. The unified schema just needs updating to reflect the richer tool schemas being used in production.
