# SSN to MBI Lookup Alternatives

## Current Options & Pricing

### 1. Stedi Healthcare API
- **Cost**: $500/month minimum (or ~$0.30 per lookup)
- **Pros**: Direct SSN to MBI lookup, no patient login needed
- **Cons**: Expensive for small practices

### 2. FREE Alternative: Direct Medicare Portal Access
Instead of automated SSN lookup, practices can:

#### Option A: Medicare Administrative Contractor (MAC) Portals (FREE)
Each region has a MAC that provides **FREE** MBI lookup for providers:

- **Noridian (JE/JF)**: https://med.noridianmedicare.com/
  - States: CA, NV, AZ, MT, ND, SD, UT, WY, OR, WA, ID, AK, HI
  - FREE provider portal with MBI lookup tool
  
- **Palmetto GBA (JJ/JM)**: https://www.palmettogba.com/
  - States: NC, SC, VA, WV, AL, GA, TN, FL, PR, VI
  - FREE MBI lookup for enrolled providers
  
- **Novitas (JH/JL)**: https://www.novitas-solutions.com/
  - States: AR, CO, LA, MS, NM, OK, TX, DE, DC, MD, NJ, PA
  - FREE provider portal access
  
- **NGS (JK/J6)**: https://www.ngsmedicare.com/
  - States: CT, IL, MA, ME, MN, NH, NY, RI, VT, WI
  - FREE MBI lookup tool

**How to Use**:
1. Register your practice with your regional MAC (one-time setup)
2. Staff manually looks up MBI using patient SSN
3. Copy MBI into IntelliCare system
4. **Cost**: FREE (just staff time ~30 seconds per lookup)

#### Option B: HETS (HIPAA Eligibility Transaction System) - FREE
- Direct CMS system for eligibility checks
- Requires EDI setup but completely FREE
- Returns MBI with eligibility response
- Documentation: https://www.cms.gov/Medicare/Billing/ElectronicBillingEDITrans/HETS-270-271

### 3. Hybrid Approach (RECOMMENDED)
Implement a semi-automated workflow:

```javascript
// In agentServiceV4.js - Modified workflow
async function lookupPatientBySSN(params) {
  // 1. Check if we have MBI in our database already
  const existing = await checkExistingMBI(params.ssn);
  if (existing) return existing;
  
  // 2. Prompt staff to look up MBI manually
  return {
    requiresManualLookup: true,
    instructions: `Please look up MBI for patient:
      1. Go to your MAC portal (link provided based on state)
      2. Enter SSN: ${params.ssn.slice(-4)}
      3. Copy the MBI and enter it below`,
    macPortalUrl: getMACPortalByState(params.state)
  };
}
```

### 4. Cost-Effective Integration Options

#### ClearDATA ($100-200/month)
- Healthcare API aggregator
- Includes eligibility checks with MBI
- More affordable than Stedi

#### Eligible API ($150/month starter)
- https://eligible.com/
- Real-time eligibility with MBI
- Better pricing for small practices

#### Change Healthcare ($200-300/month)
- Enterprise solution but has small practice plans
- Includes full eligibility suite

### 5. Build Your Own MAC Scraper (Technical Option)
Create automated scrapers for MAC portals:
- Use Playwright to automate the manual lookup
- Store credentials securely
- Cache results to minimize lookups
- **Legal Note**: Check MAC terms of service

## Recommended Approach for IntelliCare

### Phase 1: Manual MAC Lookup (FREE - Immediate)
1. Train staff on MAC portal usage
2. Add MAC portal links to the interface
3. Manual copy-paste of MBI
4. Cache all MBIs for future use

### Phase 2: Semi-Automation ($0 - 3 months)
1. Build MAC portal integration using Playwright
2. Automate the lookup process
3. Still free, just development time

### Phase 3: Paid API (When volume justifies)
1. When reaching 500+ patients/month
2. Consider Eligible API or ClearDATA
3. Stedi only if needing 1,500+ lookups/month

## Implementation Code for Manual Lookup

```javascript
// Add to agentServiceV4.js
getMACPortalByState(state) {
  const macPortals = {
    // Noridian states
    'CA': 'https://med.noridianmedicare.com/web/jeb/provider-login',
    'NV': 'https://med.noridianmedicare.com/web/jeb/provider-login',
    'AZ': 'https://med.noridianmedicare.com/web/jfb/provider-login',
    // ... add all states
    
    // Palmetto states  
    'NC': 'https://www.palmettogba.com/palmetto/providers.nsf',
    'SC': 'https://www.palmettogba.com/palmetto/providers.nsf',
    // ... etc
  };
  
  return macPortals[state] || 'https://www.cms.gov/Medicare/';
}

// Modified patient creation flow
async function createPatientWithManualMBI() {
  return {
    message: "Please obtain MBI from MAC portal",
    portal: getMACPortalByState(clinicState),
    instructions: [
      "1. Click the link above to open your MAC portal",
      "2. Log in with your provider credentials",
      "3. Navigate to MBI Lookup tool",
      "4. Enter patient SSN",
      "5. Copy the MBI shown",
      "6. Paste it here"
    ],
    waitingForMBI: true
  };
}
```

## Bottom Line
- **Don't pay $500/month** unless you're doing 1,500+ lookups
- Start with FREE MAC portal manual lookups
- Automate with Playwright when volume increases
- Consider cheaper alternatives like Eligible API
- Cache every MBI to avoid repeat lookups

## Next Steps
1. Identify your MAC region
2. Register for FREE MAC portal access
3. Train staff on manual MBI lookup
4. Implement MBI caching in database
5. Consider automation only when manual becomes burden