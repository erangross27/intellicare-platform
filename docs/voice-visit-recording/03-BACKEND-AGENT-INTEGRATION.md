# Task 3: Agent Integration — Voice Visit Tools

**Priority:** MEDIUM — Enables agent to start/manage visits via chat
**Estimated files:** 0 new, 4 modified
**Dependencies:** Task 1, Task 2

---

## What to Build

Register visit recording tools with the AI agent so the doctor can say "record a new visit for patient John Smith" and the agent handles it.

---

## Files to Modify

### 1. `apps/backend-api/services/utils/aiHelpers.js`

Add tool descriptions for:

**startVisitRecording:**
```javascript
{
  name: "startVisitRecording",
  description: "Start recording a new patient visit. Call this when the doctor wants to record a visit encounter.",
  input_schema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID to link the visit to" },
      visitType: { type: "string", enum: ["in-person", "telehealth", "phone"], description: "Type of visit" },
    },
    required: ["patientId"]
  }
}
```

**endVisitRecording:**
```javascript
{
  name: "endVisitRecording",
  description: "End the current visit recording and generate AI summary.",
  input_schema: {
    type: "object",
    properties: {
      visitId: { type: "string", description: "Visit ID to end" }
    },
    required: ["visitId"]
  }
}
```

**getPatientVisits:**
```javascript
{
  name: "getPatientVisits",
  description: "Get visit history for a patient.",
  input_schema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID" },
      limit: { type: "number", description: "Max visits to return", default: 10 }
    },
    required: ["patientId"]
  }
}
```

### 2. `apps/backend-api/services/agentServiceV4.js`

Add case handlers in `_executeFunctionInternal` switch:

```javascript
case 'startVisitRecording': {
  // 1. Validate patientId exists
  // 2. Create patient_visits document with status: "recording"
  // 3. Return visitId + instructions for frontend to start mic
  // 4. Send WebSocket message to frontend: { type: "start_recording", visitId, patientId }
  break;
}

case 'endVisitRecording': {
  // 1. Send "end" to the active WebSocket recording session
  // 2. Trigger Claude summarization
  // 3. Return summary for display
  break;
}

case 'getPatientVisits': {
  // 1. Query patient_visits by patientId (exclude audio binary)
  // 2. Return list of visits with date, status, summary preview
  break;
}
```

### 3. `apps/backend-api/services/agentCapabilityManager.js`

Add visit recording to capability categories:
```javascript
visitRecording: ['startVisitRecording', 'endVisitRecording', 'getPatientVisits']
```

### 4. `apps/backend-api/services/claudeMedicalFunctionGroups.js`

Add keyword group for visit recording:
```javascript
visitRecording: [
  "record visit", "new visit", "start visit", "visit recording",
  "patient encounter", "office visit", "record appointment",
  "start recording", "end visit", "visit history", "past visits",
  "visit summary", "soap note", "clinical encounter"
]
```

---

## Agent Flow Example

```
Doctor: "Hey, I want to record a new visit for John Smith"

Agent thinks:
  1. Search patient "John Smith" → finds patientId
  2. Call startVisitRecording(patientId, "in-person")
  3. Backend creates visit record, status: "recording"
  4. Agent responds: "I've started recording the visit for John Smith.
     Please click the microphone button or I can listen through your browser.
     Say 'end visit' when you're done."

[... recording happens via WebSocket ...]

Doctor: "End the visit"

Agent thinks:
  1. Call endVisitRecording(visitId)
  2. Backend stops recording, generates SOAP note
  3. Agent responds: "Visit recorded. Here's the summary for your review."
  4. Summary appears in artifact panel
```

---

## Verification

- [ ] Agent recognizes "record a visit" / "new visit" keywords
- [ ] Agent resolves patient name to patientId before starting
- [ ] `startVisitRecording` creates document and signals frontend
- [ ] `endVisitRecording` triggers summarization
- [ ] `getPatientVisits` returns history without audio binary
- [ ] Agent tool descriptions registered in aiHelpers.js
- [ ] Function group keywords trigger correct tool selection
