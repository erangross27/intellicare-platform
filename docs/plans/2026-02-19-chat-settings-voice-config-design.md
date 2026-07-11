# Chat Profile Settings with ElevenLabs Voice Configuration

**Date:** 2026-02-19
**Status:** Design Complete

## Goal

Add a profile/settings panel to the chat interface, accessible by clicking the profile avatar in the left sidebar. Includes a "Voice & Speech" tab for ElevenLabs TTS voice selection with all available voices and models.

## Architecture

```
Frontend                          Backend                         ElevenLabs
---------                         -------                         ----------
Profile avatar click
  → opens UserSettings modal
  → "Voice & Speech" tab

GET /api/tts/voices ----------→ client.voices.search() ------→ GET /v2/voices
  ← voice list (cached 1hr)      ← cached in memory

GET /api/tts/models ----------→ client.models.list() --------→ GET /v1/models
  ← model list (cached 1hr)      ← cached in memory

Preview button click
  POST /api/tts/speak --------→ streamSpeech(text, res,
  { text, voiceId }               { voiceId }) ----------------→ TTS API

Save preferences
  PUT /user/settings ---------→ Save to user document
  { ttsVoiceId, ttsModelId }    in MongoDB
```

## Backend Changes

### 1. elevenLabsTtsService.js — New methods

- `getVoices()` — calls `client.voices.search({ pageSize: 100 })`, caches 1 hour
- `getModels()` — calls `client.models.list()`, filters TTS-capable, caches 1 hour

### 2. textToSpeech.js — New routes + modify existing

- `GET /api/tts/voices` — returns cached voice list (id, name, labels, preview_url)
- `GET /api/tts/models` — returns cached TTS model list (id, name, languages)
- Modify `POST /api/tts/speak` — accept optional `voiceId`, `modelId` from body

### 3. User document — TTS preferences field

```json
{
  "ttsPreferences": {
    "voiceId": "JBFqnCBsd6RMkjVDRZzb",
    "modelId": "eleven_turbo_v2_5",
    "enabled": true
  }
}
```

## Frontend Changes

### 1. CollapsibleSidebar.js + MinimalSidebar.js

Wire profile avatar onClick → open UserSettings modal (pass user info)

### 2. UserSettings.js — New "Voice & Speech" tab

- TTS enable/disable toggle
- Model selector dropdown (turbo vs multilingual)
- Voice browser with search + gender filter
- Voice cards: name, accent, gender, age, preview play button
- Selected voice highlighted with radio button
- Save button

### 3. ChatContainer.js

- Import and render UserSettings modal
- Load user TTS preferences on mount
- Pass voiceId to speakResponse

### 4. useVoiceMode.js

- Accept voiceId/modelId parameters in speakResponse
- Forward to POST /api/tts/speak body

## Implementation Order

1. Backend: Add getVoices() + getModels() to elevenLabsTtsService.js
2. Backend: Add GET /api/tts/voices + GET /api/tts/models routes
3. Backend: Modify POST /api/tts/speak to accept voiceId/modelId
4. Frontend: Wire profile avatar → UserSettings modal
5. Frontend: Add "Voice & Speech" tab to UserSettings
6. Frontend: Load preferences + pass voiceId through to TTS
7. Test end-to-end: select voice → preview → save → use in chat
