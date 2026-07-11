# Implementation Order + Task Dependencies

**Date:** 2026-02-18
**Total tasks:** 7
**Estimated new files:** ~12
**Estimated modified files:** ~15

---

## Dependency Graph

```
Task 1: ElevenLabs STT Service (foundation)
  │
  ├── Task 2: Visit Recording Route (needs STT service)
  │     │
  │     ├── Task 3: Agent Integration (needs routes)
  │     │
  │     ├── Task 4: Mic Button + Audio Capture (needs WebSocket endpoint)
  │     │     │
  │     │     └── Task 5: Live Transcript + Review Panel (needs mic button)
  │     │
  │     └── Task 7: Collection Wiring + Template (needs model)
  │
  └── Task 6: Autocomplete (independent, needs only patient context)
```

---

## Recommended Order

### Phase 1: Backend Foundation (Tasks 1-2)
1. **Task 1:** ElevenLabs STT Service — install SDK, create service, test connection
2. **Task 2:** Visit Recording Route — WebSocket endpoint, REST API, PatientVisit model

### Phase 2: Frontend Core (Tasks 4-5)
3. **Task 4:** Mic Button + Audio Capture — getUserMedia, WebSocket client, consent flow
4. **Task 5:** Live Transcript + Review Panel — display transcripts, editable SOAP note

### Phase 3: Integration (Tasks 3, 7)
5. **Task 3:** Agent Integration — wire tools to agent, keyword groups
6. **Task 7:** Collection Wiring + Template — artifact panel display, PDF, 6-file pattern

### Phase 4: Enhancement (Task 6)
7. **Task 6:** Autocomplete — can be built anytime, independent of recording

---

## Key Files Summary

### New Files (~12)
| File | Task | Purpose |
|------|------|---------|
| `services/elevenLabsSttService.js` | 1 | ElevenLabs WebSocket manager |
| `models/PatientVisit.js` | 1 | Mongoose model |
| `routes/visitRecording.js` | 2 | WebSocket + REST endpoints |
| `components/chat/VoiceRecordingButton.jsx` | 4 | Mic button component |
| `components/chat/VoiceRecordingButton.css` | 4 | Mic button styles |
| `components/chat/LiveTranscriptCard.jsx` | 5 | Live transcript display |
| `components/chat/LiveTranscriptCard.css` | 5 | Transcript styles |
| `hooks/useAutocomplete.js` | 6 | Autocomplete hook |
| `routes/autocomplete.js` | 6 | Autocomplete API |
| `templates/PatientVisitDocument.jsx` | 7 | Visit display template |
| `templates/PatientVisitDocument.css` | 7 | Visit template styles |
| `pdf-templates/PatientVisitDocumentPDFTemplate.jsx` | 7 | Visit PDF |

### Modified Files (~15)
| File | Task(s) | Changes |
|------|---------|---------|
| `masterServiceLoader.js` | 1 | Register elevenLabsSttService |
| `routeLoaderService.js` | 2, 6 | Register visit + autocomplete routes |
| `secureDataAccess.js` | 2 | skipSoftDelete + systemServices |
| `server.js` | 2 | WebSocket upgrade handler |
| `aiHelpers.js` | 3 | Tool descriptions for visit recording |
| `agentServiceV4.js` | 3 | Case handlers for visit tools |
| `agentCapabilityManager.js` | 3 | visitRecording category |
| `claudeMedicalFunctionGroups.js` | 3 | Visit keywords |
| `MessageInput.js` | 4, 6 | Mic button + autocomplete ghost text |
| `ChatContainer.js` | 4, 5 | Recording state, live transcript, WebSocket |
| `ArtifactPanel.jsx` | 5, 7 | Visit review + DOCUMENT_VIEW_COLLECTIONS |
| `AIDocumentRenderer.jsx` | 7 | Lazy import + TEMPLATE_PATTERNS |
| `DocumentDetailView.jsx` | 7 | AI_COLLECTIONS |
| `medicalCollectionsService.js` | 7 | allCollections |
| `optimizedMedicalFunctions.js` | 7 | functionCollectionMap |

---

## NPM Dependencies to Install

```bash
cd apps/backend-api
npm install @elevenlabs/client   # ElevenLabs SDK
npm install ws                   # WebSocket library (if not already present)
```

---

## Environment Variables / KMS Keys

| Key | Storage | Purpose |
|-----|---------|---------|
| `elevenlabs_api_key` | productionKMS | ElevenLabs API authentication |

---

## Testing Strategy

### Manual Testing Sequence
1. Start backend, verify elevenLabsSttService initializes
2. Test WebSocket connection to `/ws/visit-recording` (use wscat or Postman)
3. Test mic button appears in chat UI
4. Test full recording flow: mic → record → transcript → end → summary → approve
5. Test voice chat mode: mic → speak → text appears in chat input
6. Test autocomplete: type slowly, see ghost text predictions
7. Test visit history: view approved visits in artifact panel
8. Test audio playback: play recording from visit detail view

### Edge Cases
- Microphone not available (show error message)
- Network disconnect during recording (save what we have)
- ElevenLabs quota exceeded (graceful error)
- Very long visit (30+ minutes, test memory/performance)
- Multiple browser tabs (only one recording at a time)
- Browser tab closed during recording (cleanup)
