# Task 16: Enhance CMS Provider Directory Features

## Priority: MEDIUM
## Category: Phase 3 - Enhance Existing Integrations
## Dependencies: None
## Cost: FREE

## Background

IntelliCare already integrates with the CMS Provider Directory (NPPES NPI Registry) via `providerDirectoryService.js`. This task enhances it with additional free CMS data sources for richer provider information.

## What Already Exists

### providerDirectoryService.js
- NPI lookup by number
- Provider search by name, specialty, location
- Quality scoring
- FHIR data exchange capability

### Agent Tools
- `searchApiDoctors` - Search CMS/BetterDoctor
- `getDoctorByNPI` - NPI lookup
- `getDoctorSpecialties` - List specialties

## What Needs to Be Done

### Step 1: Add Medicare Quality Data
- CMS publishes physician quality ratings (Physician Compare)
- URL: https://data.cms.gov/provider-data
- Add quality scores, patient experience ratings, clinical outcomes
- Free, no API key needed

### Step 2: Add Hospital Affiliation Data
- CMS Hospital Compare data
- Which hospitals providers are affiliated with
- Hospital quality ratings, readmission rates

### Step 3: Add PECOS Enrollment Status
- Provider Enrollment, Chain, and Ownership System
- Check if a provider is enrolled in Medicare
- Important for referrals to Medicare-accepting providers

### Step 4: Enhance Search
- Search by insurance accepted (from NPI supplemental data)
- Search by hospital affiliation
- Search by quality rating
- Search by languages spoken

### Step 5: Wire New Functions to Agent

## Files to Modify
1. `apps/backend-api/services/providerDirectoryService.js` - Add data sources
2. Standard agent wiring files

## Notes
- All CMS provider data is free and public
- Enhances the referral workflow (find best specialist for patient)
