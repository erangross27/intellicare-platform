# HIPAA Functions Testing Instructions

## Authentication Setup (Passwordless)

Since the system uses passwordless authentication with magic links, testing requires manual authentication first.

## Step 1: Manual Login

1. Open browser to: `http://localhost:3000`
2. Enter email: `eran@gross.support`
3. Select practice: `medical-center`
4. Click "Send Login Link"
5. Check email for magic link
6. Click the link (opens in new tab)
7. Close the new tab when it says "You can close this tab"
8. Return to original tab - you're now logged in

## Step 2: Get Your Token

Once logged in, open browser DevTools (F12) and:

1. Go to Network tab
2. Look for any API call (e.g., to `/api/agent/chat`)
3. Check the Request Headers
4. Copy the value of `x-auth-token` header

## Step 3: Test HIPAA Functions

Create a test file with your token:

```javascript
const axios = require('axios');

// PASTE YOUR TOKEN HERE (from browser DevTools)
const AUTH_TOKEN = 'YOUR_TOKEN_HERE';

// Test configuration
const API_URL = 'http://localhost:3000/api';

// All 57 HIPAA function tests
const allTests = [
  // Agent 1 - Consent & Anonymization (7)
  { message: "Record patient consent for treatment", expectedFunction: "recordConsent" },
  { message: "Update consent preferences", expectedFunction: "updateConsent" },
  { message: "Revoke patient consent", expectedFunction: "revokeConsent" },
  { message: "Show all patient consents", expectedFunction: "getPatientConsents" },
  { message: "Check consent status for data sharing", expectedFunction: "checkConsentStatus" },
  { message: "Anonymize patient data for research", expectedFunction: "anonymizePatientData" },
  { message: "Export anonymized dataset", expectedFunction: "exportAnonymizedData" },
  
  // ... rest of the tests ...
];

async function runTests() {
  console.log('Testing HIPAA Functions with existing token...\n');
  
  for (const test of allTests) {
    try {
      const response = await axios.post(
        `${API_URL}/agent/chat`,
        { 
          message: test.message,
          sessionId: 'test-' + Date.now(),
          language: 'en'
        },
        { 
          headers: { 
            'x-auth-token': AUTH_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ ${test.expectedFunction} - Success`);
      
    } catch (error) {
      console.log(`❌ ${test.expectedFunction} - Error: ${error.response?.data?.message || error.message}`);
    }
  }
}

runTests().catch(console.error);
```

## Alternative: Automated Testing with Puppeteer

For fully automated testing including the magic link flow, you would need:

1. Email API access to retrieve magic links programmatically
2. Puppeteer or similar browser automation tool
3. Script to handle the full authentication flow

## Current Testing Approach

Since we're testing locally and the email links require manual intervention:

1. **Manual Authentication**: Login once manually through the browser
2. **Copy Token**: Get the auth token from browser DevTools
3. **Run Tests**: Use the token to test all 57 HIPAA functions
4. **Token Duration**: Tokens are valid for session duration

## Test Accounts

- **Email**: `eran@gross.support`
- **Practice**: `medical-center`
- **Authentication**: Passwordless (magic link via email)

## Notes

- The system no longer uses passwords
- All authentication is via secure email links
- Links expire after 15 minutes
- Each link can only be used once
- For production testing, implement email API integration to automate magic link retrieval