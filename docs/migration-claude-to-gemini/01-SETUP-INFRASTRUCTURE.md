# Task 01: Infrastructure Setup

**Goal:** Prepare the environment and dependencies for Google Gemini integration.

## Steps

1.  **Install Google Generative AI SDK**
    *   Add the dependency to `apps/backend-api/package.json`.
    *   Command: `npm install @google/generative-ai`

2.  **Environment Configuration**
    *   Obtain a Google AI Studio API Key.
    *   Add `GOOGLE_API_KEY` to the `.env` file (local development).
    *   Add `GEMINI_API_KEY` as an alias if preferred for clarity.

3.  **KMS Integration**
    *   Update `apps/backend-api/services/productionKMS.js`.
    *   Add `GOOGLE_API_KEY` to the `externalKeysInEnv` array or the encrypted key storage logic.
    *   Ensure the `secureConfigService.js` can retrieve this key.

4.  **Feature Flagging**
    *   Add a feature flag `AI_PROVIDER` to `config/default.json` or environment variables.
    *   Values: `'claude'` (default), `'gemini'`.
    *   This allows switching back and forth during the transition.

## Validation
*   Create a simple test script `scripts/test-gemini-connection.js` to verify the API key works and can generate a simple text response.
