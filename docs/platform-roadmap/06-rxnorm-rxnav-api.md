# Task 06: Integrate RxNorm/RxNav Drug Nomenclature API

## Priority: HIGH
## Category: Phase 2 - Free Government API Integration
## Dependencies: None
## Cost: FREE (No API key required)

## Background

RxNorm is the US standard for drug nomenclature, maintained by the National Library of Medicine (NLM). It provides normalized drug names, RxCUI codes (universal drug identifiers), ingredient relationships, brand-to-generic mappings, and drug class information. This is the missing link between our drug safety tools (OpenFDA) and our formulary/insurance tools.

Currently, IntelliCare uses drug names as free text (e.g., "Lisinopril 10mg tablet"). With RxNorm, every drug gets a standardized code (RxCUI) that can be used across all systems - OpenFDA, formulary lookups, drug interactions, etc.

## API Details

### RxNorm API
- **Base URL**: `https://rxnav.nlm.nih.gov/REST`
- **Auth**: None required
- **Rate Limit**: 20 requests/second/IP
- **Documentation**: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html

### Key Endpoints
| Endpoint | What It Does |
|----------|-------------|
| `/rxcui.json?name=aspirin` | Get RxCUI by drug name |
| `/rxcui/{rxcui}/allrelated.json` | Get all related concepts (ingredients, brands, generics) |
| `/rxcui/{rxcui}/related.json?tty=BN` | Get brand names for a generic |
| `/rxcui/{rxcui}/related.json?tty=IN` | Get ingredients |
| `/drugs.json?name=lipitor` | Search drugs by name |
| `/approximateTerm.json?term=liptor` | Fuzzy search (handles misspellings) |
| `/interaction/list.json?rxcuis=207106+152923` | Drug-drug interactions |
| `/rxclass/class/byDrugName.json?drugName=metformin` | Drug classes |
| `/spellingsuggestions.json?name=liptor` | Spelling suggestions |

### RxClass API (Drug Classifications)
- **Base URL**: `https://rxnav.nlm.nih.gov/REST/rxclass`
- Get drug classes (ATC, MESH, disease-based)
- Find all drugs in a class
- Example: "Get all drugs used for hypertension"

## What Already Exists in IntelliCare

### drugInformationService.js
Location: `apps/backend-api/services/drugInformationService.js`
- Integrates with OpenFDA for adverse events, recalls, labeling, NDC
- Has `getDrugByNDC()` agent tool
- Uses NDC codes (package-level) but NOT RxCUI codes (concept-level)

### Agent Tools
- `searchDrugInformation` - Searches OpenFDA
- `getDrugByNDC` - Lookup by NDC
- `checkDrugInteractions` - Currently in medicationService
- `checkDrugSafety` - OpenFDA adverse events

### Medication Service
- `medicationService.js` stores medications by name
- No standardized drug coding (no RxCUI)

## What Needs to Be Done

### Step 1: Create rxNormService.js
Location: `apps/backend-api/services/rxNormService.js`

Create a new service with functions:
- `searchDrugByName(name)` - Fuzzy search, returns RxCUI + normalized name
- `getDrugDetails(rxcui)` - Full drug info (ingredients, brands, generics, dose forms)
- `getBrandToGeneric(rxcui)` - Map brand name to generic alternatives
- `getGenericToBrands(rxcui)` - Map generic to available brands
- `getDrugInteractions(rxcuis[])` - Drug-drug interaction check via RxNorm
- `getDrugClasses(drugName)` - Get therapeutic classes (ATC, etc.)
- `getSpellingSuggestions(term)` - Handle misspellings
- `normalizeDrugName(input)` - Take free-text input, return standardized name + RxCUI

Add caching (24hr) for drug lookups since RxNorm data changes infrequently.

### Step 2: Route Through externalApiGatewayService
Register RxNorm as a new provider in externalApiGatewayService.js:
```
rxnorm: {
  baseUrl: 'https://rxnav.nlm.nih.gov/REST',
  rateLimit: { requestsPerMinute: 1200 },
  requiresAuth: false
}
```

### Step 3: Add Agent Tools to aiHelpers.js
- `searchDrug` - "Search for a drug by name. Returns standardized name, RxCUI code, ingredients, brands, generics. Handles misspellings. Example: searchDrug('liptor') → Lipitor (atorvastatin)"
- `getDrugAlternatives` - "Find generic alternatives for a brand name drug, or brand options for a generic"
- `getDrugClass` - "Get the therapeutic class of a drug (e.g., ACE inhibitor, beta-blocker, statin)"
- `checkDrugInteractionsRxNorm` - "Check interactions between multiple drugs using RxNorm database"
- `normalizeDrugName` - "Convert a free-text drug name to standardized form with RxCUI code"

### Step 4: Enhance Existing Functions
- Update `medicationService.js` to store RxCUI alongside drug name when adding medications
- Update `checkDrugInteractions` to optionally use RxNorm for more comprehensive results
- Update `formularyService.js` lookups to accept RxCUI (it already supports this!)

### Step 5: Add to Function Group
In `claudeMedicalFunctionGroups.js`, add/update drug-related group with keywords:
- "drug lookup", "medication search", "generic alternative", "brand name"
- "rxcui", "drug code", "drug class", "drug classification"
- "spell drug", "correct drug name"

### Step 6: Test via Chat
- "Look up Lisinopril" → Returns RxCUI, class, generics
- "What are generic alternatives for Lipitor?" → atorvastatin options
- "What class of drug is Metformin?" → Biguanides, antidiabetic
- "Check interactions between Warfarin and Aspirin"
- "I think the drug is called 'liptor' - can you find it?" → Spelling correction to Lipitor

## Files to Create
1. `apps/backend-api/services/rxNormService.js` - New service

## Files to Modify
1. `apps/backend-api/services/externalApiGatewayService.js` - Register RxNorm provider
2. `apps/backend-api/services/utils/aiHelpers.js` - Tool definitions
3. `apps/backend-api/services/agentServiceV4.js` - Case routes
4. `apps/backend-api/services/claudeMedicalFunctionGroups.js` - Keywords
5. `apps/backend-api/services/masterServiceLoader.js` - Load new service

## Status: COMPLETED (February 6, 2026)

### What Was Done
1. Created `apps/backend-api/services/rxNormService.js` - Full service with 8 functions: searchDrugByName, getDrugDetails, getBrandToGeneric, getGenericToBrands, getDrugInteractions, getDrugClasses, getSpellingSuggestions, normalizeDrugName
2. Registered `rxnorm` provider in `externalApiGatewayService.js` (1200 req/min, 24hr cache, no API key)
3. Added `rxNormService` to `masterServiceLoader.js` (Phase 7 business, requireService path, needsInitialization)
4. Added 5 agent tools in `aiHelpers.js`: searchDrug, getDrugAlternatives, getDrugClass, checkDrugInteractionsRxNorm, normalizeDrugName
5. Added case routes in `agentServiceV4.js` for all 5 tools
6. Added `rxNormDrugLookup` function group in `claudeMedicalFunctionGroups.js` with 26 keywords

## Notes
- RxCUI is the universal drug identifier used by CMS, insurance companies, and the formulary API
- Once we have RxCUI codes on medications, formulary lookups (Task 04) become much more accurate
- RxNorm interaction data complements our existing OpenFDA adverse event data
- No API key needed - just respect the 20 req/sec rate limit
