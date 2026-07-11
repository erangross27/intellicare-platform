# Task 4: Frontend — Mic Button + Audio Capture

**Priority:** HIGH — User-facing entry point for voice features
**Estimated files:** 2 new, 2 modified
**Dependencies:** Task 2 (WebSocket endpoint must exist)

---

## What to Build

A microphone button on the chat input row that opens a popup with two modes: "Record Visit" and "Voice Chat". Handles browser audio capture and WebSocket streaming.

---

## Files to Create

### 1. `apps/frontend-vite/src/components/chat/VoiceRecordingButton.jsx`

**Purpose:** Mic button component with popup menu and recording state management.

**UI States:**
1. **Idle** — mic icon button (same size as send/upload buttons)
2. **Menu open** — popup with two options:
   - "Record Visit" (with patient name prompt if not in context)
   - "Voice Chat" (talk to IntelliCare)
3. **Recording** — pulsing red mic icon, duration timer, "Stop" button
4. **Processing** — spinner while AI generates summary

**Button placement:** Between the text input and the file upload button:
```
[Type a message...] [🎤] [📎] [➤ Send]
```

**Audio capture:**
```javascript
// getUserMedia for PCM audio
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
  }
});

// Use AudioWorklet or ScriptProcessorNode to get PCM chunks
// Convert Float32Array to Int16Array (PCM 16-bit)
// Base64-encode and send via WebSocket every ~250ms
```

**WebSocket connection:**
```javascript
const ws = new WebSocket(`wss://${host}/ws/visit-recording?token=${authToken}`);

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "start", patientId, mode }));
};

// Send audio chunks
const sendAudioChunk = (pcmInt16Array) => {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmInt16Array.buffer)));
  ws.send(JSON.stringify({ type: "audio", data: base64 }));
};

// Receive transcripts
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'partial': onPartialTranscript(msg.text); break;
    case 'committed': onCommittedTranscript(msg.text, msg.speaker); break;
    case 'summary_ready': onSummaryReady(msg.summary); break;
  }
};
```

**Props received from ChatContainer:**
- `onTranscriptUpdate(text, isPartial)` — updates live transcript display
- `onVoiceChatText(text)` — injects text into chat input (voice chat mode)
- `onVisitStarted(visitId)` — signals visit recording has started
- `onVisitEnded(summary)` — signals visit ended with summary
- `patientContext` — current patient info from chat session
- `isRecording` — controlled state from parent

### 2. `apps/frontend-vite/src/components/chat/VoiceRecordingButton.css`

**Styling:**
- Mic button: matches existing button sizes in MessageInput
- Popup menu: dark theme consistent with chat UI
- Recording state: pulsing red animation on mic icon
- Duration timer: small text showing "00:00" counting up
- Stop button: red circle with white square icon

---

## Files to Modify

### 3. `apps/frontend-vite/src/components/chat/MessageInput.js`

**Changes:**
- Import VoiceRecordingButton component
- Add mic button to the button row (between textarea and file upload)
- Pass callbacks: `onTranscriptUpdate`, `onVoiceChatText`
- In "Voice Chat" mode: when committed transcript arrives, set it as textarea value and optionally auto-send

### 4. `apps/frontend-vite/src/components/chat/ChatContainer.js`

**Changes:**
- Add state: `isRecording`, `activeVisitId`, `liveTranscript`
- Add WebSocket reference for visit recording
- Handle visit lifecycle: start → recording → end → review
- Display live transcript in chat as a special message type
- When summary is ready, trigger artifact panel display
- Connect to agent flow: if agent calls `startVisitRecording`, signal VoiceRecordingButton to auto-start

---

## Consent Flow

Before recording starts:
1. Show consent dialog: "This visit will be recorded for documentation purposes. Patient consent is required."
2. Options: "Patient Consents (Verbal)" | "Written Consent on File" | "Cancel"
3. Store consent method in visit record
4. Only proceed with recording after consent confirmed

---

## Verification

- [ ] Mic button visible next to send button
- [ ] Popup shows "Record Visit" and "Voice Chat" options
- [ ] "Record Visit" prompts for patient (or uses current context)
- [ ] Consent dialog appears before recording
- [ ] Browser requests microphone permission
- [ ] Audio streams via WebSocket to backend
- [ ] Live transcript appears in chat during recording
- [ ] Duration timer shows elapsed time
- [ ] "Stop" button ends recording cleanly
- [ ] "Voice Chat" mode: transcript text goes into chat input
- [ ] Works in Chrome, Firefox, Edge (getUserMedia support)
- [ ] Graceful fallback if microphone not available
