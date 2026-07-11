# Voice-Enabled Patient Visit Recording System

**Date:** 2026-02-18
**Status:** Design Approved — Ready for Implementation
**Feature:** Voice recording of doctor-patient encounters with AI summarization

---

## Overview

When a doctor tells the IntelliCare agent "I want to record a new visit for patient X", the system starts recording the encounter. Audio streams through our backend to ElevenLabs for real-time transcription. When the visit ends, Claude structures the full transcript into a SOAP note. The doctor reviews, edits, and approves before saving.

A mic button on the chat input row provides two modes:
1. **Record Visit** — full encounter recording with transcription + AI summarization
2. **Voice Chat** — talk to IntelliCare instead of typing (voice-to-text for regular chat)

Additionally, a **full-sentence autocomplete** feature (like GitHub Copilot) predicts what the doctor is typing based on patient context and transcript history.

---

## Design Decisions (All Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| STT Engine | **ElevenLabs Scribe v2 Realtime** | 96.7% accuracy, 150ms latency, speaker diarization, $0.48/hr |
| Architecture | **WebSocket Proxy (Approach A)** | API key stays server-side, full audit trail, HIPAA compliant |
| Audio Storage | **Our MongoDB (AES-256-GCM encrypted)** | Full data ownership, same pattern as medical_images |
| ElevenLabs Retention | **Zero-retention mode** | Audio/transcripts deleted from ElevenLabs after processing |
| Transcription Style | **Live transcription** | Text appears as doctor speaks (150ms latency) |
| Voice Trigger | **Mic button on chat input row** | Next to send button, opens popup with two modes |
| Autocomplete | **Full sentence prediction** | AI predicts rest of sentence based on patient context |
| Review Flow | **Artifact panel** | Editable SOAP sections + "Approve & Save" button |
| Blocked Engines | **NO Google, NO OpenAI** | User policy — closed Google accounts, won't use OpenAI |

---

## Architecture

```
                        FRONTEND                          BACKEND                    EXTERNAL
                   ┌─────────────────┐            ┌────────────────────┐       ┌──────────────┐
                   │  MessageInput   │            │                    │       │              │
                   │  ┌───────────┐  │   WebSocket│  visitRecording    │  WS   │  ElevenLabs  │
Doctor speaks  →   │  │ Mic Button│──┼────────────┼→ Service           ├───────┼→ Scribe v2   │
                   │  └───────────┘  │            │  (WebSocket proxy) │       │  Realtime    │
                   │                 │            │       │            │       │              │
                   │  ChatContainer  │    SSE     │       ▼            │       └──────────────┘
Transcripts    ←   │  (live text)   ◄┼────────────┼─ partial/committed │
                   │                 │            │   transcripts      │
                   │                 │            │       │            │       ┌──────────────┐
                   │  ArtifactPanel  │    API     │       ▼            │       │              │
SOAP review    ←   │  (editable)    ◄┼────────────┼─ Claude Opus 4.6  ├───────┼→ Anthropic   │
                   │                 │            │  (summarize)       │       │  API         │
                   └─────────────────┘            │       │            │       └──────────────┘
                                                  │       ▼            │
                                                  │  MongoDB           │
                                                  │  patient_visits    │
                                                  │  (encrypted)       │
                                                  └────────────────────┘
```

---

## Data Flow

### Recording a Visit

1. Doctor clicks mic button → selects "Record Visit"
2. Frontend prompts for patient name (or detects from chat context)
3. Agent resolves patient name → patientId
4. Frontend starts `getUserMedia()` → PCM audio capture
5. Audio chunks sent via WebSocket to backend `/ws/visit-recording`
6. Backend proxies audio to ElevenLabs WebSocket (zero-retention mode)
7. ElevenLabs returns partial transcripts → backend SSE-streams to frontend
8. Frontend displays live transcript in chat window
9. Doctor clicks "End Visit"
10. Backend sends full transcript to Claude Opus 4.6 for SOAP structuring
11. AI summary displayed in artifact panel for review
12. Doctor edits sections as needed
13. Doctor clicks "Approve & Save"
14. Backend encrypts audio + saves to `patient_visits` collection
15. Confirmation shown in chat

### Voice Chat (Talk to IntelliCare)

1. Doctor clicks mic button → selects "Voice Chat"
2. Audio streams same WebSocket path → ElevenLabs → transcript
3. Transcript text is injected into the chat input as if doctor typed it
4. Normal agent chat flow continues with the transcribed text

---

## Data Model: `patient_visits` Collection

```javascript
{
  // Identity
  _id: ObjectId,
  patientId: ObjectId,           // ref: patients
  practiceId: ObjectId,          // ref: practices
  doctorId: ObjectId,            // ref: users (who conducted the visit)
  chatSessionId: ObjectId,       // ref: chat_sessions (where visit was initiated)

  // Visit metadata
  visitDate: Date,
  visitType: String,             // "in-person", "telehealth", "phone"
  duration: Number,              // seconds
  status: String,                // "recording" | "transcribing" | "reviewing" | "approved" | "amended"

  // Audio recording (encrypted at rest)
  audioRecording: {
    encryptedContent: Buffer,    // AES-256-GCM encrypted audio
    contentIv: String,           // initialization vector
    contentTag: String,          // auth tag
    format: String,              // "webm/opus" or "audio/wav"
    sampleRate: Number,          // 16000
    fileSize: Number,            // bytes
    duration: Number,            // seconds
  },

  // Full verbatim transcript
  transcript: {
    fullText: String,            // complete text, every word
    language: String,            // detected language code
    segments: [{
      text: String,
      start: Number,             // seconds from start
      end: Number,               // seconds from start
      confidence: Number,        // 0-1
      speaker: String,           // "doctor" | "patient" | "unknown"
    }],
  },

  // AI-generated structured note (Claude Opus 4.6)
  aiSummary: {
    chiefComplaint: String,
    historyOfPresentIllness: String,
    reviewOfSystems: String,
    physicalExamination: String,
    assessment: String,
    plan: String,
    medications: String,
    followUp: String,
    modelUsed: String,           // "claude-opus-4-6"
    generatedAt: Date,
  },

  // Doctor's review
  doctorEdits: {                 // tracks what doctor changed
    editedFields: [String],      // which aiSummary fields were modified
    editedAt: Date,
  },
  approvedAt: Date,
  approvedBy: ObjectId,          // ref: users

  // Consent
  consentObtained: Boolean,      // HIPAA requirement
  consentMethod: String,         // "verbal" | "written" | "pre-visit-form"

  // Audit
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId,
  isDeleted: Boolean,
  deletedAt: Date,
}

// Indexes
{ patientId: 1, practiceId: 1 }
{ patientId: 1, visitDate: -1 }
{ practiceId: 1, createdAt: -1 }
{ status: 1 }
{ doctorId: 1, visitDate: -1 }
```

---

## HIPAA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Patient consent | `consentObtained` + `consentMethod` fields; UI consent prompt before recording |
| Encryption at rest | AES-256-GCM via `e2eEncryptionService.encryptWithServiceKey()` |
| Encryption in transit | TLS (HTTPS/WSS) for all connections |
| Access control | SecureDataAccess RBAC — only authorized staff |
| Audit logging | Full audit trail via existing audit system |
| Minimum necessary | Audio excluded from list queries (projection) |
| ElevenLabs | Zero-retention mode — nothing stored after processing |
| Secure deletion | Soft-delete with encrypted content purge |

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Audio capture | `navigator.mediaDevices.getUserMedia()` + MediaRecorder API |
| Audio format | PCM 16kHz (for ElevenLabs WebSocket) |
| Frontend → Backend transport | WebSocket (`ws://` / `wss://`) |
| Backend → ElevenLabs transport | WebSocket (`wss://api.elevenlabs.io/v1/speech-to-text/realtime`) |
| Backend → Frontend transcripts | Server-Sent Events (SSE) via existing streaming infrastructure |
| AI summarization | Claude Opus 4.6 via Anthropic Messages API |
| Autocomplete predictions | Claude Haiku 4.5 (fast, cheap, good enough for predictions) |
| Audio encryption | AES-256-GCM via e2eEncryptionService |
| Database | MongoDB (`patient_visits` collection) |
| Node.js SDK | `@elevenlabs/client` (official, TypeScript) |

---

## ElevenLabs API Details

### WebSocket Connection
```
URL: wss://api.elevenlabs.io/v1/speech-to-text/realtime
Auth: xi-api-key header (from productionKMS)
Query params:
  model_id=scribe-1
  audio_format=pcm_16000
  commit_strategy=vad
  include_timestamps=true
  vad_silence_threshold_secs=1.5
  enable_logging=false (zero-retention)
```

### Message Format
```javascript
// Client → ElevenLabs
{ message_type: "input_audio_chunk", audio_base_64: "...", sample_rate: 16000 }

// ElevenLabs → Client
{ message_type: "partial_transcript", text: "the patient reports..." }
{ message_type: "committed_transcript", text: "The patient reports chest pain..." }
{ message_type: "committed_transcript_with_timestamps", text: "...", words: [...] }
```

### Pricing
- Realtime: ~$0.48/hour ($0.008/min)
- ~$0.12 per 15-minute visit
- Speaker diarization included
- Entity detection: +$0.08/hour (optional, for medical terms)

---

## Sentence Autocomplete

When the doctor is typing in text mode (not voice), AI predicts the rest of the sentence:

1. Doctor types: "Patient presents with chest"
2. System sends partial text + patient context to Claude Haiku 4.5
3. Claude predicts: " pain radiating to left arm, onset 2 hours ago"
4. Ghost text appears in gray after cursor (like GitHub Copilot)
5. Doctor presses Tab to accept, or keeps typing to ignore

**Context sent to Claude for prediction:**
- Current partial text
- Patient's medical history (from MongoDB)
- Visit transcript so far (if recording)
- Common medical phrases for the visit type

**Debounced:** 300ms after last keystroke, max 1 request at a time.
**Model:** Claude Haiku 4.5 (fast responses, low cost)
