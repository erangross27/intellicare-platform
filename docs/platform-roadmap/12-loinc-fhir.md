# Task 12: Integrate LOINC FHIR Terminology Server

## Priority: LOW
## Category: Phase 2 - Free Government API Integration
## Dependencies: None
## Cost: FREE (requires free LOINC account)

## Background

LOINC (Logical Observation Identifiers Names and Codes) is the universal standard for lab tests, clinical observations, and vital signs. When a doctor orders a "CBC" or "Basic Metabolic Panel", LOINC assigns a standardized code. This standardizes lab result interpretation across the platform.

## API Details

### LOINC FHIR Server
- **Base URL**: `https://fhir.loinc.org`
- **Auth**: Free LOINC account required (https://loinc.org/get-started/)
- **Format**: FHIR R4
- **Documentation**: https://loinc.org/fhir/

### Key Operations
- Search LOINC codes: `GET /CodeSystem/$lookup?code=2160-0` (Creatinine)
- Search by name: `GET /CodeSystem/$lookup?property=display&value=glucose`
- Get value sets: `GET /ValueSet/{id}`

## What Already Exists

Lab results are stored with test names as free text. No LOINC codes are used.

## What Needs to Be Done

### Step 1: Register for Free LOINC Account
### Step 2: Create loincService.js
- `searchLabCode(testName)` - Search LOINC codes
- `getLabCodeDetails(loincCode)` - Get test details
- `getCommonLabPanels()` - CBC, BMP, CMP, lipid panel codes
- `validateLabCode(code)` - Check if valid LOINC

### Step 3: Wire to Agent
### Step 4: Enhance Lab Functions
- Add optional LOINC code to lab results when storing
- Help standardize lab test names across the system

## Notes
- Future FHIR interoperability requires LOINC codes
- Standardizes lab test identification across the platform
- Lower priority because the platform works without it currently
