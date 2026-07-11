# Task 08: Integrate ICD-10-CM Diagnosis Code Lookup

## Priority: HIGH
## Category: Phase 2 - Free Government API Integration
## Dependencies: None
## Cost: FREE (No API key required)

## Background

ICD-10-CM codes are required for every medical claim, diagnosis, and encounter in the US healthcare system. Currently IntelliCare stores diagnoses as free text. Adding ICD-10 code lookup allows the agent to:
- Assign proper diagnosis codes when documenting encounters
- Validate diagnosis codes for billing
- Search codes by description or code
- Support proper clinical documentation

## API Details

### NLM Clinical Tables ICD-10-CM API
- **Base URL**: `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3`
- **Auth**: None
- **Rate Limit**: Not specified (reasonable use)
- **Documentation**: https://clinicaltables.nlm.nih.gov/apidoc/icd10cm/v3/doc.html

### Key Endpoints
| Endpoint | What It Does |
|----------|-------------|
| `/search?sf=code,name&terms=diabetes` | Search by description |
| `/search?sf=code,name&terms=E11` | Search by code |
| `/search?sf=code,name&terms=E11&maxList=25` | Limit results |

### Response Format
Returns array: `[totalCount, codes[], null, displayStrings[]]`
Example for "diabetes type 2":
```
[15, ["E11", "E11.0", "E11.00", ...], null, [["E11", "Type 2 diabetes mellitus"], ["E11.0", "Type 2 diabetes mellitus with hyperosmolarity"], ...]]
```

### WHO ICD API (Supplementary)
- **Base URL**: `https://id.who.int/icd`
- **Auth**: OAuth (free registration at https://icd.who.int/icdapi)
- **Rate Limit**: Not specified
- Provides ICD-10 and ICD-11 codes
- International version (not US-specific CM modifications)

## What Already Exists in IntelliCare

### Diagnosis Management
- `diagnosisService.js` - CRUD for diagnoses
- `addDiagnosis` / `getDiagnoses` / `updateDiagnosis` / `deleteDiagnosis` agent tools
- Diagnoses stored as free text in MongoDB
- No ICD-10 code field currently

### Billing Service
- `billingService.js` has `captureCharge()` which needs ICD-10 codes
- CPT codes are referenced but ICD-10 codes are not validated

## What Needs to Be Done

### Step 1: Create icdCodeService.js
Location: `apps/backend-api/services/icdCodeService.js`

Functions:
- `searchICD10(query, maxResults)` - Search by description or partial code
- `lookupICD10Code(code)` - Exact code lookup, return description
- `validateICD10Code(code)` - Check if code exists and is valid
- `getRelatedCodes(code)` - Get parent/child codes (e.g., E11 → E11.0, E11.1, etc.)
- `suggestICD10Codes(diagnosis)` - Take free-text diagnosis, suggest matching codes
- `getCommonCodes(specialty)` - Return frequently used codes by specialty

Cache the code lookups (codes change only with annual updates).

### Step 2: Add Agent Tools
- `searchDiagnosisCode` - "Search for ICD-10-CM diagnosis code by description or code. Example: 'diabetes type 2' returns E11"
- `validateDiagnosisCode` - "Validate an ICD-10-CM code is correct"
- `suggestDiagnosisCodes` - "Suggest ICD-10 codes based on a clinical description"
- `getRelatedDiagnosisCodes` - "Get more specific codes under a general code (e.g., E11 → E11.65)"

### Step 3: Enhance Diagnosis Functions
- When `addDiagnosis` is called, automatically suggest ICD-10 codes
- Add optional `icdCode` field to diagnosis records
- When capturing charges (billing), validate ICD-10 codes are present

### Step 4: Test via Chat
- "What's the ICD-10 code for type 2 diabetes?"
- "Search diagnosis codes for hypertension"
- "Is E11.65 a valid ICD-10 code?" → "Yes - Type 2 diabetes mellitus with hyperglycemia"
- "Add diagnosis for patient X: Type 2 diabetes mellitus, code E11"
- "What are the specific codes under E11?"

## Files to Create
1. `apps/backend-api/services/icdCodeService.js`

## Files to Modify
1. `apps/backend-api/services/utils/aiHelpers.js` - Tool definitions
2. `apps/backend-api/services/agentServiceV4.js` - Case routes
3. `apps/backend-api/services/claudeMedicalFunctionGroups.js` - Keywords
4. `apps/backend-api/services/masterServiceLoader.js` - Load service
5. `apps/backend-api/services/diagnosisService.js` - Add icdCode field support

## Notes
- ICD-10-CM is the US-specific clinical modification
- Codes are updated annually (October 1st) - cache should be refreshed
- This is essential for proper billing and clinical documentation
- The NLM API is simpler and more reliable than the WHO API for US use
