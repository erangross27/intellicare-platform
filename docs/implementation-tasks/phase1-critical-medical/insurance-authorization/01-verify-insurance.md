# Task: Verify Insurance

## Function Details
- **Function Name**: `verifyInsurance`
- **Current Status**: ❌ BROKEN
- **Priority**: HIGH
- **Estimated Time**: 4 hours

## Problem Description
The agent calls `POST /insurance/verify` but the backend route only has `PUT /:insuranceId/verify`. This mismatch causes the function to fail with 404 errors. Additionally, there's no actual insurance verification logic - it just updates an existing record.

## Implementation Steps

### 1. Create New Endpoint (Backend)
```javascript
// In backend/routes/insurance.js, add:
router.post('/verify', async (req, res) => {
  // Implementation here
});
```

### 2. Add Verification Service
```javascript
// Create backend/services/insuranceVerification.js
class InsuranceVerificationService {
  async verifyEligibility(patientId, insuranceData) {
    // Mock verification logic
    // In future, integrate with clearinghouse API
  }
}
```

### 3. Update Agent Function
```javascript
// In agentServiceV4.js, ensure correct endpoint:
async verifyInsurance(params, practiceContext) {
  const response = await this.callAPI('/insurance/verify', 'POST', params, practiceContext);
  return response;
}
```

## Required Endpoints
```
POST /api/insurance/verify
  Body: {
    patientId: string,
    insuranceProvider: string,
    policyNumber: string,
    serviceType: string,
    dateOfService: string
  }
  
  Response: {
    success: boolean,
    verified: boolean,
    eligibility: {
      status: 'active' | 'inactive' | 'terminated',
      effectiveDate: string,
      terminationDate: string
    },
    coverage: {
      serviceType: string,
      covered: boolean,
      copay: number,
      deductible: {
        amount: number,
        met: number,
        remaining: number
      },
      outOfPocket: {
        max: number,
        met: number,
        remaining: number
      }
    },
    verificationNumber: string,
    timestamp: Date
  }
```

## Data Models Required
```javascript
// Add to Insurance model:
{
  verifications: [{
    verificationNumber: String,
    verifiedAt: Date,
    verifiedBy: String,
    status: String,
    eligibilityResponse: Object,
    serviceType: String,
    valid: Boolean
  }]
}
```

## Test Cases
1. **Valid Insurance**: Should return verified=true with coverage details
2. **Invalid Policy**: Should return verified=false with error message
3. **Expired Insurance**: Should return inactive status
4. **Missing Patient**: Should return 404 error
5. **Network Error**: Should handle timeout gracefully

## Dependencies
- Patient must exist in database
- Insurance record should be created or updated
- Audit log must record verification attempt

## Success Criteria
- [ ] Endpoint returns valid response
- [ ] Verification number is generated
- [ ] Results are stored in database
- [ ] Audit log captures attempt
- [ ] Agent function works without errors
- [ ] Response time < 2 seconds

## Notes
- Initially use mock data for verification
- Plan for future integration with real clearinghouse API
- Consider caching verification results for 24 hours
- Include HIPAA-compliant audit logging