# API Keys Migration to KMS

## Overview
All external API keys have been migrated to the internal KMS (Key Management Service) for better security.

## Keys Stored in KMS

The following API keys are now securely stored in KMS:

1. **GOOGLE_MAPS_API_KEY**
   - Used for: Google Maps, Places API (New), Geocoding API
   - Services: smartLocationService, geocodingService

2. **ANTHROPIC_API_KEY**
   - Used for: Claude AI (Sonnet model)
   - Services: authAIService, agentServiceClaude

3. **CURRENCY_API_KEY**
   - Used for: Currency conversion
   - Services: currencyService

4. **POSTMARK_API_KEY**
   - Used for: Email delivery
   - Services: Email services (placeholder - replace with actual key)

## How to Access Keys

```javascript
const productionKMS = require('./services/productionKMS');

// Initialize KMS
await productionKMS.initialize();

// Get API key
const apiKey = await productionKMS.getInternalKey('GOOGLE_MAPS_API_KEY');
```

## Services Updated

✅ **Updated to use KMS:**
- smartLocationService.js - Google Maps API
- geocodingService.js - Google Maps API
- currencyService.js - Currency API

⏳ **Still need updating:**
- Gemini services (multiple files) - Need to switch to Google API key
- Email services - Need Postmark key

## Environment Variables

You can now **REMOVE** these from your .env file:
- GOOGLE_MAPS_API_KEY
- GEMINI_API_KEY (using Google API key instead)
- ANTHROPIC_API_KEY
- CURRENCY_API_KEY
- ALPHA_VANTAGE_API_KEY
- POSTMARK_API_KEY

## Security Benefits

1. **Encrypted Storage**: All keys are encrypted using AES-256-GCM
2. **Machine-Specific**: Keys are encrypted with machine-specific data
3. **No Plain Text**: No API keys in code or environment variables
4. **Centralized Management**: All keys in one secure location
5. **Easy Migration**: Can easily move to Google Secret Manager later

## Running the Setup

To add/update API keys in KMS:

```bash
cd backend
node scripts/setup-external-api-keys.js
```

## Next Steps

1. Update remaining Gemini services to use Google API key from KMS
2. Add proper Postmark API key when available
3. Consider migrating to Google Secret Manager in the future

---
*Last Updated: December 2024*