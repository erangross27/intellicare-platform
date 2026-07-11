# Task 07: Integrate DailyMed Drug Labeling API

## Status: COMPLETE (February 2026)
## Priority: HIGH
## Category: Phase 2 - Free Government API Integration
## Dependencies: None (enhanced by Task 06 - RxNorm)
## Cost: FREE (No API key required)

## Background

DailyMed is the official FDA drug labeling database maintained by NLM. It contains the full prescribing information (package inserts) for every FDA-approved drug - warnings, contraindications, dosage, drug interactions, pregnancy categories, and more. This complements OpenFDA (which focuses on adverse events and recalls) by providing the official prescribing information.

## API Details

### DailyMed Web Services
- **Base URL**: `https://dailymed.nlm.nih.gov/dailymed/services/v2`
- **Auth**: None required
- **Rate Limit**: Not publicly specified (be respectful)
- **Documentation**: https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm

### Key Endpoints
| Endpoint | What It Does |
|----------|-------------|
| `/spls.json?drug_name=aspirin` | Search drug labels by name |
| `/spls/{setId}.json` | Get full label by Set ID |
| `/spls/{setId}/packaging.json` | Get NDC codes and packaging |
| `/spls/{setId}/media.json` | Get drug images |
| `/drugnames.json?drug_name=lip` | Autocomplete drug names |
| `/drugclasses.json` | List drug classes |
| `/ndc/{ndc}.json` | Look up by NDC code |

### What Each Label Contains
- **Boxed warnings** (black box warnings)
- **Indications and usage**
- **Dosage and administration**
- **Contraindications**
- **Warnings and precautions**
- **Adverse reactions**
- **Drug interactions**
- **Use in specific populations** (pregnancy, pediatric, geriatric)
- **Clinical pharmacology**
- **Patient counseling information**

## What Already Exists in IntelliCare

### drugInformationService.js
- OpenFDA drug label search (partial labels via `drug/label` endpoint)
- Drug adverse events
- Drug recalls
- NDC directory lookup

### Agent Tools
- `searchDrugInformation` - OpenFDA search (limited label data)
- `checkDrugSafety` - Adverse events from FAERS
- `checkDrugAdverseEvents` - Also from FAERS

## What Needs to Be Done

### Step 1: Create dailyMedService.js
Location: `apps/backend-api/services/dailyMedService.js`

Functions:
- `searchDrugLabel(drugName)` - Search labels, return list with Set IDs
- `getDrugLabel(setId)` - Get full prescribing information
- `getDrugWarnings(drugName)` - Extract just boxed warnings + contraindications
- `getDrugDosage(drugName)` - Extract dosage and administration section
- `getDrugInteractionsLabel(drugName)` - Extract drug interactions from label
- `getDrugImages(setId)` - Get pill/package images
- `getDrugByNDCDailyMed(ndc)` - Cross-reference NDC to full label
- `autocompleteDrugName(partialName)` - Typeahead suggestions

Cache labels for 7 days (labels change infrequently).

### Step 2: Register in externalApiGatewayService
Add DailyMed as a provider.

### Step 3: Add Agent Tools
- `getDrugPrescribingInfo` - "Get the official FDA prescribing information for a drug. Includes dosage, warnings, contraindications, interactions"
- `getDrugBlackBoxWarning` - "Get boxed (black box) warnings for a drug - the most serious FDA safety warnings"
- `getDrugDosageInfo` - "Get recommended dosage and administration instructions"
- `getDrugContraindications` - "Get contraindications - when a drug should NOT be used"
- `getDrugPregnancyInfo` - "Get pregnancy and lactation safety information"
- `getDrugImage` - "Get an image of a drug pill or package"

### Step 4: Enhance Existing Drug Functions
- When `checkDrugInteractions` is called, supplement with DailyMed label interaction data
- When `prescribeMedication` is called, optionally show key warnings from DailyMed
- Link DailyMed data to patient allergy records for contraindication alerts

### Step 5: Test via Chat
- "What are the boxed warnings for Warfarin?"
- "What's the recommended dosage for Metformin?"
- "Is Lisinopril safe during pregnancy?"
- "Show me what a 10mg Lipitor pill looks like"
- "What are the contraindications for combining Methotrexate with alcohol?"

## Files to Create
1. `apps/backend-api/services/dailyMedService.js`

## Files to Modify
1. `apps/backend-api/services/externalApiGatewayService.js` - Register provider
2. `apps/backend-api/services/utils/aiHelpers.js` - Tool definitions
3. `apps/backend-api/services/agentServiceV4.js` - Case routes
4. `apps/backend-api/services/claudeMedicalFunctionGroups.js` - Keywords
5. `apps/backend-api/services/masterServiceLoader.js` - Load service

## Implementation Notes
- **CRITICAL**: Individual label endpoint (`/spls/{setId}.json`) returns HTTP 415 — labels are ONLY available as XML (`.xml` extension). The service uses axios to fetch XML directly (bypassing the gateway's JSON-only `makeRequest`) and parses SPL XML by LOINC section codes.
- **Accept header**: Must use `Accept: */*` — `Accept: application/xml` returns HTTP 406.
- **Repackager labels**: Search results are sorted by published_date desc, so repackagers (Aphena Pharma, RemedyRepack) dominate first pages. The service tries up to 5 labels and picks the one with the most key sections (3+ required).
- DailyMed has MORE detailed label info than OpenFDA drug/label endpoint
- Pill images can be displayed in the artifact panel
- Boxed warnings are critical for medication safety
- Combine with RxNorm (Task 06) for standardized drug identification
