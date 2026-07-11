# Task 5: Frontend — Live Transcript Display + Visit Review Panel

**Priority:** HIGH — Doctor must see what's being transcribed in real-time
**Estimated files:** 2 new, 2 modified
**Dependencies:** Task 4 (mic button + audio capture)

---

## What to Build

Real-time transcript display in the chat window during recording, and a visit review panel in the artifact panel for editing the AI-generated SOAP note.

---

## Live Transcript Display

### In ChatContainer during recording:

Show a special "recording" message card in the chat that updates in real-time:

```
┌──────────────────────────────────────────────────┐
│ 🔴 Recording Visit — John Smith        03:42     │
│──────────────────────────────────────────────────│
│                                                   │
│ [Doctor]: So what brings you in today?           │
│                                                   │
│ [Patient]: I've been having this chest pain       │
│ for about two days now. It started after I        │
│ went jogging on Tuesday.                          │
│                                                   │
│ [Doctor]: Can you describe the pain? Is it        │
│ sharp or dull?                                    │
│                                                   │
│ [Patient]: It's more of a pressure, like|         │  ← partial (italic/gray)
│                                                   │
│               [ ⏹ End Visit ]                    │
└──────────────────────────────────────────────────┘
```

**Behavior:**
- Committed transcripts: normal text with speaker label (bold)
- Partial transcripts: gray/italic, replaces as new partials arrive
- Speaker diarization: "[Doctor]:" and "[Patient]:" labels from ElevenLabs
- Auto-scroll to bottom as new text arrives
- Duration timer in header
- "End Visit" button at bottom

### Files to Create

### 1. `apps/frontend-vite/src/components/chat/LiveTranscriptCard.jsx`

**Purpose:** Renders the live transcript during recording.

**Props:**
- `transcript` — array of committed segments: `[{ text, speaker, timestamp }]`
- `partialText` — current partial transcript (gray, updating)
- `duration` — seconds elapsed
- `patientName` — for the header
- `onEndVisit` — callback to stop recording
- `isProcessing` — show spinner when generating summary

### 2. `apps/frontend-vite/src/components/chat/LiveTranscriptCard.css`

**Styling:**
- Dark card matching chat theme
- Red recording indicator (pulsing dot)
- Speaker labels in different colors (doctor = blue, patient = green)
- Partial text in gray italic
- Smooth auto-scroll behavior

---

## Visit Review in Artifact Panel

After recording ends and Claude generates the summary, display it in the artifact panel as an editable document.

### Files to Modify

### 3. `apps/frontend-vite/src/components/artifact/ArtifactPanel.jsx`

**Changes:**
- Add `patient_visits` to `DOCUMENT_VIEW_COLLECTIONS`
- Handle visit review mode: when `summary_ready` event fires, open artifact panel with visit data
- Add "Approve & Save" button specific to visit review
- Add "Play Recording" button to replay audio

### 4. Create visit review template (or modify existing artifact rendering)

The visit summary should display as an editable form in the artifact panel:

```
┌──────────────────────────────────────────────────┐
│ Visit Summary — John Smith — Feb 18, 2026        │
│ Status: Reviewing                    [▶ Play]    │
│──────────────────────────────────────────────────│
│                                                   │
│ CHIEF COMPLAINT                        [Edit]    │
│ ┌────────────────────────────────────────────┐   │
│ │ Chest pain for 2 days, onset after jogging │   │
│ └────────────────────────────────────────────┘   │
│                                                   │
│ HISTORY OF PRESENT ILLNESS              [Edit]    │
│ ┌────────────────────────────────────────────┐   │
│ │ 45-year-old male presents with substernal  │   │
│ │ chest pressure for 2 days. Onset after     │   │
│ │ jogging on Tuesday. Pain is pressure-like, │   │
│ │ non-radiating, 5/10 severity...            │   │
│ └────────────────────────────────────────────┘   │
│                                                   │
│ REVIEW OF SYSTEMS                       [Edit]    │
│ ┌────────────────────────────────────────────┐   │
│ │ Cardiovascular: Positive for chest pain... │   │
│ └────────────────────────────────────────────┘   │
│                                                   │
│ PHYSICAL EXAMINATION                    [Edit]    │
│ ASSESSMENT                              [Edit]    │
│ PLAN                                    [Edit]    │
│ MEDICATIONS                             [Edit]    │
│ FOLLOW-UP                               [Edit]    │
│                                                   │
│        [ ✓ Approve & Save ]  [ ✗ Discard ]       │
└──────────────────────────────────────────────────┘
```

**Edit mode:** Clicking [Edit] on a section makes it a textarea. Doctor modifies text, clicks "Done". Changes tracked in `doctorEdits.editedFields`.

**"Play Recording" button:** Fetches audio from `GET /api/visits/:id/audio` and plays via HTML5 `<audio>` element.

**"Approve & Save":** Calls `PUT /api/visits/:id/approve`, sets status to "approved", records `approvedAt` and `approvedBy`.

---

## Verification

- [ ] Live transcript card appears during recording
- [ ] Speaker labels show (Doctor/Patient)
- [ ] Partial text updates in gray, committed text in white
- [ ] Auto-scroll works smoothly
- [ ] "End Visit" button stops recording and shows processing state
- [ ] AI summary appears in artifact panel after processing
- [ ] Each SOAP section is editable
- [ ] "Play Recording" plays the audio
- [ ] "Approve & Save" finalizes the visit
- [ ] "Discard" cancels and deletes the visit record
- [ ] Edited fields tracked in doctorEdits
