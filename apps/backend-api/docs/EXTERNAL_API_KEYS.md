# External API Keys Configuration

## Overview
This document explains how external API keys are managed in the IntelliCare system using the Production KMS (Key Management Service).

## Current Status

### ✅ Configured APIs
1. **Blue Button 2.0 (CMS Medicare)**
   - Client ID: `<REDACTED>`
   - Client Secret: Stored securely in KMS
   - Status: ✅ Active
   - Purpose: Access Medicare beneficiary data via OAuth 2.0

### ⚠️ Optional APIs
2. **OpenFDA API**
   - Status: ⚠️ No key configured (using public access)
   - Rate Limits WITHOUT key: 240 req/min, 120,000 req/day
   - Rate Limits WITH key: 240 req/min, 240,000 req/day
   - Register at: https://open.fda.gov/apis/authentication/
   - Note: The API works without a key but with lower daily limits

3. **PubMed E-utilities**
   - Status: ⚠️ Not configured
   - Rate Limits WITHOUT key: 3 req/sec
   - Rate Limits WITH key: 10 req/sec
   - Register at: https://www.ncbi.nlm.nih.gov/account/

4. **Better Doctor API**
   - Status: ⚠️ Not configured
   - Note: Commercial API, requires paid subscription

5. **Google Healthcare API**
   - Status: ⚠️ Not configured
   - Note: Requires Google Cloud project setup

## How to Add/Update API Keys

### Using the Storage Script
1. Edit `store-external-api-keys.js`
2. Add your API key value to the `externalApiKeys` object
3. Run: `node store-external-api-keys.js`

Example:
```javascript
const externalApiKeys = {
  'OPENFDA_API_KEY': 'your-api-key-here',
  'PUBMED_API_KEY': 'your-api-key-here'
};
```

### Verification
Run the verification script to check which keys are configured:
```bash
node verify-external-api-keys.js
```

Output example:
```
✅ BLUE_BUTTON_CLIENT_ID: <REDACTED>
✅ BLUE_BUTTON_CLIENT_SECRET: <REDACTED>
❌ OPENFDA_API_KEY: NOT FOUND
```

## How Keys are Used

### BlueButtonOAuthService
```javascript
// Automatically loads from KMS on initialization
this.clientId = await productionKMS.getInternalKey('BLUE_BUTTON_CLIENT_ID');
this.clientSecret = await productionKMS.getInternalKey('BLUE_BUTTON_CLIENT_SECRET');
```

### ExternalApiGatewayService
```javascript
// Loads all external API keys on initialization
await this.loadApiKeys();

// Uses keys when making requests to external APIs
const apiKey = this.apiConfigs.get('OPENFDA_API_KEY');
```

### DrugInformationService
```javascript
// Uses ExternalApiGatewayService for FDA drug information
const recalls = await externalApiGateway.makeRequest(
  'openFDA',
  '/drug/enforcement.json',
  { search: 'report_date:[2024-01-01 TO 2025-12-31]' }
);
```

## Security Features

### Encryption
- All API keys are encrypted using AES-256-GCM
- Master key is derived from machine-specific data
- Each key has a unique initialization vector (IV)

### Storage Location
- Keys are stored in: `apps/backend-api/.kms/keys/`
- Each key is stored as a separate encrypted JSON file
- Example: `BLUE_BUTTON_CLIENT_ID.json`

### Access Control
- Keys are only accessible through the productionKMS service
- No plaintext keys in environment variables
- No keys in version control

## Troubleshooting

### Warning: "No API key found for openFDA"
This is normal if you haven't configured the openFDA API key. The API will work with lower rate limits (120k requests/day instead of 240k).

### Error: "Blue Button OAuth not configured"
Run `node verify-external-api-keys.js` to check if the keys are present. If missing, run `node store-external-api-keys.js` to add them.

### Keys not loading after adding
1. Verify keys are in `.kms/keys/` directory
2. Check file permissions (should be readable by backend user)
3. Restart the backend server: `npm run dev`

## Related Services

- **productionKMS.js** - Core KMS implementation
- **externalApiGatewayService.js** - Unified gateway for external APIs
- **blueButtonOAuthService.js** - Blue Button OAuth 2.0 flow
- **drugInformationService.js** - FDA drug information and safety alerts

## API Documentation

### Blue Button 2.0
- Production: https://api.bluebutton.cms.gov/
- Sandbox: https://sandbox.bluebutton.cms.gov/
- Docs: https://bluebutton.cms.gov/developers/

### OpenFDA
- Base URL: https://api.fda.gov
- Docs: https://open.fda.gov/apis/

### PubMed E-utilities
- Base URL: https://eutils.ncbi.nlm.nih.gov/entrez/eutils
- Docs: https://www.ncbi.nlm.nih.gov/books/NBK25501/

## Notes

- The openFDA key is optional - the service will work without it
- Blue Button credentials are required for Medicare data access
- All other external APIs are optional based on feature requirements
- Consider registering for API keys when you need higher rate limits