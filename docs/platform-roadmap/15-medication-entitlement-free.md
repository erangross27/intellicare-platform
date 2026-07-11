# Task 15: Build Medication Entitlement Using Free APIs Only

## Priority: HIGH
## Category: Phase 3 - Enhance Existing Integrations
## Dependencies: Task 06 (RxNorm), Task 08 (ICD-10), Task 14 (Blue Button)
## Cost: FREE

## Background

The user asked: "Can we find out if patient X is entitled to medication Y?" Without paid insurance APIs, we can still build a useful medication entitlement system by combining multiple free data sources. It won't be real-time eligibility verification, but it can provide solid guidance.

## The Problem

Real-time medication entitlement checking requires:
1. ~~Real-time insurance eligibility API ($0.30+/check)~~ **NOT AVAILABLE (paid)**
2. ~~Clearinghouse connection (requires EIN)~~ **NOT AVAILABLE (no business ID)**
3. ~~PBM API (requires contract)~~ **NOT AVAILABLE (paid)**

## The Solution: Multi-Source Free Entitlement

Combine these FREE data sources to build an entitlement assessment:

### Source 1: Medicare Part D Formulary Data (CMS)
- Download Medicare Part D formulary files from CMS
- URL: https://data.cms.gov/provider-data/topics/prescription-drug-plan
- Contains: drug coverage, tier, prior auth, step therapy, quantity limits per plan
- Updated quarterly
- Import into MongoDB for local querying

### Source 2: RxNorm Drug Classification (Task 06)
- Identify drug class and generic alternatives
- Check if generics are available (usually covered at lower tiers)

### Source 3: Blue Button Claims History (Task 14)
- For Medicare patients: see what medications were previously approved/paid
- If a drug was covered before, it's likely still covered

### Source 4: Healthcare.gov Marketplace (Already Integrated)
- ACA plans must cover essential health benefits
- Certain drug categories are mandated to be covered

### Source 5: OpenFDA Drug Data (Already Integrated)
- Check if drug is FDA-approved (only approved drugs can be covered)
- Check for any recalls or safety alerts affecting coverage

### Source 6: Hardcoded Coverage Rules (Already Exists)
- `insuranceService.js` already has coverage rules per insurer
- Expand with more drugs and more plans

## Architecture

```
Patient asks: "Is Humira covered for my insurance?"
                    ↓
Step 1: Get patient's insurance info from database
Step 2: Identify drug via RxNorm (get RxCUI, class, generics)
Step 3: Check coverage by source:
   - Medicare patient? → Query Part D formulary data
   - Has Blue Button data? → Check claims history
   - ACA marketplace plan? → Check essential benefits mandate
   - Any plan? → Check hardcoded rules + generic availability
Step 4: Compile entitlement assessment:
   - Coverage likelihood (high/medium/low/unknown)
   - Tier if known
   - Prior auth likely needed?
   - Generic alternatives available?
   - Step therapy requirements?
   - Quantity limits?
Step 5: Return assessment to agent
```

## What Needs to Be Done

### Step 1: Download and Import Medicare Part D Data
- Download formulary files from CMS data portal
- Parse CSV/JSON files
- Import into MongoDB collection `medicare_formulary`
- Fields: planId, drugName, rxcui, tier, priorAuth, stepTherapy, quantityLimit
- Set up quarterly refresh script

### Step 2: Create medicationEntitlementService.js
Location: `apps/backend-api/services/medicationEntitlementService.js`

Main function: `checkMedicationEntitlement(patientId, drugName, options)`
Returns:
```json
{
  "drug": "Humira (adalimumab)",
  "rxcui": "352056",
  "drugClass": "TNF inhibitor",
  "insurancePlan": "Medicare Part D - SilverScript",
  "coverageLikelihood": "high",
  "tier": 5,
  "tierName": "Specialty",
  "estimatedCopay": "$100-500 (specialty tier)",
  "priorAuthRequired": true,
  "stepTherapyRequired": true,
  "stepTherapyDrugs": ["methotrexate", "leflunomide"],
  "quantityLimit": "2 pens per 28 days",
  "genericAvailable": false,
  "biosimilarsAvailable": ["Hadlima", "Hyrimoz", "Cyltezo"],
  "previouslyCovered": true,
  "lastApproved": "2025-08-15",
  "dataSources": ["Medicare Part D Formulary", "Blue Button Claims", "RxNorm"],
  "disclaimer": "This is an estimate based on available data. Contact insurance for definitive coverage."
}
```

### Step 3: Add Agent Tools
- `checkMedicationEntitlement` - "Check if a patient's insurance is likely to cover a specific medication. Combines Medicare formulary data, claims history, and drug classification to assess coverage likelihood"
- `findCoveredAlternatives` - "Find alternative medications that are more likely to be covered (generics, biosimilars, same-class drugs)"
- `getStepTherapyRequirements` - "What drugs must be tried first before this medication is approved?"
- `getMedicationTierLevel` - "What tier is this drug on for the patient's plan?"

### Step 4: Test via Chat
- "Is Humira covered for patient Russell Hall?"
- "What tier is Metformin on for Medicare Part D?"
- "What are cheaper alternatives to Lipitor that are covered?"
- "Does Eliquis require prior authorization under Medicare?"
- "What drugs does patient X need to try before getting Humira?"

## Files to Create
1. `apps/backend-api/services/medicationEntitlementService.js`
2. `scripts/import-medicare-formulary.js` - Data import script

## Files to Modify
1. `apps/backend-api/services/utils/aiHelpers.js` - Tool definitions
2. `apps/backend-api/services/agentServiceV4.js` - Case routes
3. `apps/backend-api/services/claudeMedicalFunctionGroups.js` - Keywords

## Notes
- This isn't real-time insurance verification, but it's the best we can do for FREE
- Medicare Part D formulary data is the most complete free source
- For non-Medicare patients, we fall back to drug class + generic analysis
- Always include a disclaimer that this is an estimate
- Accuracy improves with more data sources (Blue Button, expanded hardcoded rules)
