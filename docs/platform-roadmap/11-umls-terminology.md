# Task 11: Integrate UMLS Terminology Services

## Priority: MEDIUM
## Category: Phase 2 - Free Government API Integration
## Dependencies: None
## Cost: FREE (requires free UMLS license)

## Background

UMLS (Unified Medical Language System) is the master medical terminology system from NLM. It maps between all medical coding systems - ICD-10, SNOMED-CT, CPT, LOINC, RxNorm, MeSH, etc. This lets the system translate between different code systems and standardize medical terminology.

## API Details

### UMLS Terminology Services API
- **Base URL**: `https://uts-ws.nlm.nih.gov/rest`
- **Auth**: API key from UMLS license (free)
- **Rate Limit**: Not publicly specified
- **Registration**: https://uts.nlm.nih.gov/uts/signup-login (free, individual developer)
- **Documentation**: https://documentation.uts.nlm.nih.gov/rest/home.html

### Key Endpoints
| Endpoint | What It Does |
|----------|-------------|
| `/search/current?string=diabetes` | Search across all vocabularies |
| `/content/current/CUI/{CUI}` | Get concept by Concept Unique Identifier |
| `/content/current/CUI/{CUI}/atoms` | Get all code system representations |
| `/crosswalk/current/source/{source}/{id}` | Map between code systems |

### What UMLS Connects
- **ICD-10-CM** ↔ **SNOMED-CT** ↔ **CPT** ↔ **LOINC** ↔ **RxNorm** ↔ **MeSH**
- Example: "Type 2 Diabetes" has codes in ALL these systems
- UMLS maps them all through a shared CUI (Concept Unique Identifier)

## What Already Exists

No UMLS integration currently exists in IntelliCare. Medical terminology is stored as free text.

## What Needs to Be Done

### Step 1: Register for UMLS License
- Go to https://uts.nlm.nih.gov/uts/signup-login
- Create individual account (free, no business ID needed)
- Accept UMLS license agreement
- Get API key
- Store API key in KMS (`productionKMS.js`)

### Step 2: Create umlsService.js
Functions:
- `searchMedicalTerm(term)` - Search across all vocabularies
- `getConcept(cui)` - Get concept details
- `crosswalkCodes(sourceSystem, code, targetSystem)` - Map between code systems
  - Example: ICD-10 "E11" → SNOMED-CT code
- `getRelatedConcepts(cui, relation)` - Broader, narrower, sibling terms
- `normalizeTerm(freeText)` - Map free text to standardized UMLS concept

### Step 3: Wire to Agent
- `translateMedicalCode` - "Translate a medical code between systems. Example: ICD-10 E11 to SNOMED-CT"
- `lookupMedicalTerm` - "Look up a medical term in UMLS and get all related codes"
- `standardizeMedicalTerm` - "Standardize a medical term using UMLS"

### Step 4: Test via Chat
- "What's the SNOMED code for type 2 diabetes?"
- "Translate ICD-10 code E11 to SNOMED-CT"
- "Look up the medical term 'heart attack' in UMLS"

## Files to Create
1. `apps/backend-api/services/umlsService.js`

## Files to Modify
1. Standard agent wiring files
2. `apps/backend-api/services/productionKMS.js` - Store UMLS API key

## Notes
- UMLS license is free for individual developers
- No business ID required for registration
- This is the "Rosetta Stone" of medical terminology
- Enables interoperability between different code systems
- Important for any future FHIR integration
