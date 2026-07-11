# Task 04: Wire Formulary Drug Lookup to Agent

## Priority: MEDIUM
## Category: Phase 1 - Wire Existing Services
## Dependencies: None (enhanced by Task 06 - RxNorm)

## Background

The `formularyService.js` is fully implemented with CMS QHP Formulary API support, but its lookup functions aren't fully exposed via the chat agent. The service can look up drugs by RxCUI or name, get tier/copay info, and check plan cost sharing. Currently the agent has `checkFormularyCoverage` and `checkMedicationCoverageAPI` but they go through `insuranceService.js` which falls back to hardcoded rules.

## What Already Exists

### formularyService.js
Location: `apps/backend-api/services/formularyService.js` (347 lines)
- `lookupMedicationCoverageByRxCUI(rxcui, insurer, planId)` - Exact drug lookup by RxCUI code
- `lookupMedicationCoverageByName(drugName, insurer, planId)` - Fuzzy name matching
- `getPlanCostSharing(insurer, planId, tier)` - Get copay/coinsurance for a tier
- `getDrugsFormulary(insuranceCompany)` - Fetch full drug list (24hr cache)
- `getPlansFormulary(insuranceCompany)` - Fetch plan list (24hr cache)
- `setFormularyUrls(insurer, urls)` - Configure insurer formulary endpoint URLs

### insuranceService.js
Location: `apps/backend-api/services/insuranceService.js`
- `checkMedicationCoverageAPI()` - Calls formularyService with fallback to hardcoded rules
- Hardcoded coverage for Israeli health funds (Clalit, Maccabi, Meuhedet, Leumit)
- Hardcoded US insurance tiers (generic, preferred brand, non-preferred, specialty)

### Agent Tools Already Defined
- `checkMedicationCoverageAPI` - Goes through insuranceService
- `checkFormularyCoverage` - In agentServiceV4

## What Needs to Be Done

### Step 1: Expose Formulary Functions Directly to Agent
Add new tool definitions that bypass insuranceService and go directly to formularyService:
- `lookupDrugFormulary` - Search by drug name, get tier/copay/prior auth status
- `lookupDrugByRxCUI` - Search by RxCUI code (more precise)
- `getDrugTierInfo` - Get tier classification for a specific drug on a plan
- `getPlanCostSharing` - Get copay/coinsurance amounts by tier
- `configureFormularySource` - Admin tool to set insurer formulary URLs

### Step 2: Enhance insuranceService Hardcoded Data
Since real formulary URLs aren't available yet (2027 mandate), improve the hardcoded fallback:
- Expand the medication list beyond the current small set
- Add more drug categories (cardiovascular, oncology, immunology, etc.)
- Include generic vs brand name pricing differences
- Add step therapy requirements for common drugs
- Add quantity limit information

### Step 3: Add Tool Definitions to aiHelpers.js
With clear descriptions:
- `lookupDrugFormulary` - "Look up if a medication is covered by a patient's insurance plan. Returns tier, copay, prior auth requirements. Example: lookupDrugFormulary('Lisinopril', 'Aetna')"
- `getDrugTierInfo` - "Check what tier a drug is on (generic, preferred brand, non-preferred, specialty)"

### Step 4: Test via Chat
- "Is Lisinopril covered by patient X's insurance?"
- "What tier is Humira on for Aetna plans?"
- "How much is the copay for generic drugs on Medicare Part D?"
- "Does Metformin require prior authorization?"

## Files to Modify
1. `apps/backend-api/services/utils/aiHelpers.js` - Tool definitions
2. `apps/backend-api/services/agentServiceV4.js` - Case routes
3. `apps/backend-api/services/insuranceService.js` - Expand hardcoded drug data
4. `apps/backend-api/services/claudeMedicalFunctionGroups.js` - Keywords

## Notes
- When Task 06 (RxNorm) is completed, drug lookups can be enhanced with standardized RxCUI codes
- The CMS Formulary API will become live January 2027 - the architecture is ready for it
- For now, hardcoded data serves as a demonstration and training tool
