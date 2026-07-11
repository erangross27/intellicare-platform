# Voice Mode: Text-to-Speech for IntelliCare Agent

**Date:** 2026-02-18
**Status:** Design Approved — Ready for Implementation

---

## Overview

Add a **Voice Mode** to IntelliCare where the doctor can have a full speech-to-speech conversation with the agent. The agent works exactly as it does today (receives text, returns text, executes tools), but with two new layers:

1. **STT input** (existing): Doctor's speech transcribed via ElevenLabs Scribe v2 → text sent as agent message
2. **TTS output** (new): Agent's text response → ElevenLabs TTS streaming API → audio played through speakers

Text always appears in chat. Voice is an additional output channel.

---

## Design Decisions (All Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent | **Our IntelliCare agent (unchanged)** | Has 235+ tools, full context, patient access |
| STT | **ElevenLabs Scribe v2 Realtime** | Already built and working |
| TTS | **ElevenLabs TTS streaming API** | Same vendor, low latency, high quality |
| TTS Model | **eleven_turbo_v2_5** or **eleven_flash_v2_5** | Low latency for conversational use |
| Audio Format | **mp3_44100_128** | Good quality, browser-native playback |
| Architecture | **Backend TTS endpoint** | API key stays server-side |
| Agent changes | **Zero** | Agent receives text, returns text — no modifications |
| Chat display | **Text always shown** | TTS is additive, text remains in chat |

---

## Architecture

```
VOICE MODE FLOW:

Doctor speaks
    │
    ▼
ElevenLabs Scribe v2 STT ──→ text in input box
(existing WebSocket)              │
                                  ▼
                         Text sent to agent
                         POST /api/agent/chat
                         (existing, unchanged)
                                  │
                                  ▼
                         IntelliCare Agent (Claude)
                         - 235+ tools
                         - Patient search
                         - Medical functions
                         - Full context
                                  │
                                  ▼
                         Text response in chat (existing)
                                  │
                          ┌───────┴───────┐
                          │               │
                    Text in chat    POST /api/tts/speak
                    (existing)      (NEW endpoint)
                                          │
                                          ▼
                                  ElevenLabs TTS API
                                  textToSpeech.stream()
                                          │
                                          ▼
                                  Audio stream → speaker
```

---

## Technology Stack

| Component | Technology | Status |
|-----------|-----------|--------|
| STT | ElevenLabs Scribe v2 Realtime (`scribe_v2_realtime`) | Existing |
| TTS | ElevenLabs TTS streaming (`eleven_turbo_v2_5`) | New |
| TTS SDK | `@elevenlabs/elevenlabs-js` (Node.js) | New dependency |
| Audio format | mp3_44100_128 | — |
| Agent | IntelliCare Claude agent (unchanged) | Existing |
| Auth | `xi-api-key` header from productionKMS | Existing pattern |

---

## New Backend: TTS Service

```javascript
// services/elevenLabsTtsService.js
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');

class ElevenLabsTtsService {
  constructor() {
    this.client = null;
    this.voiceId = null;
    this.initialized = false;
  }

  async initialize() {
    const productionKMS = require('./productionKMS');
    if (!productionKMS.initialized) await productionKMS.initialize();

    const apiKey = await productionKMS.getInternalKey('elevenlabs_api_key');
    if (!apiKey) {
      console.warn('ElevenLabs API key not found — TTS unavailable');
      this.initialized = true;
      return;
    }

    this.client = new ElevenLabsClient({ apiKey });
    this.voiceId = 'JBFqnCBsd6RMkjVDRZzb'; // Default voice (configurable)
    this.initialized = true;
    console.log('ElevenLabsTtsService initialized');
  }

  isAvailable() {
    return this.initialized && !!this.client;
  }

  async streamSpeech(text, res) {
    const audioStream = await this.client.textToSpeech.stream(this.voiceId, {
      text,
      modelId: 'eleven_turbo_v2_5',
      outputFormat: 'mp3_44100_128',
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of audioStream) {
      if (!res.writableEnded) res.write(chunk);
    }
    if (!res.writableEnded) res.end();
  }
}

module.exports = new ElevenLabsTtsService();
```

---

## New Backend: TTS Route

```javascript
// routes/tts.js
router.post('/speak', practiceAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const ttsService = require('../services/elevenLabsTtsService');
  if (!ttsService.isAvailable()) {
    return res.status(503).json({ error: 'TTS service unavailable' });
  }

  await ttsService.streamSpeech(text, res);
});
```

---

## Frontend: Audio Playback on Agent Response

When voice mode is active and agent responds, the frontend:
1. Displays text in chat (existing, unchanged)
2. Sends text to `/api/tts/speak`
3. Receives audio stream
4. Plays through speakers

```javascript
// In ChatContainer or MessageInput — when voice mode is on
const speakResponse = async (text) => {
  const res = await fetch('/api/tts/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  const audioBlob = await res.blob();
  const url = URL.createObjectURL(audioBlob);
  const audio = new Audio(url);
  await audio.play();
  URL.revokeObjectURL(url);
};
```

---

## Voice Mode UX

The existing Voice Chat mode (STT only) becomes Voice Mode (STT + TTS):

- **Voice Chat** (existing): Doctor speaks → text in input → doctor sends → agent responds in **text only**
- **Voice Mode** (enhanced): Doctor speaks → auto-sent to agent → agent responds in **text + speech**

The mic button popup options become:
1. **Record Visit** — ambient recording of doctor-patient conversation
2. **Voice Mode** — full speech-to-speech conversation with agent (STT + TTS)

---

## Visit Recording with Voice Mode

```
1. Doctor clicks "Record Visit" → consent dialog
2. Voice Mode activates automatically
3. Agent (TTS): "Which patient is this visit for?"
4. Doctor speaks → STT → agent searches patients → TTS response
5. Agent (TTS): "I found John Smith. Ready to record."
6. Transition to ambient recording (existing Scribe v2 STT)
7. Live transcript shown during doctor-patient conversation
8. Doctor clicks stop → Claude SOAP summary → artifact panel
9. Doctor reviews/approves → saved to patient_visits
```

---

## Files

### New Files (3)
| File | Purpose |
|------|---------|
| `services/elevenLabsTtsService.js` | ElevenLabs TTS wrapper (stream text → audio) |
| `routes/tts.js` | `POST /api/tts/speak` endpoint |
| `hooks/useVoiceMode.js` | React hook: manages TTS playback + voice mode state |

### Modified Files (5)
| File | Change |
|------|--------|
| `masterServiceLoader.js` | Register `elevenLabsTtsService` |
| `routeLoaderService.js` | Register `/api/tts` route |
| `vite.config.js` | Add `/api/tts` proxy rule |
| `VoiceRecordingButton.jsx` | Rename "Voice Chat" to "Voice Mode" |
| `MessageInput.js` or `ChatContainer.js` | Call `speakResponse()` when voice mode active and agent responds |

### Unchanged
- `agentServiceClaude.js` — zero changes
- `agentServiceV4.js` — zero changes
- `aiHelpers.js` — zero changes
- `elevenLabsSttService.js` — zero changes (STT is separate)

---

## NPM Dependencies

```bash
cd apps/backend-api
npm install @elevenlabs/elevenlabs-js
```

---

## KMS Keys

| Key | Value | Status |
|-----|-------|--------|
| `elevenlabs_api_key` | ElevenLabs API key | Already stored |
| `elevenlabs_voice_id` | Voice ID for TTS (optional, can default) | New (optional) |

---

## Cost Estimate

| Component | Cost | Per Visit |
|-----------|------|-----------|
| TTS (Flash v2.5) | ~$0.15 / 1000 chars | ~$0.05-$0.10 (3-5 agent responses) |
| STT (Scribe v2) | $0.48 / hour | ~$0.12 (15 min recording) |
| Agent (Claude) | Existing cost | Unchanged |
| **Total per visit** | | **~$0.17-$0.22** |

---

## HIPAA Compliance

| Requirement | Implementation |
|-------------|----------------|
| TTS content | Agent response text only (no PHI in most responses) |
| No audio storage | TTS audio is streamed and not saved |
| Transit encryption | HTTPS/TLS for all API calls |
| API key security | Stored in productionKMS, never exposed to frontend |
| ElevenLabs | Zero-retention mode (existing configuration) |
