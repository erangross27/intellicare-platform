# Task 13: Integrate WHO ICD API

## Priority: LOW
## Category: Phase 2 - Free Government API Integration
## Dependencies: Task 08 (ICD-10-CM) should be done first
## Cost: FREE (requires free WHO account)

## Background

The WHO ICD API provides access to ICD-10 and ICD-11 classification systems. While Task 08 covers US-specific ICD-10-CM, the WHO API provides the international version and the newer ICD-11 standard. Useful for international patients or future global expansion.

## API Details

### WHO ICD API
- **Base URL**: `https://id.who.int/icd`
- **Auth**: OAuth 2.0 (free registration at https://icd.who.int/icdapi)
- **Documentation**: https://icd.who.int/icdapi

### Key Features
- ICD-10 and ICD-11 code lookup
- Full hierarchy navigation
- Multilingual support (42 languages)
- Coding tool integration

## What Needs to Be Done

### Step 1: Register at WHO ICD API portal (free)
### Step 2: Create whoIcdService.js
- `searchICD11(query)` - Search ICD-11 codes
- `mapICD10toICD11(icd10code)` - Map ICD-10 to ICD-11
- `getCodeHierarchy(code)` - Navigate code tree

### Step 3: Wire to Agent

## Notes
- Low priority for US-only market
- ICD-11 adoption is growing but ICD-10 is still standard in US
- Useful if platform expands internationally
- Free registration, no business ID needed
