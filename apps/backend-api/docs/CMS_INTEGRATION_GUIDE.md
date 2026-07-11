# CMS Blue Button 2.0 REAL Implementation Guide

## Step 1: Register for CMS Developer Account

1. Go to: https://sandbox.bluebutton.cms.gov/
2. Click "Sign Up" to create a developer account
3. You'll receive credentials for the SANDBOX environment

## Step 2: Create Your Application

Once logged in to the sandbox:
1. Go to "My Applications"
2. Click "Register New Application"
3. Fill in:
   - Application Name: "IntelliCare Health"
   - Redirect URIs: 
     - http://localhost:5000/api/cms/callback
     - https://intellicare.health/api/cms/callback
   - Application Type: "Confidential"
   - Grant Type: "Authorization Code"

4. You'll receive:
   - Client ID: (like "3PeD8gAIr8iUwl0hF3hJkL6WvgVzMvCqdrEG8Bva")
   - Client Secret: (keep this secure!)

## Step 3: Store Credentials in KMS

```bash
# Store the credentials in our KMS
cd backend
node -e "
const kms = require('./services/productionKMS');
(async () => {
  await kms.storeInternalKey('BLUE_BUTTON_CLIENT_ID', 'YOUR_CLIENT_ID_HERE');
  await kms.storeInternalKey('BLUE_BUTTON_CLIENT_SECRET', 'YOUR_CLIENT_SECRET_HERE');
  console.log('✅ Credentials stored');
})();
"
```

## Step 4: Test Data Available in Sandbox

The CMS sandbox has synthetic beneficiaries you can test with:

### Test Beneficiaries (Login Credentials):
- Username: BBUser00000
- Password: PW00000!

(Numbers go from 00000 to 30000)

### What Data You Get:

1. **Patient Demographics**:
   - Full name
   - Date of birth
   - Gender
   - Race/Ethnicity
   - Address (street, city, state, ZIP)
   - Phone number (if available)
   - Medicare Beneficiary ID (MBI)

2. **Coverage Information**:
   - Medicare Part A effective date
   - Medicare Part B effective date
   - Medicare Part D (prescription) plans
   - Medicare Advantage (Part C) enrollment

3. **Claims Data**:
   - Inpatient claims
   - Outpatient claims
   - Carrier claims (doctor visits)
   - DME (Durable Medical Equipment) claims
   - Prescription drug events (Part D)

4. **Clinical Data from Claims**:
   - Diagnosis codes (ICD-10)
   - Procedure codes (CPT/HCPCS)
   - Provider NPIs
   - Dates of service
   - Claim amounts

## Step 5: OAuth 2.0 Flow

The user must authorize access to their Medicare data:

1. Redirect user to:
   ```
   https://sandbox.bluebutton.cms.gov/v2/o/authorize/?
     client_id=YOUR_CLIENT_ID&
     redirect_uri=YOUR_REDIRECT_URI&
     response_type=code&
     state=random_state_string
   ```

2. User logs in with Medicare credentials
3. User approves data sharing
4. CMS redirects back with authorization code
5. Exchange code for access token

## Step 6: API Endpoints

### Get Patient Demographics:
```
GET https://sandbox.bluebutton.cms.gov/v2/fhir/Patient/[patient_id]
Authorization: Bearer [access_token]
```

### Get Coverage:
```
GET https://sandbox.bluebutton.cms.gov/v2/fhir/Coverage?patient=[patient_id]
Authorization: Bearer [access_token]
```

### Get Claims (EOB):
```
GET https://sandbox.bluebutton.cms.gov/v2/fhir/ExplanationOfBenefit?patient=[patient_id]
Authorization: Bearer [access_token]
```

## IMPORTANT LIMITATIONS:

1. **No SSN to MBI Lookup**: CMS does NOT provide an API to convert SSN to MBI
2. **User Must Login**: The beneficiary must log in with their Medicare.gov credentials
3. **Not All Beneficiaries**: Only works for Medicare beneficiaries (65+ or disabled)
4. **No Real-Time Eligibility**: This is claims data, not real-time eligibility

## Alternative for SSN Lookup:

Since CMS doesn't provide SSN to MBI lookup, you need:

1. **Medicare Administrative Contractor (MAC) Access**:
   - Providers can use MAC portals
   - Requires provider enrollment
   - Manual process, not API

2. **Commercial Services**:
   - Availity
   - Change Healthcare
   - Optum
   - Stedi
   These require separate contracts and fees

3. **Direct from Patient**:
   - Ask patient for their Medicare card
   - MBI is printed on the card

## To Actually Implement:

1. Register at https://sandbox.bluebutton.cms.gov/
2. Get your Client ID and Secret
3. Store them in KMS
4. Implement OAuth flow
5. Test with synthetic beneficiaries

The REAL workflow would be:
1. Patient logs into Medicare.gov through your app
2. Patient authorizes data sharing
3. You get their MBI and demographics
4. You can then retrieve all their Medicare data

This is the ACTUAL implementation - no mocks!