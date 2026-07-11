# Task 6: Frontend — Full Sentence Autocomplete

**Priority:** MEDIUM — Cool feature, can be built after core recording works
**Estimated files:** 2 new, 2 modified
**Dependencies:** Task 4 (needs patient context from chat), independent of recording

---

## What to Build

GitHub Copilot-style autocomplete for medical notes. When the doctor types in the chat input, AI predicts the rest of the sentence based on:
- What the doctor has typed so far
- Patient's medical history
- Current visit transcript (if recording)
- Common medical phrases

---

## How It Works

```
Doctor types: "Patient presents with chest"
                                          ↓ (300ms debounce)
                           Backend API call with context
                                          ↓
                         Claude Haiku 4.5 predicts:
                         " pain radiating to left arm, onset 2 hours ago"
                                          ↓
Ghost text appears:  "Patient presents with chest| pain radiating to left arm..."
                                   cursor ↑        ↑ gray ghost text

Doctor presses Tab → text accepted, becomes real text
Doctor keeps typing → ghost text disappears, new prediction after debounce
Doctor presses Escape → ghost text dismissed
```

---

## Files to Create

### 1. `apps/frontend-vite/src/hooks/useAutocomplete.js`

**Purpose:** Custom React hook that manages autocomplete predictions.

**API:**
```javascript
const {
  suggestion,       // the predicted text (string or null)
  isLoading,        // prediction in progress
  acceptSuggestion, // call to accept (Tab key)
  dismissSuggestion // call to dismiss (Escape key)
} = useAutocomplete({
  text,             // current input text
  cursorPosition,   // where the cursor is
  patientContext,   // patient medical history
  visitTranscript,  // current visit transcript (if recording)
  enabled,          // toggle on/off
  debounceMs: 300,  // wait before requesting
});
```

**Internal logic:**
1. Debounce: wait 300ms after last keystroke
2. Minimum text: only predict after 10+ characters typed
3. Only predict at end of text (cursor at end)
4. Cancel previous request if new text arrives
5. Cache recent predictions (avoid duplicate API calls)
6. Max 1 concurrent request

### 2. `apps/backend-api/routes/autocomplete.js`

**Endpoint:** `POST /api/autocomplete/predict`

**Request:**
```json
{
  "text": "Patient presents with chest",
  "patientId": "...",
  "visitTranscript": "...",
  "maxTokens": 50
}
```

**Response:**
```json
{
  "prediction": " pain radiating to left arm, onset 2 hours ago",
  "confidence": 0.85
}
```

**Backend logic:**
1. Load patient's recent medical history (medications, diagnoses, allergies)
2. Build Claude Haiku 4.5 prompt:
   ```
   System: You are a medical autocomplete assistant. Complete the doctor's
   sentence naturally. Return ONLY the completion text, nothing else.
   Keep completions under 30 words. Use medical terminology appropriate
   for clinical notes.

   Patient context: [age, conditions, medications]
   Visit transcript so far: [if available]

   Doctor is typing: "Patient presents with chest"
   Complete this →
   ```
3. Return prediction text
4. Use streaming for faster first-token response

---

## Files to Modify

### 3. `apps/frontend-vite/src/components/chat/MessageInput.js`

**Changes:**
- Import and use `useAutocomplete` hook
- Render ghost text after cursor position:
  ```jsx
  <div className="input-with-autocomplete">
    <textarea value={text} onChange={...} onKeyDown={handleKeyDown} />
    {suggestion && (
      <span className="autocomplete-ghost">{suggestion}</span>
    )}
  </div>
  ```
- Key handlers:
  - `Tab` → accept suggestion (insert into text)
  - `Escape` → dismiss suggestion
  - Any other key → clear suggestion, trigger new prediction after debounce
- Ghost text positioning: overlay that appears right after the last character

### 4. `apps/backend-api/services/routeLoaderService.js`

Register route:
```javascript
{ path: '/api/autocomplete', file: './routes/autocomplete', auth: 'inline' }
```

---

## Performance Considerations

- **Model:** Claude Haiku 4.5 (fastest, cheapest — ~100ms response for short completions)
- **Debounce:** 300ms prevents excessive API calls
- **Cancel:** AbortController cancels in-flight requests when text changes
- **Cache:** LRU cache of recent predictions (same prefix → same prediction)
- **Disable during recording:** When voice recording is active, autocomplete is off (doctor isn't typing)
- **Cost:** ~$0.001 per prediction (Haiku is very cheap)

---

## Verification

- [ ] Ghost text appears after typing 10+ characters and waiting 300ms
- [ ] Ghost text is gray/translucent, positioned after cursor
- [ ] Tab key accepts the suggestion
- [ ] Escape key dismisses the suggestion
- [ ] Typing more characters triggers new prediction
- [ ] Predictions are contextual (reference patient conditions)
- [ ] No predictions while voice recording is active
- [ ] Debounce prevents excessive API calls
- [ ] AbortController cancels stale requests
- [ ] Works smoothly without lag in the typing experience
