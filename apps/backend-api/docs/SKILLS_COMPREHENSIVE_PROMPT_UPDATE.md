# Skills Comprehensive Prompt Update
**Date**: October 24, 2025
**Issue**: Extraction producing only 3KB files with 9 properties instead of comprehensive 50-100KB files with 500+ properties

## Problem Analysis

### Symptoms
- Claude extracted only 9 basic properties instead of comprehensive medical data
- Output file size: 3.46 KB (should be 50-100 KB)
- Missing critical fields like `patientName` at root level
- Cost: $0.68 for incomplete extraction (too expensive)
- Missing all 11 AI-generated analysis fields

### Root Cause
The SKILL.md file was missing the comprehensive system prompt that exists in `claudeBatchProcessor.js`. The Skill had only basic instructions (370 lines) while the batch processor has the full extraction guide with:
- 10,000+ medical field properties
- Detailed extraction rules for each specialty
- Medication dose change rules
- Critical fields checklist
- Support & resources extraction guidelines

## Solution Implemented

### 1. Updated SKILL.md (370 → 434 lines)

Added comprehensive extraction instructions from `claudeBatchProcessor.js` system prompt (lines 253-369):

**New sections added:**
- **MEDICATION DOSE CHANGE RULES** - 6 detailed rules for handling dose modifications
- **CRITICAL FIELDS TO CAPTURE** - 7 must-extract fields with examples
- **ALWAYS EXTRACT THESE FIELDS WHEN PRESENT** - 9 commonly missed fields
- **NEW DIABETES MANAGEMENT FIELDS TO EXTRACT** - 10 diabetes-specific fields
- **SUPPORT & RESOURCES TO EXTRACT** - 8 resource/support fields
- **CRITICAL MEDICATIONS NOTE** - Instructions for vitamins, supplements, folic acid

### 2. Uploaded New Skill Version

**Previous Skill:**
- Skill ID: `skill_016mPJ1db9h244gc5cqPFaHt`
- Version: `1761280382528289`
- Updated: 2025-10-24T04:33:07Z

**New Skill:**
- Skill ID: `skill_01L8uDnTE7QN42AVZodhYaoZ`
- Version: `1761282752891544`
- Updated: 2025-10-24T05:12:37Z
- Size: 173.02 KB (2.11% of 8MB limit)

### 3. What Still Needs to Be Added

The `claudeBatchProcessor.js` contains even MORE comprehensive instructions that are NOT yet in SKILL.md:

**Missing from SKILL.md:**
1. **Field-by-field extraction checklist** with ☑ checkboxes (290 checkboxes total)
   - Located in `getDocumentAnalysisTools()` method (15,765 lines)
   - Includes ALL specialty-specific fields:
     - Cardiology fields (ecgFindings, echoFindings, cardiacRiskScores)
     - Surgical fields (operativeDetails, implants, specimens)
     - Pathology fields (specimenType, immunohistochemistry, staging)
     - Nephrology fields (ckdAssessment, dialysisPlanning, transplantEvaluation)
     - Endocrine fields (diabetesManagement, insulinPumpSettings, cgmData)
     - Emergency fields (triageData, edDisposition, proceduralSedation)
     - And 40+ more specialties...

2. **Detailed per-field instructions** like:
   ```
   ☑ vitalSignsTable: CRITICAL - Extract if multiple vital sign readings over time:
      - Extract as array of readings with timestamps
      - Include all measurements at each time point
      - Preserve the table structure if present in document
      - FOR ICU FLOW SHEETS: Extract COMPLETE 24-hour data (00:00-23:00)
      - Do NOT stop at 11:00 or 12:00 - continue extracting all hourly readings
   ```

3. **Complete tool schema** with all 10,000+ properties
   - Currently loaded from `complete_medical_extraction_schema.json` (34,180 lines)
   - Tool schema is 150KB tokens (mentioned in beta header comment)

## Architecture Understanding

### How Skills Work (Per Anthropic Docs)

**Progressive Disclosure (3 Levels):**
1. **Level 1 - Metadata** (Always loaded, ~100 tokens)
   - YAML frontmatter from SKILL.md
   - Claude sees this in system prompt at startup

2. **Level 2 - Instructions** (Loaded on demand)
   - Body of SKILL.md
   - Claude executes `bash: read skill/SKILL.md` when task matches description
   - We added comprehensive instructions HERE

3. **Level 3 - Resources** (As needed)
   - Additional files: schemas, scripts, docs
   - Loaded via filesystem access when explicitly referenced
   - Schema file (34K lines) is loaded via Python script

### Current Workflow

1. User uploads PDF document
2. `documentAnalysisWithSkills.js` creates Messages API request
3. Claude loads Skill instructions (SKILL.md - now 434 lines)
4. Claude executes: `python /skills/intellicare-medical-extractor/scripts/extract_medical_data.py`
5. Python script loads schema: `/skills/intellicare-medical-extractor/schemas/complete_medical_extraction_schema.json`
6. Script extracts basic fields (patientName, DOB, meds, vitals) → saves to `extracted_medical_data.json`
7. Claude reads `extracted_medical_data.json` and `_pdf_text` field
8. Claude enhances extraction with specialty fields + 11 AI analysis fields
9. Claude saves final `extracted_medical_data.json`

## Why Previous Extraction Failed

**Issue**: SKILL.md had ONLY these instructions:
- "Extract ALL medical data"
- "Generate 11 AI analysis fields"
- "Use the pre-written script"

**Missing**:
- Specific field names to extract (medications.quantity, providerLicense, etc.)
- Medication dose change rules
- Diabetes management fields
- Support & resources fields
- Critical fields checklist

**Result**: Claude didn't know WHAT to extract beyond the basic fields from the Python script.

## Expected Improvement

With the updated SKILL.md, Claude should now:
- ✅ Extract `patientName` at root level (explicitly listed in ALWAYS EXTRACT section)
- ✅ Extract medication quantities, provider credentials, diabetes fields
- ✅ Apply dose change rules correctly
- ✅ Include support resources (workplace letters, FMLA, insurance)
- ✅ Generate all 11 AI analysis fields
- ✅ Produce 50-100 KB files with 500+ properties

## Files Modified

1. `intellicare-medical-extractor/SKILL.md` - Added 64 lines of comprehensive extraction rules
2. `intellicare-medical-extractor/skill_info.json` - Updated with new skill ID and version
3. Created: `docs/SKILLS_COMPREHENSIVE_PROMPT_UPDATE.md` - This documentation

## Next Steps

If extraction STILL fails after this update, we need to:

1. **Copy the ENTIRE `getDocumentAnalysisTools()` method content** (15,765 lines with all ☑ checkboxes) into a separate markdown file in the Skill
2. **Update SKILL.md** to reference this comprehensive field guide
3. **Increase Skill size** from 173 KB to potentially 1-2 MB (still well under 8MB limit)

## Testing

To test the updated Skill:
1. Upload a medical PDF document
2. Check that `extracted_medical_data.json` is 50-100 KB (not 3 KB)
3. Verify `patientName` is at root level
4. Verify all 11 AI analysis fields are present
5. Verify specialty-specific fields are extracted
6. Check token cost is reasonable ($0.20-0.30, not $0.68)

## Key Insight

The user was correct: "We did already yesterday and it worked not sure why we need to do it again"

The comprehensive system prompt EXISTS in `claudeBatchProcessor.js` and was working for Batch API processing. We just needed to COPY that same comprehensive prompt into the Skill's SKILL.md file so Claude knows what to extract when using the Code Execution Tool instead of the Batch API.

**The fix**: Copy comprehensive instructions from `claudeBatchProcessor.js` (where they work) → `SKILL.md` (where they were missing).
