# Voice Mode (TTS) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add text-to-speech output to the IntelliCare agent so doctors can have voice conversations — agent text responses are spoken aloud while still appearing in chat.

**Architecture:** Zero agent changes. New backend TTS service wraps ElevenLabs TTS streaming API. New `/api/tts/speak` endpoint accepts text, returns audio stream. Frontend `useVoiceMode` hook intercepts agent responses when voice mode is active, sends text to TTS endpoint, plays audio through speakers. Existing STT (Voice Chat) is renamed to "Voice Mode" with TTS added.

**Tech Stack:** ElevenLabs TTS streaming (`eleven_turbo_v2_5`), `@elevenlabs/elevenlabs-js` Node.js SDK, mp3_44100_128 format, React hook for audio playback.

**Design Doc:** `docs/plans/2026-02-18-voice-mode-tts-design.md`

---

### Task 1: Install ElevenLabs Node.js SDK

**Files:**
- Modify: `apps/backend-api/package.json`

**Step 1: Install the dependency**

```bash
cd /home/erangross/IntelliCare/apps/backend-api
npm install @elevenlabs/elevenlabs-js
```

**Step 2: Verify installation**

```bash
node -e "const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js'); console.log('OK:', typeof ElevenLabsClient)"
```

Expected: `OK: function`

**Step 3: Commit**

```bash
git add apps/backend-api/package.json apps/backend-api/package-lock.json
git commit -m "chore: add @elevenlabs/elevenlabs-js for TTS streaming"
```

---

### Task 2: Create ElevenLabs TTS Service

**Files:**
- Create: `apps/backend-api/services/elevenLabsTtsService.js`

**Step 1: Create the TTS service**

Create `apps/backend-api/services/elevenLabsTtsService.js` with this exact content:

```javascript
/**
 * ElevenLabs Text-to-Speech Service
 * Streams agent text responses as audio via ElevenLabs TTS API.
 * API key loaded from productionKMS (same pattern as elevenLabsSttService).
 */

const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');

class ElevenLabsTtsService {
  constructor() {
    this.client = null;
    this.voiceId = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      const productionKMS = require('./productionKMS');
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }

      const apiKey = await productionKMS.getInternalKey('elevenlabs_api_key');
      if (!apiKey) {
        console.warn('ElevenLabs API key not found in KMS — TTS service will be unavailable');
        this.initialized = true;
        return;
      }

      this.client = new ElevenLabsClient({ apiKey });

      // Default voice — can be overridden per-request or via KMS key 'elevenlabs_voice_id'
      const customVoiceId = await productionKMS.getInternalKey('elevenlabs_voice_id');
      this.voiceId = customVoiceId || 'JBFqnCBsd6RMkjVDRZzb';

      this.initialized = true;
      console.log('ElevenLabsTtsService initialized');
    } catch (error) {
      console.error('ElevenLabsTtsService initialization failed:', error.message);
      this.initialized = true;
    }
  }

  isAvailable() {
    return this.initialized && !!this.client;
  }

  /**
   * Stream text as audio to an Express response.
   * @param {string} text - The text to convert to speech
   * @param {object} res - Express response object
   * @param {object} [options] - Optional overrides
   * @param {string} [options.voiceId] - Override default voice
   * @param {string} [options.modelId] - Override default model
   */
  async streamSpeech(text, res, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('TTS service not available');
    }

    const voiceId = options.voiceId || this.voiceId;
    const modelId = options.modelId || 'eleven_turbo_v2_5';

    const audioStream = await this.client.textToSpeech.stream(voiceId, {
      text,
      model_id: modelId,
      output_format: 'mp3_44100_128',
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    for await (const chunk of audioStream) {
      if (!res.writableEnded) {
        res.write(chunk);
      }
    }

    if (!res.writableEnded) {
      res.end();
    }
  }
}

module.exports = new ElevenLabsTtsService();
```

**Step 2: Verify the file loads without errors**

```bash
cd /home/erangross/IntelliCare/apps/backend-api
node -e "const svc = require('./services/elevenLabsTtsService'); console.log('loaded:', svc.constructor.name, 'initialized:', svc.initialized)"
```

Expected: `loaded: ElevenLabsTtsService initialized: false` (not initialized yet — that happens at startup)

**Step 3: Commit**

```bash
git add apps/backend-api/services/elevenLabsTtsService.js
git commit -m "feat: add ElevenLabs TTS service for voice mode audio streaming"
```

---

### Task 3: Register TTS Service in masterServiceLoader

**Files:**
- Modify: `apps/backend-api/services/masterServiceLoader.js` (3 locations)

**Step 1: Add to Phase 8 AI Services array (line 203)**

In `masterServiceLoader.js`, find the line:
```javascript
                'elevenLabsSttService'  // ElevenLabs real-time STT for voice visits
```

Change it to:
```javascript
                'elevenLabsSttService',  // ElevenLabs real-time STT for voice visits
                'elevenLabsTtsService'   // ElevenLabs TTS for voice mode audio output
```

Note: The existing line needs a comma added after it.

**Step 2: Add path mapping (after line 478)**

Find the line:
```javascript
            'elevenLabsSttService': './elevenLabsSttService',
```

Add after it:
```javascript
            'elevenLabsTtsService': './elevenLabsTtsService',
```

**Step 3: Add to initServices array (after line 576)**

Find the line:
```javascript
            'elevenLabsSttService'   // ElevenLabs real-time STT — needs init for KMS API key
```

Change it to:
```javascript
            'elevenLabsSttService',  // ElevenLabs real-time STT — needs init for KMS API key
            'elevenLabsTtsService'   // ElevenLabs TTS — needs init for KMS API key
```

**Step 4: Verify no syntax errors**

```bash
cd /home/erangross/IntelliCare/apps/backend-api
node -e "const loader = require('./services/masterServiceLoader'); console.log('OK')"
```

Expected: `OK` (no errors)

**Step 5: Commit**

```bash
git add apps/backend-api/services/masterServiceLoader.js
git commit -m "feat: register elevenLabsTtsService in masterServiceLoader"
```

---

### Task 4: Create TTS Route

**Files:**
- Create: `apps/backend-api/routes/textToSpeech.js`

**Step 1: Create the route file**

Create `apps/backend-api/routes/textToSpeech.js` with this exact content:

```javascript
/**
 * Text-to-Speech Route
 * POST /api/tts/speak — streams agent text as audio via ElevenLabs TTS.
 * Used by frontend voice mode to speak agent responses aloud.
 */

const express = require('express');
const router = express.Router();
const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext } = require('../middleware/practiceContext');

// Apply middleware
router.use(practiceContext);
router.use(practiceAuth);

// Lazy-load TTS service to avoid circular dependencies
let ttsService;
function getTtsService() {
  if (!ttsService) ttsService = require('../services/elevenLabsTtsService');
  return ttsService;
}

/**
 * POST /api/tts/speak
 * Body: { text: string }
 * Response: audio/mpeg stream
 */
router.post('/speak', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }

    const svc = getTtsService();
    if (!svc.isAvailable()) {
      return res.status(503).json({ error: 'TTS service unavailable' });
    }

    await svc.streamSpeech(text.trim(), res);
  } catch (err) {
    console.error('[TTS] POST /speak error:', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'TTS streaming failed' });
    }
  }
});

module.exports = router;
```

**Step 2: Verify the file loads**

```bash
cd /home/erangross/IntelliCare/apps/backend-api
node -e "const r = require('./routes/textToSpeech'); console.log('OK:', typeof r)"
```

Expected: `OK: function`

**Step 3: Commit**

```bash
git add apps/backend-api/routes/textToSpeech.js
git commit -m "feat: add POST /api/tts/speak route for voice mode audio streaming"
```

---

### Task 5: Register TTS Route in routeLoaderService

**Files:**
- Modify: `apps/backend-api/services/routeLoaderService.js` (line ~83)

**Step 1: Add the TTS route**

Find the line:
```javascript
            // ===== VISIT RECORDING =====
            { path: '/api/visits', file: './routes/visitRecording' },
```

Add after it:
```javascript

            // ===== TEXT-TO-SPEECH (Voice Mode) =====
            { path: '/api/tts', file: './routes/textToSpeech' },
```

**Step 2: Verify no syntax errors**

```bash
cd /home/erangross/IntelliCare/apps/backend-api
node -e "const r = require('./services/routeLoaderService'); console.log('OK')"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add apps/backend-api/services/routeLoaderService.js
git commit -m "feat: register /api/tts route in routeLoaderService"
```

---

### Task 6: Add TTS Proxy to Vite Config

**Files:**
- Modify: `apps/frontend-vite/vite.config.js` (line ~73)

**Step 1: Verify current proxy config**

The existing `/api` proxy at line 74 already catches ALL `/api/*` paths including `/api/tts/*`. Check this:

```javascript
      '/api': {
        target: 'https://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        ...
      },
```

Since `/api/tts/speak` is under `/api`, the existing proxy rule already handles it. **No change needed to vite.config.js.**

**Step 2: Verify by checking proxy behavior**

After the backend is running, test:
```bash
curl -k -X POST https://localhost:3000/api/tts/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"hello"}' \
  -o /dev/null -w "%{http_code}"
```

Expected: `401` (auth required — proves the proxy is forwarding to backend)

**Step 3: No commit needed — no changes**

---

### Task 7: Create useVoiceMode React Hook

**Files:**
- Create: `apps/frontend-vite/src/hooks/useVoiceMode.js`

**Step 1: Create the hook**

Create `apps/frontend-vite/src/hooks/useVoiceMode.js` with this exact content:

```javascript
import { useState, useRef, useCallback } from 'react';

/**
 * useVoiceMode — manages TTS playback for voice mode.
 * When voice mode is active, agent text responses are sent to /api/tts/speak
 * and played through speakers. Text still appears in chat (unchanged).
 */
export function useVoiceMode() {
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const abortRef = useRef(null);

  /**
   * Speak text through TTS. Call this when agent response is complete.
   * @param {string} text - The agent's response text
   */
  const speakResponse = useCallback(async (text) => {
    if (!voiceModeActive || !text || text.trim().length === 0) return;

    // Abort any in-progress speech
    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsSpeaking(true);

      const res = await fetch('/api/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn('[VoiceMode] TTS request failed:', res.status);
        setIsSpeaking(false);
        return;
      }

      const audioBlob = await res.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[VoiceMode] TTS playback error:', err);
      }
      setIsSpeaking(false);
    }
  }, [voiceModeActive]);

  /**
   * Stop any in-progress speech immediately.
   */
  const stopSpeaking = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  /**
   * Toggle voice mode on/off.
   */
  const toggleVoiceMode = useCallback((active) => {
    const newState = typeof active === 'boolean' ? active : !voiceModeActive;
    setVoiceModeActive(newState);
    if (!newState) {
      stopSpeaking();
    }
  }, [voiceModeActive, stopSpeaking]);

  return {
    voiceModeActive,
    isSpeaking,
    toggleVoiceMode,
    speakResponse,
    stopSpeaking,
  };
}
```

**Step 2: Verify the file is valid JSX/JS**

```bash
cd /home/erangross/IntelliCare/apps/frontend-vite
npx -y acorn --ecma2020 --module src/hooks/useVoiceMode.js 2>&1 | head -5
```

If acorn isn't available, just verify no syntax errors by importing:
```bash
node -e "try { require('./src/hooks/useVoiceMode.js') } catch(e) { console.log(e.message.includes('import') ? 'OK (ESM)' : 'ERROR: ' + e.message) }"
```

Expected: `OK (ESM)` — the file uses ESM imports, which is correct for Vite.

**Step 3: Commit**

```bash
git add apps/frontend-vite/src/hooks/useVoiceMode.js
git commit -m "feat: add useVoiceMode hook for TTS audio playback"
```

---

### Task 8: Wire TTS to Agent Response in ChatContainer

**Files:**
- Modify: `apps/frontend-vite/src/components/chat/ChatContainer.js` (3 locations)

This is the key integration task. When voice mode is active and the agent finishes responding, we call `speakResponse()` with the agent's text.

**Step 1: Import useVoiceMode hook (near line 1, after existing imports)**

Find the line:
```javascript
import { useStaffChat } from '../../hooks/useStaffChat';
```

Add after it:
```javascript
import { useVoiceMode } from '../../hooks/useVoiceMode';
```

**Step 2: Initialize the hook (near line 320, after existing state declarations)**

Find the lines:
```javascript
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState(null); // 'visit' or 'voiceChat'
```

Add after them:
```javascript

  // Voice Mode — TTS playback of agent responses
  const { voiceModeActive, isSpeaking, toggleVoiceMode, speakResponse, stopSpeaking } = useVoiceMode();
```

**Step 3: Call speakResponse when agent response is complete (near line 1450)**

Find the line:
```javascript
                console.log(`✅ [Streaming] Complete message received, final content length: ${streamedContent.length}`);
```

Add after it:
```javascript

                // Voice Mode: speak the agent's response aloud
                if (voiceModeActive && streamedContent.length > 0) {
                  speakResponse(streamedContent);
                }
```

**Step 4: Auto-enable voice mode when voiceChat recording starts**

Find the line (around line 2990):
```javascript
            setIsRecording={setIsRecording}
```

Find the `onRecordingModeChange` handler nearby in MessageInput props. In `ChatContainer.js`, find where `recordingMode` is set. Look for:
```javascript
  const [recordingMode, setRecordingMode] = useState(null); // 'visit' or 'voiceChat'
```

We need to auto-enable voice mode when voiceChat recording starts and disable when it stops. Add a useEffect after the existing `recordingMode` state:

```javascript
  // Auto-toggle voice mode when voiceChat recording starts/stops
  useEffect(() => {
    if (recordingMode === 'voiceChat') {
      toggleVoiceMode(true);
    } else if (!isRecording) {
      toggleVoiceMode(false);
    }
  }, [recordingMode, isRecording]);
```

**Step 5: Verify no syntax errors**

Start the Vite dev server and check browser console for errors:
```bash
cd /home/erangross/IntelliCare/apps/frontend-vite
npx vite build --mode development 2>&1 | tail -5
```

Expected: Build succeeds (or at least no import/syntax errors).

**Step 6: Commit**

```bash
git add apps/frontend-vite/src/components/chat/ChatContainer.js
git commit -m "feat: wire useVoiceMode to agent response stream — speak responses in voice mode"
```

---

### Task 9: Rename "Voice Chat" to "Voice Mode" in VoiceRecordingButton

**Files:**
- Modify: `apps/frontend-vite/src/components/chat/VoiceRecordingButton.jsx` (lines 261-267)

**Step 1: Update the popup option text**

Find these lines:
```javascript
          <button className="voice-recording-popup-option" onClick={() => handleOptionClick('voiceChat')}>
            <span className="option-icon">&#127908;</span>
            <div>
              <div className="option-label">Voice Chat</div>
              <div className="option-desc">Talk to IntelliCare instead of typing</div>
            </div>
          </button>
```

Replace with:
```javascript
          <button className="voice-recording-popup-option" onClick={() => handleOptionClick('voiceChat')}>
            <span className="option-icon">&#127908;</span>
            <div>
              <div className="option-label">Voice Mode</div>
              <div className="option-desc">Talk to IntelliCare — agent speaks back</div>
            </div>
          </button>
```

**Step 2: Commit**

```bash
git add apps/frontend-vite/src/components/chat/VoiceRecordingButton.jsx
git commit -m "feat: rename Voice Chat to Voice Mode in mic button popup"
```

---

### Task 10: End-to-End Manual Test

**Prerequisites:** Backend and frontend must be running.

**Step 1: Start the backend**

```bash
cd /home/erangross/IntelliCare/apps/backend-api
node server.js
```

Verify in logs: `ElevenLabsTtsService initialized`

**Step 2: Start the frontend**

```bash
cd /home/erangross/IntelliCare/apps/frontend-vite
npx vite
```

**Step 3: Test TTS endpoint directly**

```bash
curl -k -X POST https://localhost:5000/api/tts/speak \
  -H "Content-Type: application/json" \
  -H "Cookie: <valid-session-cookie>" \
  -d '{"text":"Hello doctor, this is a test of the voice mode feature."}' \
  --output test-audio.mp3
```

If `test-audio.mp3` is a valid MP3 file (> 1KB), TTS streaming works.

**Step 4: Test voice mode in browser**

1. Open https://intellicare.health:3000 and log in
2. Click the mic button — verify "Voice Mode" label (was "Voice Chat")
3. Click "Voice Mode" — recording starts
4. Speak a message — STT transcribes, text appears in input
5. Message auto-sends to agent
6. Agent responds — text appears in chat AND audio plays through speakers
7. Click stop — recording stops, voice mode deactivates

**Step 5: Verify text still appears in chat**

The chat text must appear exactly as before. TTS is additive — it does NOT replace or modify the text display.

---

## Summary of All Changes

### New Files (3)
| File | Purpose |
|------|---------|
| `apps/backend-api/services/elevenLabsTtsService.js` | ElevenLabs TTS wrapper |
| `apps/backend-api/routes/textToSpeech.js` | POST /api/tts/speak endpoint |
| `apps/frontend-vite/src/hooks/useVoiceMode.js` | React hook for TTS playback |

### Modified Files (4)
| File | Change |
|------|--------|
| `apps/backend-api/services/masterServiceLoader.js` | Register TTS service (3 locations) |
| `apps/backend-api/services/routeLoaderService.js` | Register /api/tts route |
| `apps/frontend-vite/src/components/chat/ChatContainer.js` | Import + init useVoiceMode, call speakResponse on complete |
| `apps/frontend-vite/src/components/chat/VoiceRecordingButton.jsx` | Rename "Voice Chat" to "Voice Mode" |

### Unchanged
| File | Why |
|------|-----|
| `agentServiceClaude.js` | Zero agent changes |
| `agentServiceV4.js` | Zero agent changes |
| `aiHelpers.js` | Zero agent changes |
| `elevenLabsSttService.js` | STT is separate from TTS |
| `vite.config.js` | Existing `/api` proxy already handles `/api/tts` |

### NPM Dependencies (1)
| Package | Location |
|---------|----------|
| `@elevenlabs/elevenlabs-js` | `apps/backend-api/` |
