# Task 09: Integrate Medicare Coverage API (LCD/NCD)

## Priority: MEDIUM
## Category: Phase 2 - Free Government API Integration
## Dependencies: None
## Cost: FREE

## Background

The Medicare Coverage Database contains National Coverage Determinations (NCDs) and Local Coverage Determinations (LCDs) that define what Medicare covers. This lets the agent answer "Does Medicare cover X procedure for Y condition?" - critical for elderly patients.

## API Details

### Medicare Coverage API
- **Base URL**: `https://api.coverage.cms.gov` (or via data.cms.gov)
- **Auth**: May require free CMS developer account
- **Documentation**: https://developer.cms.gov/

### Alternative: CMS Coverage Data
- **URL**: https://www.cms.gov/medicare-coverage-database
- NCDs and LCDs are available as downloadable datasets
- Can be imported into MongoDB for local querying

### What It Covers
- National Coverage Determinations (NCDs) - national Medicare policy
- Local Coverage Determinations (LCDs) - regional Medicare policy
- Coverage articles explaining medical necessity criteria
- Procedure-to-diagnosis code mappings

## What Already Exists

### Agent Tools
- `checkMedicareCoverage` - Exists but may use mock data
- `searchMedicareDoctors` - CMS provider directory
- `getMedicareQualityRatings` - Quality data
- `checkMedicaidEligibility` - Medicaid check

### Blue Button 2.0
- Full OAuth implementation for Medicare claims data
- Can retrieve coverage, claims, demographics

## What Needs to Be Done

### Step 1: Create medicareCoverageService.js
Functions:
- `checkMedicareCoverage(procedureCode, diagnosisCode)` - Is this covered?
- `getNCDDetails(ncdId)` - Get national coverage determination details
- `getLCDDetails(lcdId, macRegion)` - Get local coverage by region
- `searchCoverageByProcedure(cptCode)` - What conditions make this procedure covered?
- `searchCoverageByDiagnosis(icdCode)` - What procedures are covered for this condition?
- `getMedicalNecessityCriteria(procedureCode, diagnosisCode)` - Get coverage criteria

### Step 2: If API is unavailable, import coverage data
Download NCD/LCD datasets from CMS and store in MongoDB for local querying.

### Step 3: Add Agent Tools and Wire

### Step 4: Test via Chat
- "Does Medicare cover MRI of the knee for osteoarthritis?"
- "What's the coverage determination for genetic testing?"
- "Is physical therapy covered for post-stroke rehabilitation under Medicare?"

## Files to Create
1. `apps/backend-api/services/medicareCoverageService.js`

## Files to Modify
1. Standard agent wiring files (aiHelpers, agentServiceV4, functionGroups)

## Notes
- This helps providers know BEFORE ordering a test whether Medicare will pay
- Reduces claim denials and improves patient communication
- Coverage policies change - cache with appropriate TTL
