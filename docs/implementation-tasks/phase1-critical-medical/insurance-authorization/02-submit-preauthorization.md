# Task: Submit Pre-Authorization

## Function Details
- **Function Name**: `submitPreAuthorization`
- **Current Status**: ❌ MISSING ENDPOINT
- **Priority**: HIGH
- **Estimated Time**: 6 hours

## Problem Description
Agent calls `/insurance/preauth` but this endpoint doesn't exist. The existing route `/:insuranceId/authorization` requires an existing insurance record ID, which doesn't match the agent's flow.

## Implementation Steps

### 1. Create Pre-Authorization Endpoint
```javascript
// In backend/routes/insurance.js:
router.post('/preauth', async (req, res) => {
  const {
    patientId,
    procedureCode,
    diagnosis,
    justification,
    providerNPI,
    serviceDate,
    urgency
  } = req.body;
  
  // Generate auth number
  // Store request
  // Return authorization
});
```

### 2. Create Authorization Service
```javascript
// backend/services/preAuthorizationService.js
class PreAuthorizationService {
  generateAuthNumber() {
    return `PA-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }
  
  async submitAuthorization(authData) {
    // Store locally
    // In future: Submit to payer
  }
  
  async checkStatus(authNumber) {
    // Check authorization status
  }
}
```

### 3. Add Authorization Model
```javascript
// backend/models/PreAuthorization.js
const preAuthSchema = new Schema({
  authNumber: { type: String, unique: true, required: true },
  patientId: { type: String, required: true },
  procedureCode: { type: String, required: true },
  diagnosis: [String],
  justification: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'more_info_needed'],
    default: 'pending'
  },
  submittedAt: Date,
  reviewedAt: Date,
  expiresAt: Date,
  approvalDetails: {
    approvedUnits: Number,
    limitations: String,
    validFrom: Date,
    validTo: Date
  }
});
```

## Required Endpoints
```
POST /api/insurance/preauth
  Body: {
    patientId: string,
    insuranceId?: string,
    procedureCode: string,
    procedureName: string,
    diagnosis: string[],
    justification: string,
    providerNPI: string,
    serviceDate: Date,
    estimatedCost: number,
    urgency: 'routine' | 'urgent' | 'emergent'
  }
  
  Response: {
    success: boolean,
    authNumber: string,
    status: 'pending' | 'approved' | 'denied',
    submittedAt: Date,
    estimatedReviewTime: string,
    trackingUrl?: string,
    message: string
  }

GET /api/insurance/preauth/:authNumber
  Response: {
    authNumber: string,
    status: string,
    details: object
  }

PUT /api/insurance/preauth/:authNumber
  Body: {
    status: string,
    reviewNotes?: string
  }
```

## Data Models Required
```javascript
// PreAuthorization collection
{
  _id: ObjectId,
  authNumber: String,
  patientId: String,
  practiceId: String,
  insuranceId: String,
  procedureCode: String,
  procedureName: String,
  diagnosisCodes: [String],
  justification: String,
  clinicalNotes: String,
  providerNPI: String,
  serviceDate: Date,
  requestedUnits: Number,
  estimatedCost: Number,
  urgency: String,
  status: String,
  statusHistory: [{
    status: String,
    timestamp: Date,
    changedBy: String,
    notes: String
  }],
  submittedAt: Date,
  submittedBy: String,
  reviewedAt: Date,
  reviewedBy: String,
  approvalDetails: {
    approvedUnits: Number,
    approvedAmount: Number,
    limitations: String,
    validFrom: Date,
    validTo: Date,
    authorizationNumber: String
  },
  denialReason: String,
  appealDeadline: Date,
  documents: [String],
  expiresAt: Date
}
```

## Test Cases
1. **Submit Valid Pre-Auth**: Should generate auth number and return pending status
2. **Missing Required Fields**: Should return validation error
3. **Invalid Procedure Code**: Should validate against CPT codes
4. **Duplicate Request**: Should check for existing auth for same procedure
5. **Status Check**: Should retrieve current auth status
6. **Update Status**: Should allow status updates with proper permissions

## Dependencies
- Patient must exist
- Insurance information should be on file
- Provider NPI must be valid
- Procedure codes should validate against CPT database

## Success Criteria
- [ ] Pre-auth endpoint accepts requests
- [ ] Auth numbers are unique and trackable
- [ ] Status can be checked and updated
- [ ] Audit trail maintained
- [ ] Agent function works correctly
- [ ] Response includes all required fields

## Mock Implementation Logic
```javascript
// For MVP, auto-approve common procedures:
const autoApprove = ['99213', '99214', '70553', '73721'];
if (autoApprove.includes(procedureCode)) {
  status = 'approved';
  approvalDetails = {
    approvedUnits: requestedUnits,
    validFrom: serviceDate,
    validTo: addDays(serviceDate, 90)
  };
} else {
  status = 'pending';
  estimatedReviewTime = '24-48 hours';
}
```

## Notes
- Start with mock approvals for testing
- Plan for integration with payer APIs
- Consider implementing appeal process
- Add document upload capability for supporting docs
- Include expiration tracking
- Send notifications on status changes