# Task 1: ElevenLabs Speech-to-Text Service

**Priority:** HIGH — Foundation for all voice features
**Estimated files:** 3 new, 2 modified
**Dependencies:** None (first task)

---

## What to Build

A backend service that manages WebSocket connections to ElevenLabs Scribe v2 Realtime API. This is the core transcription engine.

---

## Files to Create

### 1. `apps/backend-api/services/elevenLabsSttService.js`

**Purpose:** Manages WebSocket connections to ElevenLabs, handles audio streaming and transcript receiving.

**Key functionality:**
- `initialize()` — get API key from `productionKMS.getInternalKey('elevenlabs_api_key')`
- `createRealtimeSession(options)` — opens WebSocket to ElevenLabs
  - URL: `wss://api.elevenlabs.io/v1/speech-to-text/realtime`
  - Query params: `model_id=scribe-1`, `audio_format=pcm_16000`, `commit_strategy=vad`, `include_timestamps=true`, `enable_logging=false`
  - Auth: `xi-api-key` header
  - Returns session object with `sendAudio(base64Chunk)`, `commit()`, `close()`, `on(event, callback)`
- `transcribeBatch(audioBuffer, options)` — batch transcription via REST API (fallback/post-processing)
  - POST to `https://api.elevenlabs.io/v1/speech-to-text`
  - Multipart form upload
- Session lifecycle management (max duration, reconnection, error handling)
- Emit events: `partial_transcript`, `committed_transcript`, `session_started`, `error`

**Pattern to follow:** Similar to how `claudeMedicalImageService.js` manages Claude API — initialize with KMS key, service account auth, structured methods.

**ElevenLabs WebSocket message handling:**
```javascript
// Receive from ElevenLabs
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  switch (msg.message_type) {
    case 'session_started': emit('session_started', msg); break;
    case 'partial_transcript': emit('partial', { text: msg.text }); break;
    case 'committed_transcript': emit('committed', { text: msg.text }); break;
    case 'committed_transcript_with_timestamps':
      emit('committed', { text: msg.text, words: msg.words, language: msg.language_code });
      break;
    case 'auth_error': case 'quota_exceeded': case 'rate_limited':
      emit('error', { type: msg.message_type, error: msg.error });
      break;
  }
});
```

### 2. `apps/backend-api/models/PatientVisit.js`

**Purpose:** Mongoose model for the `patient_visits` collection.

**Schema:** See `00-DESIGN.md` Data Model section for complete schema.

**Important:**
- `audioRecording.encryptedContent` is Buffer type
- Add indexes for patientId+practiceId, patientId+visitDate, status
- Add to `skipSoftDelete` arrays in `secureDataAccess.js`

### 3. Install `@elevenlabs/client` npm package

```bash
cd apps/backend-api && npm install @elevenlabs/client
```

Note: May also need `ws` package if not already installed (check package.json).

---

## Files to Modify

### 4. `apps/backend-api/services/masterServiceLoader.js`

Add to service loading:
- `servicePaths`: `'elevenLabsSttService': './elevenLabsSttService'`
- `loadPhases` AI phase: `'elevenLabsSttService'`
- `needsInitialization`: `'elevenLabsSttService'`

### 5. `apps/backend-api/.env` (or KMS)

Add ElevenLabs API key:
- Key name: `elevenlabs_api_key`
- Store via `productionKMS` (same pattern as `anthropic_api_key`)

---

## Verification

- [ ] Service initializes without errors on server start
- [ ] Can create a realtime session (WebSocket connects to ElevenLabs)
- [ ] Can send a test audio chunk and receive partial transcript
- [ ] Can close session cleanly
- [ ] Error handling for auth failures, quota exceeded, rate limits
- [ ] API key loaded from KMS (not hardcoded)
