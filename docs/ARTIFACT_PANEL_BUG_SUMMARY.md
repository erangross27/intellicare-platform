# Artifact Panel State Persistence - Quick Summary

## The Bug
When switching between conversations in the sidebar, the artifact panel state (open/closed, patient ID, category, document) is lost because it's stored in global localStorage keys instead of per-conversation storage.

## Root Cause
- Artifact panel state uses GLOBAL localStorage keys: `artifactPanelOpen`, `artifactPatientId`, etc.
- These same keys are shared across ALL conversations
- When switching conversations, the previous conversation's artifact state is overwritten or loaded inappropriately

## Files Involved

### Frontend
- **`/apps/frontend-vite/src/components/chat/ChatContainer.js`** (lines 101-207)
  - State variables for artifact panel
  - localStorage persistence effects
  - Session change handler (line 2021)

- **`/apps/frontend-vite/src/components/chat/components/SessionManager.js`** (lines 450-461)
  - Triggers conversation switch

- **`/apps/frontend-vite/src/components/artifact/ArtifactPanel.jsx`**
  - Panel UI component

### Backend
- **`/apps/backend-api/models/ChatSession.js`** (lines 5-73)
  - Chat session schema - has unused `context` field

- **`/apps/backend-api/routes/chat.js`**
  - GET /api/chat/sessions/:sessionId (lines 452-500)
  - PUT /api/chat/sessions/:sessionId/title (lines 923-975)
  - POST /api/chat/sessions (lines 374-450)

## Current State Flow

```
User Switches Conversation
    ↓
SessionManager.js:459 → onSessionChange(newSessionId)
    ↓
ChatContainer.js:2021 → handleSessionChange(newSessionId)
    ↓
setSessionId(newSessionId)
loadMessages(newSessionId)
    ↓
[ARTIFACT STATE NOT UPDATED]
    ↓
ArtifactPanel still has OLD session's state values
```

## Solution Approach

### 1. Database Schema Change
Add `artifactState` field to ChatSession:
```javascript
artifactState: {
  type: Object,
  default: null,
  // Contains: { isOpen, patientId, category, documentId, level, gridData, patientName }
}
```

### 2. New Backend Endpoint
`PUT /api/chat/sessions/:sessionId/artifact-state`
- Save artifact state to database
- Called whenever artifact state changes

### 3. Frontend Changes
- Change localStorage keys to be session-specific: `artifactState_${sessionId}_panelOpen`
- Add effect to fetch artifact state from DB when sessionId changes
- Add effect to save artifact state to DB when state changes
- Clear artifact state when switching sessions (before fetching)

### 4. Data Flow After Fix

```
User Switches to Conversation A
    ↓
handleSessionChange('conversation_A')
    ↓
Clear artifact state (set all to null/false)
loadMessages('conversation_A')
    ↓
sessionId state change triggers useEffect
    ↓
GET /api/chat/sessions/conversation_A
    ↓
Backend returns: { ..., artifactState: { isOpen: true, patientId: "123", ... } }
    ↓
Frontend restores artifact state from database
    ↓
ArtifactPanel opens with correct patient & category
```

## Key Implementation Points

### Frontend (ChatContainer.js)

**1. Session-specific localStorage keys:**
```javascript
// BEFORE:
localStorage.setItem('artifactPanelOpen', value)

// AFTER:
localStorage.setItem(`artifactState_${sessionId}_panelOpen`, value)
```

**2. Add fetch effect when sessionId changes:**
```javascript
useEffect(() => {
  // Fetch session with artifactState from DB
  // Restore all 7 artifact state variables
}, [sessionId]);
```

**3. Add save effect for each state variable:**
```javascript
useEffect(() => {
  // Save to database
  if (sessionId) {
    await secureApi.put(`/api/chat/sessions/${sessionId}/artifact-state`, {...})
  }
  // Also save to session-specific localStorage
}, [artifactPanelOpen, sessionId]);
```

**4. Modify handleSessionChange:**
```javascript
const handleSessionChange = useCallback((newSessionId) => {
  setSessionId(newSessionId);
  loadMessages(newSessionId);
  
  // Clear artifact state before restoring from DB
  setArtifactPanelOpen(false);
  setArtifactPatientId(null);
  // ... clear all 7 fields
  
  // useEffect will fetch from DB when sessionId changes
}, []);
```

### Backend (chat.js)

**1. Update GET /api/chat/sessions/:sessionId response:**
```javascript
res.json({
  success: true,
  data: {
    sessionId: session.sessionId,
    title: session.title,
    artifactState: session.artifactState || null  // ADD THIS
  }
});
```

**2. Add new PUT endpoint:**
```javascript
router.put('/sessions/:sessionId/artifact-state', async (req, res) => {
  // Validate artifactState
  // Update session document
  // Return success response
});
```

## Testing Checklist

- [ ] Open conversation A, show artifact panel with category X
- [ ] Switch to conversation B, verify artifact panel is empty
- [ ] Switch back to conversation A, verify artifact panel shows category X
- [ ] Refresh page while in conversation A, verify artifact panel persists
- [ ] Open multiple conversations with different patients, verify each shows correct data
- [ ] Verify PUT requests appear in browser Network tab
- [ ] Verify artifactState saved in MongoDB

## Performance Impact

- **Database:** +1 small GET request when switching sessions
- **Database Size:** ~200 bytes per session storing artifactState
- **Network:** 1-2 API calls per artifact state change (can be debounced)
- **No Breaking Changes:** artifactState field is optional, backward compatible

## Rollback Plan

If issues arise:
1. Revert code changes to ChatContainer.js
2. Delete the new backend endpoint
3. Don't need to remove artifactState from schema (can leave it dormant)
4. Session-specific localStorage keys already in place as fallback
