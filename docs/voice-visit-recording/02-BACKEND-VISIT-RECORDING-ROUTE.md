# Task 2: Visit Recording WebSocket Route + REST API

**Priority:** HIGH — Connects frontend to ElevenLabs via backend proxy
**Estimated files:** 1 new, 3 modified
**Dependencies:** Task 1 (elevenLabsSttService)

---

## What to Build

A WebSocket endpoint for real-time audio streaming and REST endpoints for visit management (start, end, approve, get history).

---

## Files to Create

### 1. `apps/backend-api/routes/visitRecording.js`

**WebSocket endpoint:** `/ws/visit-recording`

**Connection flow:**
1. Client connects with auth token + patientId + mode ("visit" | "voiceChat")
2. Server authenticates user (same JWT validation as existing routes)
3. Server creates ElevenLabs realtime session via `elevenLabsSttService`
4. Client sends audio chunks → server base64-encodes → forwards to ElevenLabs
5. ElevenLabs transcripts → server broadcasts back to client via WebSocket
6. On disconnect or "end" message → close ElevenLabs session, finalize

**WebSocket message protocol (client → server):**
```javascript
// Start recording
{ type: "start", patientId: "...", mode: "visit" | "voiceChat" }

// Audio chunk
{ type: "audio", data: "<base64 PCM 16kHz>" }

// End recording
{ type: "end" }

// Manual commit (for manual commit strategy)
{ type: "commit" }
```

**WebSocket message protocol (server → client):**
```javascript
// Transcription started
{ type: "session_started", sessionId: "..." }

// Partial transcript (interim, may change)
{ type: "partial", text: "the patient reports ch..." }

// Committed transcript (final, won't change)
{ type: "committed", text: "The patient reports chest pain.", speaker: "patient", timestamp: 12.5 }

// Visit ended, processing
{ type: "processing", message: "Generating visit summary..." }

// AI summary ready
{ type: "summary_ready", visitId: "...", summary: { chiefComplaint, hpi, ros, pe, assessment, plan, medications, followUp } }

// Error
{ type: "error", code: "...", message: "..." }
```

**REST endpoints (same file):**

```
POST   /api/visits/start          — Start a new visit (returns visitId)
POST   /api/visits/:id/end        — End recording, trigger AI summarization
PUT    /api/visits/:id/approve    — Doctor approves the visit note
PUT    /api/visits/:id/edit       — Doctor edits AI summary fields
GET    /api/visits/:id            — Get single visit (transcript + summary, NO audio)
GET    /api/visits/:id/audio      — Stream decrypted audio for playback
GET    /api/visits/patient/:pid   — Get visit history for a patient
DELETE /api/visits/:id            — Soft-delete a visit
```

**Audio playback endpoint (`GET /api/visits/:id/audio`):**
- Decrypt audio from MongoDB using `e2eEncryptionService.decryptWithServiceKey()`
- Stream as audio response with proper Content-Type header
- `buffer.fill(0)` after streaming (same pattern as medical images)
- RBAC check: only the visit doctor + practice admins can access

---

## Files to Modify

### 2. `apps/backend-api/services/routeLoaderService.js`

Register the new route:
```javascript
{ path: '/api/visits', file: './routes/visitRecording', auth: 'inline' }
```

### 3. `apps/backend-api/services/secureDataAccess.js`

- Add `patient_visits` to BOTH `skipSoftDelete` arrays
- Add `visit-recording-service` to `systemServices` whitelist

### 4. `apps/backend-api/server.js` (or WebSocket setup file)

Register WebSocket upgrade handler for `/ws/visit-recording`:
- Check how existing Socket.IO is set up
- May need to use `ws` library alongside existing Socket.IO
- Upgrade handling on the HTTP server

---

## AI Summarization Flow (triggered on visit end)

When doctor clicks "End Visit":
1. Collect full transcript from all committed segments
2. Build Claude prompt with:
   - Full transcript text
   - Speaker labels (doctor vs patient)
   - Patient context (relevant medical history from MongoDB)
3. Call Claude Opus 4.6 with structured output request:
   ```
   System: You are a medical scribe. Structure this doctor-patient encounter transcript into a SOAP note.

   Patient: [name], [age], [relevant history]
   Transcript: [full verbatim transcript with speaker labels]

   Return JSON with: chiefComplaint, historyOfPresentIllness, reviewOfSystems,
   physicalExamination, assessment, plan, medications, followUp
   ```
4. Save AI summary to `patient_visits.aiSummary`
5. Send `summary_ready` WebSocket message to frontend
6. Encrypt audio + save to `patient_visits.audioRecording`

---

## Verification

- [ ] WebSocket connection establishes with valid auth token
- [ ] Audio chunks flow: client → backend → ElevenLabs → transcripts back
- [ ] Partial transcripts stream to client in real-time
- [ ] "End Visit" triggers Claude summarization
- [ ] Summary saved to MongoDB with encrypted audio
- [ ] REST endpoints work: start, end, approve, edit, get, list
- [ ] Audio playback endpoint streams decrypted audio
- [ ] RBAC: unauthorized users cannot access visits
- [ ] Error handling: ElevenLabs disconnect, network issues, quota exceeded
