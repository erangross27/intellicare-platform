# Task 10: Integrate Medicaid Data API

## Priority: MEDIUM
## Category: Phase 2 - Free Government API Integration
## Dependencies: None
## Cost: FREE

## Background

Medicaid covers ~90 million Americans (low-income, disabled, children). The Medicaid Data API provides state-level enrollment data, provider participation, drug utilization, and program statistics. This helps practices understand their Medicaid patient population.

## API Details

### Medicaid Data API
- **Base URL**: `https://data.medicaid.gov/api`
- **Auth**: None for public data
- **Rate Limit**: Standard Socrata API limits
- **Documentation**: https://data.medicaid.gov/about/api

### Available Datasets
- State Drug Utilization Data (SDUD) - Drug prescribing patterns by state
- Medicaid enrollment by state/month
- Provider enrollment data
- CHIP enrollment
- Medicaid managed care enrollment

### Socrata Open Data API (SODA)
All CMS Medicaid data uses Socrata's API format:
- `GET /resource/{dataset-id}.json?$where=state='NY'`
- Supports SQL-like filtering, pagination
- JSON/CSV/XML responses

## What Already Exists

### Agent Tools
- `checkMedicaidEligibility` - Exists in agentServiceV4 (may be mock)

## What Needs to Be Done

### Step 1: Create medicaidDataService.js
Functions:
- `getMedicaidEnrollment(state, year)` - State enrollment numbers
- `getDrugUtilization(drugName, state, year)` - Prescribing patterns
- `getStatePrograms(state)` - Available Medicaid programs by state
- `getProviderParticipation(state, specialty)` - Provider data
- `getManagedCarePlans(state)` - Available managed care options

### Step 2: Wire to Agent

### Step 3: Test via Chat
- "How many Medicaid enrollees are in New York?"
- "What's the most prescribed drug under Medicaid in California?"
- "Show me Medicaid managed care plans in Texas"

## Files to Create
1. `apps/backend-api/services/medicaidDataService.js`

## Notes
- Useful for population health analytics
- Helps understand payer mix in a practice
- Data is aggregated (no individual patient data)
