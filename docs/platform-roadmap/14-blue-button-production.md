# Task 14: Activate Blue Button 2.0 Production

## Priority: HIGH
## Category: Phase 3 - Enhance Existing Integrations
## Dependencies: None
## Cost: FREE (CMS application approval)
## Status: SANDBOX ACTIVE (Feb 10, 2026) — Production pending CMS approval

## Current State

### Sandbox: OPERATIONAL
- **Credentials**: Client ID + Client Secret stored in KMS (AES-256-GCM encrypted)
- **KMS Keys**: `BLUE_BUTTON_CLIENT_ID`, `BLUE_BUTTON_CLIENT_SECRET` — verified Feb 10, 2026
- **Endpoints**: `https://sandbox.bluebutton.cms.gov/v2/`
- **Service**: `apps/backend-api/services/blueButtonOAuthService.js` — reads credentials from KMS at initialization
- **Environment toggle**: Automatic — uses sandbox when `NODE_ENV !== 'production'`

### What's Working (Sandbox)
- OAuth 2.0 full flow: authorize → code exchange → token → refresh
- FHIR data retrieval: Patient demographics, Coverage, Claims (EOB)
- CSRF protection with state parameter verification
- Encrypted token storage via encryptionService (PHI level)
- Service authentication via serviceAccountManager

## Background

IntelliCare has a COMPLETE Blue Button 2.0 OAuth implementation with sandbox credentials active. This is the CMS API that lets Medicare beneficiaries share their claims data (Part A, B, D), coverage information, and demographics with apps. Moving to production is a matter of applying to CMS - no business ID or payment required for individual developers.

## What Already Exists

### blueButtonOAuthService.js
Location: `apps/backend-api/services/blueButtonOAuthService.js`

Fully implemented:
- OAuth 2.0 authorization flow (authorize → token exchange → refresh)
- `getAuthorizationUrl()` - Generates consent URL for patient
- `exchangeCodeForToken(code)` - Gets access token
- `getUserInfo(accessToken)` - User profile
- `getPatientDemographics(accessToken)` - FHIR Patient resource
- `getCoverage(accessToken)` - FHIR Coverage resource (insurance details)
- `getClaims(accessToken)` - FHIR ExplanationOfBenefit (claims history)
- `refreshAccessToken(refreshToken)` - Token refresh
- CSRF protection with state parameter
- Secure token storage (encrypted with PHI level)

### Sandbox vs Production
| Feature | Sandbox | Production |
|---------|---------|-----------|
| URL | sandbox.bluebutton.cms.gov | api.bluebutton.cms.gov |
| Data | Synthetic test patients | Real Medicare beneficiaries |
| Credentials | ✅ Active in KMS | Pending CMS approval |
| Registration | ✅ Complete | Application required |

## What Remains for Production

### ~~Step 1: Configure Sandbox Credentials~~ DONE (Feb 10, 2026)
- ~~Store sandbox Client ID + Client Secret in KMS~~
- ✅ Both keys stored and verified via `productionKMS.storeInternalKey()`

### Step 2: Apply for CMS Blue Button Production Access
- Go to https://bluebutton.cms.gov/developers/
- Create a developer account (free, individual)
- Submit production application
- Required info: App name, description, redirect URI, privacy policy URL
- **No business ID needed** - individual developers can apply
- Review takes a few weeks

### Step 3: Set Up Privacy Policy
CMS requires a privacy policy URL. Create a simple page explaining:
- What data is collected (Medicare claims, coverage)
- How it's stored (encrypted, HIPAA-compliant)
- Who has access (patient and their providers)
- How to revoke access

### Step 4: Store Production Credentials
- When CMS approves, store production Client ID + Client Secret in KMS (same pattern as sandbox)
- Environment toggle already in place — production endpoints auto-activate when `NODE_ENV === 'production'`

### Step 5: Create Patient-Facing Consent Flow
Build a simple UI flow:
1. Provider initiates Medicare data import for patient
2. Patient is redirected to Medicare.gov to authorize
3. Patient logs in with their Medicare credentials
4. Data flows back to IntelliCare
5. Claims, coverage, and medications are imported

### Step 6: Add Agent Tools
- `initiateMedicareImport` - "Start Medicare data import for a patient. Patient will be asked to authorize via Medicare.gov"
- `getMedicareClaimsHistory` - "Get imported Medicare claims history for a patient"
- `getMedicareCoverageDetails` - "Get Medicare coverage details (Part A, B, D) for a patient"
- `getMedicareMedicationHistory` - "Get Part D medication history for a patient"

### Step 7: Test
- ✅ Sandbox credentials configured and verified
- Test full OAuth flow with CMS synthetic test patients
- Verify data parsing from FHIR resources
- Test token refresh mechanism

## Files
| File | Status |
|------|--------|
| `apps/backend-api/services/blueButtonOAuthService.js` | ✅ Complete — OAuth service with env toggle |
| `apps/backend-api/.kms/keys/BLUE_BUTTON_CLIENT_ID.json` | ✅ Sandbox credentials stored |
| `apps/backend-api/.kms/keys/BLUE_BUTTON_CLIENT_SECRET.json` | ✅ Sandbox credentials stored |
| `apps/backend-api/services/utils/aiHelpers.js` | Pending — agent tool definitions |
| `apps/backend-api/services/agentServiceV4.js` | Pending — case route handlers |

## Notes
- This gives access to REAL Medicare claims data for ~65 million beneficiaries
- Completely free - CMS wants apps to use this data
- The hardest part is getting CMS approval (takes weeks, not money)
- Once approved, every Medicare patient can import their full claims history
- This is the most valuable free integration for US elderly care
- Sandbox is now fully operational for development and testing
