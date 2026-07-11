# Stedi Healthcare API Setup Guide

## Overview
Stedi provides SSN to MBI (Medicare Beneficiary Identifier) lookup for automatic patient data retrieval without requiring patient login.

## Current Status
✅ **Test Integration Working** - Can retrieve test data (John Doe, Aetna)
❌ **Production SSN Lookup** - Requires production API key

## API Key Requirements

### Test API Key (Current)
- Key: `test_RKGNmAc.KzDutGGJPFYeuHvXEwZoPFyn`
- **Limitations**: 
  - Can ONLY use pre-defined test patients
  - Cannot perform real SSN lookups
  - Will return "PII detected" error for any real data

### Production API Key (Needed)
- **Required for**: Real SSN to MBI lookups
- **Sign up at**: https://www.stedi.com/
- **Pricing**: ~$0.30 per eligibility check
- **Store in KMS**: 
  ```bash
  cd backend
  node -e "const kms = require('./services/productionKMS'); kms.storeInternalKey('STEDI_API_KEY', 'YOUR_PRODUCTION_KEY')"
  ```

## Test Data That Works

### Aetna Test Patient
```javascript
{
  tradingPartnerServiceId: '60054',
  firstName: 'John',
  lastName: 'Doe',
  memberId: 'AETNA9wcSu'
}
```

### Test Response Includes:
- Full eligibility information
- Benefits details
- Coverage dates
- Copay/deductible information

## Production Setup Steps

1. **Get Production API Key**
   - Sign up at https://www.stedi.com/
   - Complete onboarding process
   - Get production API credentials

2. **Store API Key in KMS**
   ```bash
   cd backend
   node -e "const kms = require('./services/productionKMS'); kms.storeInternalKey('STEDI_API_KEY', 'YOUR_PRODUCTION_KEY')"
   ```

3. **Test Production SSN Lookup**
   ```bash
   cd backend
   NODE_ENV=production node test-ssn-lookup.js
   ```

## How It Works

### In Production (with real API key):
1. Patient provides SSN + DOB + Name
2. Stedi performs MBI lookup with Medicare
3. Returns:
   - Medicare Beneficiary Identifier (MBI)
   - Patient demographics
   - Medicare coverage (Part A, B, C, D)
   - Benefits information
4. No patient login required!

### In Development (test key):
- Uses pre-defined test data only
- Cannot perform real SSN lookups
- Good for testing integration flow

## Services Using Stedi

1. **stediHealthcareService.js** - Primary Stedi integration
2. **mbiLookupService.js** - Falls back to Stedi for MBI lookup
3. **agentServiceV4.js** - Uses for `lookupPatientBySSN` function

## Troubleshooting

### "Potential PII detected" Error
- **Cause**: Using test API key with real data
- **Solution**: Get production API key or use approved test data

### "No Medicare record found"
- **Cause**: Patient not in Medicare system
- **Solution**: Fall back to manual entry or patient login

## Next Steps
1. Obtain production Stedi API key
2. Complete Stedi onboarding
3. Store production key in KMS
4. Test with real SSN data
5. Update workflow to use SSN lookup for US patients

## Support
- Stedi Documentation: https://www.stedi.com/docs/
- API Reference: https://www.stedi.com/docs/api-reference/
- Support: support@stedi.com