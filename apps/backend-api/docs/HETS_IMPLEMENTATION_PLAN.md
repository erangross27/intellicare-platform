# CMS HETS Implementation Plan - FREE Medicare Eligibility & MBI Lookup

## Overview
CMS HETS (HIPAA Eligibility Transaction System) is the **FREE** official Medicare eligibility system that provides:
- Real-time Medicare eligibility verification
- MBI (Medicare Beneficiary Identifier) retrieval
- Benefits information
- **COST: $0** - Completely free for enrolled Medicare providers

## Why HETS Instead of Stedi/pVerify/Eligible?
- **Stedi**: $500/month minimum
- **pVerify**: $100-500/month 
- **Eligible**: $500/month minimum
- **CMS HETS**: **FREE** - Direct from Medicare

## How HETS Works
1. Send X12 270 eligibility request with patient SSN/MBI
2. Receive X12 271 response with:
   - Medicare Beneficiary Identifier (MBI)
   - Medicare Part A/B/C/D coverage
   - Eligibility dates
   - Benefits information
3. Real-time only (no batch processing)
4. Available 24/7

## Implementation Steps

### Step 1: Provider Enrollment (One-time)
1. Enroll as Medicare provider if not already enrolled
2. Register for EDI (Electronic Data Interchange) access
3. Get HETS credentials from your MAC (Medicare Administrative Contractor)
4. Time: 1-2 weeks for approval

### Step 2: Technical Implementation

#### Option A: Direct X12 Integration (Most Control)
```javascript
// backend/services/hetsService.js
const axios = require('axios');
const x12 = require('x12-parser'); // npm install x12-parser

class HETSService {
  constructor() {
    this.endpoint = 'https://www.cms.gov/hets/270'; // Actual endpoint from MAC
    this.submitterId = process.env.HETS_SUBMITTER_ID;
    this.password = process.env.HETS_PASSWORD;
  }

  async lookupPatientBySSN(params) {
    // Build X12 270 request
    const x12Request = this.build270Request({
      ssn: params.ssn,
      firstName: params.firstName,
      lastName: params.lastName,
      dateOfBirth: params.dateOfBirth
    });
    
    // Send to HETS
    const response = await this.sendToHETS(x12Request);
    
    // Parse X12 271 response
    const eligibilityData = this.parse271Response(response);
    
    return {
      mbi: eligibilityData.mbi,
      partA: eligibilityData.partA,
      partB: eligibilityData.partB,
      // ... etc
    };
  }
  
  build270Request(patient) {
    // X12 270 format for SSN to MBI lookup
    return `ISA*00*          *00*          *ZZ*${this.submitterId}*ZZ*CMS*${this.getDate()}*${this.getTime()}*^*00501*000000001*0*P*:~
GS*HS*${this.submitterId}*CMS*${this.getDate()}*${this.getTime()}*1*X*005010X279A1~
ST*270*0001*005010X279A1~
BHT*0022*13*${this.getControlNumber()}*${this.getDate()}*${this.getTime()}~
HL*1**20*1~
NM1*PR*2*CENTERS FOR MEDICARE & MEDICAID SERVICES*****PI*CMS~
HL*2*1*21*1~
NM1*1P*2*${this.getProviderName()}*****XX*${this.getNPI()}~
HL*3*2*22*0~
NM1*IL*1*${patient.lastName}*${patient.firstName}****MI*${patient.ssn}~
DMG*D8*${patient.dateOfBirth}~
DTP*291*D8*${this.getDate()}~
EQ*30~
SE*13*0001~
GE*1*1~
IEA*1*000000001~`;
  }
  
  parse271Response(x12Response) {
    // Parse the X12 271 response
    const parsed = x12.parse(x12Response);
    
    // Extract MBI from NM1 segment
    const subscriberSegment = parsed.find(seg => 
      seg.tag === 'NM1' && seg.elements[0] === 'IL'
    );
    
    return {
      mbi: subscriberSegment?.elements[8], // MBI in position 9
      firstName: subscriberSegment?.elements[3],
      lastName: subscriberSegment?.elements[2],
      // Parse benefits from EB segments
      partA: this.hasPartA(parsed),
      partB: this.hasPartB(parsed),
      // ... etc
    };
  }
}
```

#### Option B: Use Free HETS Gateway Services
Several companies provide FREE HETS gateway services that handle the X12 complexity:

1. **Availity** (FREE tier available)
   - Handles X12 formatting
   - Provides REST API wrapper
   - Free for low volume

2. **Change Healthcare** (FREE tier)
   - REST API for HETS
   - JSON in/out
   - Free up to 500 transactions/month

### Step 3: Integration with IntelliCare

```javascript
// Update backend/services/mbiLookupService.js
async getMBIFromSSN(params) {
  // 1. First try HETS (FREE)
  try {
    const hetsResult = await this.hetsService.lookupPatientBySSN(params);
    if (hetsResult.mbi) {
      return {
        mbi: hetsResult.mbi,
        source: 'HETS',
        cost: 0  // FREE!
      };
    }
  } catch (error) {
    console.log('HETS lookup failed, falling back to manual');
  }
  
  // 2. Fall back to manual MAC portal lookup
  return {
    requiresManualLookup: true,
    instructions: 'Please manually look up MBI in MAC portal',
    macPortalUrl: this.getMACPortalByState(params.state)
  };
}
```

## Timeline

### Week 1-2: Provider Enrollment
- Apply for HETS access through MAC
- Get credentials and documentation

### Week 3: Development
- Implement X12 270/271 builder/parser
- Test with HETS test environment
- Integrate with existing services

### Week 4: Testing & Deployment
- Test with real Medicare beneficiaries
- Deploy to production
- Train staff on fallback procedures

## Fallback Options (While Waiting for HETS)

### Immediate: Manual MAC Portal (FREE)
Each MAC provides FREE web portal for MBI lookup:
- **NGS**: IL, MN, WI, CT, NY, MA, ME, NH, RI, VT
- **Novitas**: PA, MD, DE, NJ, CO, NM, OK, TX, AR, LA, MS
- **Palmetto**: NC, SC, VA, WV, TN, GA, AL, FL
- **Noridian**: CA, NV, AZ, AK, HI, OR, WA, ID, UT, MT, WY, ND, SD

Staff can manually look up MBI while HETS is being set up.

## Cost Comparison

| Service | Monthly Cost | Per Transaction | Setup Time |
|---------|-------------|-----------------|------------|
| Stedi | $500 | ~$0.30 | Immediate |
| pVerify | $100-500 | Varies | 1 week |
| Eligible | $500 | Varies | 1 week |
| **CMS HETS** | **$0** | **$0** | 2-3 weeks |
| MAC Portal | $0 | $0 (manual) | Immediate |

## Recommendation

1. **Immediate**: Use MAC portal manual lookup (FREE)
2. **2-3 weeks**: Implement HETS for automated lookups (FREE)
3. **Never**: Pay $500/month for third-party APIs

## Resources

- HETS Enrollment: https://www.cms.gov/Medicare/Billing/ElectronicBillingEDITrans/HETS
- HETS Companion Guide: https://www.cms.gov/files/document/current-hets-270-271-companion-guide.pdf
- X12 270/271 Specs: https://x12.org/codes/eligibility-benefit-inquiry-and-response-270-271
- MAC Portals: Listed above by region

## Next Steps

1. ✅ Cancel expensive Stedi/pVerify/Eligible plans
2. ✅ Identify your MAC region
3. ✅ Apply for HETS access
4. ✅ Implement manual MAC portal lookup immediately
5. ✅ Develop HETS integration over next 2-3 weeks
6. ✅ Save $500/month!