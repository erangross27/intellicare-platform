# Artifact Panel State Persistence Bug - Comprehensive Analysis

## Problem Summary

When a user switches conversations in the sidebar, the artifact panel state is lost. The panel either closes or resets to default state when loading a different conversation, even though the previous conversation had an artifact panel open with specific data.

**Current State:** Artifact panel state is stored ONLY in localStorage, which is global/shared across all conversations, not per-conversation.

---

## Current Architecture

### 1. Frontend - Artifact Panel State Storage (ChatContainer.js)

**Location:** `/home/erangross/Development/IntelliCare/apps/frontend-vite/src/components/chat/ChatContainer.js`

**Lines 101-207:** Artifact panel state variables (all persist to localStorage):
```javascript
// State variables (initialized from localStorage)
const [artifactPanelOpen, setArtifactPanelOpen] = useState(() => { ... });
const [artifactPatientId, setArtifactPatientId] = useState(() => { ... });
const [artifactCategory, setArtifactCategory] = useState(() => { ... });
const [artifactDocumentId, setArtifactDocumentId] = useState(() => { ... });
const [artifactLevel, setArtifactLevel] = useState(() => { ... });
const [artifactGridData, setArtifactGridData] = useState(() => { ... });
const [artifactPatientName, setArtifactPatientName] = useState(() => { ... });

// Each state has a useEffect that persists to localStorage
useEffect(() => {
  localStorage.setItem('artifactPanelOpen', JSON.stringify(artifactPanelOpen));
}, [artifactPanelOpen]);

useEffect(() => {
  localStorage.setItem('artifactPatientId', artifactPatientId);
}, [artifactPatientId]);
// ... and so on for each state variable
```

**localStorage keys:**
- `artifactPanelOpen` (boolean)
- `artifactPatientId` (string)
- `artifactCategory` (string)
- `artifactDocumentId` (string)
- `artifactLevel` (string - 'categories', 'documents', 'detail', 'grid')
- `artifactGridData` (JSON object)
- `artifactPatientName` (string)

**PROBLEM:** These keys are the SAME across all conversations. When you switch to a different conversation, the same localStorage keys are used, so you get whatever state was last saved globally.

---

### 2. Conversation Switching Flow

**Location:** `/home/erangross/Development/IntelliCare/apps/frontend-vite/src/components/chat/components/SessionManager.js` (lines 450-461)

**When user clicks a conversation in sidebar:**
```
SessionManager.js:459 → calls onSessionChange(cleanSessionId)
    ↓
ChatContainer.js:2021 → handleSessionChange() is invoked
    ↓
Calls loadMessages(newSessionId) to fetch messages for new conversation
    ↓
localStorage artifact state is NOT cleared
    ↓
ArtifactPanel component is still mounted with OLD state values
```

**The Bug:** When `handleSessionChange()` is called:
1. New session ID is set: `setSessionId(newSessionId)`
2. Messages are loaded: `loadMessages(newSessionId)`
3. Cost info is restored from localStorage
4. **BUT:** The artifact panel state is NOT updated or cleared
5. The global localStorage values still have the OLD conversation's artifact state
6. When user opens the artifact panel for the new conversation, it might show:
   - Old patient ID
   - Old category/document
   - Or if they were cleared, it starts fresh (losing the state)

---

### 3. Backend - Chat Session Schema

**Location:** `/home/erangross/Development/IntelliCare/apps/backend-api/models/ChatSession.js`

**Current Schema (lines 5-73):**
```javascript
const chatSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  language: { type: String, enum: ['en', 'he'], default: 'en' },
  isActive: { type: Boolean, default: true },
  messageCount: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: Date.now },
  context: {
    type: Object,
    default: {},
    // For pending actions, uploads, etc.
  },
  summary: { type: String, default: '' }
}, {
  timestamps: true,  // Adds createdAt and updatedAt
  collection: 'chat_sessions'
});
```

**PROBLEM:** There's a `context` field that can store arbitrary data, but the artifact panel state is NOT being saved here.

---

## Where Conversations Are Saved

### POST /api/chat/sessions - Create Session

**Location:** `/home/erangross/Development/IntelliCare/apps/backend-api/routes/chat.js` (lines 374-450)

Creates a new chat session with:
- `userId`
- `sessionId`
- `title`
- `language`
- `createdAt`
- `isActive: true`
- `messageCount: 0`

No artifact state is saved here.

### GET /api/chat/sessions - List Sessions

**Location:** `/home/erangross/Development/IntelliCare/apps/backend-api/routes/chat.js` (lines 137-360)

Returns list of sessions for user. No artifact state included.

### GET /api/chat/sessions/:sessionId - Get Single Session

**Location:** `/home/erangross/Development/IntelliCare/apps/backend-api/routes/chat.js` (lines 452-500)

Returns single session info:
```javascript
res.json({
  success: true,
  data: {
    sessionId: session.sessionId,
    title: session.title,
    language: session.language,
    messageCount: session.messageCount,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessageAt: session.lastMessageAt
  }
});
```

No artifact state returned.

### PUT /api/chat/sessions/:sessionId/title - Update Title

**Location:** `/home/erangross/Development/IntelliCare/apps/backend-api/routes/chat.js` (lines 923-975)

Only updates title. Does not handle artifact state.

---

## Solution Architecture Needed

### Step 1: Extend Database Schema

Add artifact state to ChatSession model:

```javascript
// In ChatSession.js schema
artifactState: {
  type: Object,
  default: null,
  // Stores per-session artifact panel state:
  // {
  //   isOpen: boolean,
  //   patientId: string,
  //   category: string,
  //   documentId: string,
  //   level: string,
  //   gridData: object,
  //   patientName: string,
  //   savedAt: Date  // Timestamp of when state was saved
  // }
}
```

### Step 2: Add Backend Endpoints

**POST/PUT /api/chat/sessions/:sessionId/artifact-state**
- Save artifact panel state to database
- Called when artifact state changes
- Include all 7 state values

**GET /api/chat/sessions/:sessionId (updated)**
- Return artifactState in response when fetching session

### Step 3: Modify Frontend - Session Loading

When `handleSessionChange()` is called:
1. Fetch the new session details including artifactState
2. If artifactState exists for that session:
   - Restore it: `setArtifactPatientId(artifactState.patientId)`, etc.
   - Open panel if `artifactState.isOpen === true`
3. If no artifactState exists:
   - Clear artifact state (close panel, reset values)

### Step 4: Modify Frontend - State Persistence

Use session-specific localStorage keys as FALLBACK only:
- Primary: Save to database when state changes
- Fallback: Use localStorage for quick restoration before API responds

**New localStorage key format:**
```
artifactState_${sessionId}_panelOpen
artifactState_${sessionId}_patientId
artifactState_${sessionId}_category
artifactState_${sessionId}_documentId
artifactState_${sessionId}_level
artifactState_${sessionId}_gridData
artifactState_${sessionId}_patientName
```

This way, even if database save fails, localStorage acts as per-session cache.

---

## Implementation Details

### Frontend Changes Needed

**In ChatContainer.js:**

1. **Modify state initialization (lines 101-153):**
   ```javascript
   // Change from global localStorage to session-specific
   const [artifactPanelOpen, setArtifactPanelOpen] = useState(() => {
     // Try sessionId-specific key first
     if (sessionId) {
       const saved = localStorage.getItem(`artifactState_${sessionId}_panelOpen`);
       return saved ? JSON.parse(saved) : false;
     }
     return false;
   });
   ```

2. **Add effect to fetch artifact state from database (new):**
   ```javascript
   useEffect(() => {
     if (!sessionId) return;
     
     // Fetch session including artifact state
     const fetchSessionArtifactState = async () => {
       try {
         const response = await secureApi.get(`/api/chat/sessions/${sessionId}`);
         if (response.data?.artifactState) {
           // Restore database state
           setArtifactPanelOpen(response.data.artifactState.isOpen);
           setArtifactPatientId(response.data.artifactState.patientId);
           setArtifactCategory(response.data.artifactState.category);
           // ... etc for all 7 fields
         }
       } catch (error) {
         console.warn('Failed to load artifact state from DB:', error);
         // Fallback to localStorage (per-session)
       }
     };
     
     fetchSessionArtifactState();
   }, [sessionId]);
   ```

3. **Modify persistence effects (lines 155-207):**
   ```javascript
   useEffect(() => {
     try {
       // Save to database
       if (sessionId) {
         saveArtifactStateToDatabase();
       }
       // Also save to session-specific localStorage as fallback
       localStorage.setItem(
         `artifactState_${sessionId}_panelOpen`,
         JSON.stringify(artifactPanelOpen)
       );
     } catch (error) {
       console.error('Failed to save artifact state:', error);
     }
   }, [artifactPanelOpen, sessionId]);
   ```

4. **Add database persistence function (new):**
   ```javascript
   const saveArtifactStateToDatabase = useCallback(async () => {
     try {
       await secureApi.put(`/api/chat/sessions/${sessionId}/artifact-state`, {
         artifactState: {
           isOpen: artifactPanelOpen,
           patientId: artifactPatientId,
           category: artifactCategory,
           documentId: artifactDocumentId,
           level: artifactLevel,
           gridData: artifactGridData,
           patientName: artifactPatientName,
           savedAt: new Date().toISOString()
         }
       });
     } catch (error) {
       console.warn('Failed to save artifact state to DB:', error);
       // Continue - localStorage fallback will work
     }
   }, [sessionId, artifactPanelOpen, artifactPatientId, artifactCategory, 
       artifactDocumentId, artifactLevel, artifactGridData, artifactPatientName]);
   ```

5. **Modify handleSessionChange (line 2021):**
   ```javascript
   const handleSessionChange = useCallback((newSessionId) => {
     setSessionId(newSessionId);
     secureStorage.setItem(getUserStorageKey('current_session_id'), newSessionId);
     
     // Load messages AND restore artifact state
     loadMessages(newSessionId);
     
     // Clear artifact state - let the useEffect restore it from DB
     setArtifactPanelOpen(false);
     setArtifactPatientId(null);
     setArtifactCategory(null);
     // ... clear all 7 fields
     
     // Then fetch from DB (useEffect will trigger due to sessionId change)
     
     if (onSessionChange) {
       onSessionChange(newSessionId);
     }
   }, [...deps, sessionId]);
   ```

---

### Backend Changes Needed

**In chat.js routes:**

1. **Add new endpoint - PUT /api/chat/sessions/:sessionId/artifact-state**
   ```javascript
   router.put('/sessions/:sessionId/artifact-state', async (req, res) => {
     try {
       const userId = getUserId(req);
       const { sessionId } = req.params;
       const { artifactState } = req.body;
       
       // Validate
       if (!artifactState || typeof artifactState !== 'object') {
         return res.status(400).json({
           success: false,
           message: 'Invalid artifactState'
         });
       }
       
       const context = getSecureContext(req, userId);
       const updateData = {
         $set: {
           artifactState: artifactState,
           updatedAt: new Date()
         }
       };
       
       // Update session
       await SecureDataAccess.update('chat_sessions', 
         { sessionId, userId }, 
         updateData, 
         context
       );
       
       res.json({
         success: true,
         data: { artifactState }
       });
     } catch (error) {
       console.error('Error updating artifact state:', error);
       res.status(500).json({
         success: false,
         message: 'Failed to update artifact state',
         error: error.message
       });
     }
   });
   ```

2. **Update GET /api/chat/sessions/:sessionId (lines 452-500)**
   ```javascript
   // Add artifactState to response:
   res.json({
     success: true,
     data: {
       sessionId: session.sessionId,
       title: session.title,
       language: session.language,
       messageCount: session.messageCount,
       createdAt: session.createdAt,
       updatedAt: session.updatedAt,
       lastMessageAt: session.lastMessageAt,
       artifactState: session.artifactState || null  // ADD THIS
     }
   });
   ```

3. **Update GET /api/chat/sessions (list) (lines 137-360)**
   - Decide if artifact state should be included in list view
   - Probably NOT needed for performance reasons
   - Only needed when loading a single session

---

## Data Flow After Implementation

### User Switches to Conversation A
1. Click conversation in sidebar
2. `handleSessionChange('conversation_A')` is called
3. Clear artifact state (set to null/false)
4. Load messages for conversation_A
5. SessionId state change triggers useEffect
6. Makes GET `/api/chat/sessions/conversation_A`
7. Receives artifact state from DB (if it exists)
8. Sets artifact state variables with DB values
9. Panel opens/displays with correct patient and category

### User Opens Artifact Panel (First Time)
1. Opens panel
2. Selects category, patient, etc.
3. Each state change triggers useEffect
4. Makes PUT `/api/chat/sessions/{sessionId}/artifact-state`
5. Saves all 7 state variables to DB
6. Also saves to session-specific localStorage as fallback

### User Refreshes Page (while on Conversation A)
1. Page loads
2. Session ID restored from secureStorage
3. Artifact state initialization reads session-specific localStorage
4. Messages loaded from DB
5. useEffect fetches session from DB (overwrites localStorage with DB)
6. DB values take precedence
7. Panel restores to exact state before refresh

---

## Files to Modify

### Backend
1. `/home/erangross/Development/IntelliCare/apps/backend-api/models/ChatSession.js`
   - Add `artifactState` field to schema

2. `/home/erangross/Development/IntelliCare/apps/backend-api/routes/chat.js`
   - Add PUT `/api/chat/sessions/:sessionId/artifact-state` endpoint
   - Update GET `/api/chat/sessions/:sessionId` to return artifactState

### Frontend
1. `/home/erangross/Development/IntelliCare/apps/frontend-vite/src/components/chat/ChatContainer.js`
   - Modify state initialization (lines 101-153)
   - Modify persistence effects (lines 155-207)
   - Add database fetch effect (new)
   - Add database persistence function (new)
   - Modify handleSessionChange (line 2021)
   - Update localStorage keys to be session-specific

---

## Testing Strategy

1. **Test Case 1: Switch Conversations**
   - Open conversation A
   - Open artifact panel, navigate to category X
   - Switch to conversation B
   - Verify artifact panel is closed/reset
   - Switch back to conversation A
   - Verify artifact panel opens with category X

2. **Test Case 2: Page Refresh**
   - Open artifact panel in conversation A
   - Select category X, document Y
   - Refresh page
   - Verify panel is still open with same category/document

3. **Test Case 3: Multiple Patients**
   - Open conversation A, show data for patient X
   - Open conversation B, show data for patient Y
   - Switch between conversations
   - Verify each shows the correct patient's data in artifact panel

4. **Test Case 4: Database Persistence**
   - Open artifact panel
   - Check browser DevTools → Network to verify PUT request to `/artifact-state`
   - Verify MongoDB contains artifactState field with correct values

5. **Test Case 5: Fallback to localStorage**
   - Disable network access
   - Open artifact panel
   - Verify it still saves to localStorage (session-specific keys)
   - Restore network
   - Verify DB sync works after reconnection

---

## Risk Mitigation

1. **Database Size Impact:**
   - artifactState is a small object (~200 bytes)
   - Only stored when artifact panel is active
   - Minimal impact on collection size

2. **Backward Compatibility:**
   - artifactState defaults to null
   - Old sessions without artifactState work fine (panel just opens empty)
   - No migration needed - field is optional

3. **Performance:**
   - Additional GET request when switching sessions (acceptable)
   - PUT request throttled to only when state actually changes
   - Can add debouncing if frequency is issue

4. **Rollback Plan:**
   - If issues arise, can revert to global localStorage
   - Data already there for fallback
   - No schema changes are breaking

---

## Optional Enhancements

1. **Debounce Database Saves:**
   - Don't save to DB on every state change
   - Wait 1-2 seconds after last change before persisting
   - Reduces database load

2. **Persist to Conversation Messages:**
   - Instead of separate artifactState field
   - Store as part of context or metadata
   - More integrated approach

3. **Clear Artifact State on Session Delete:**
   - When user deletes a conversation
   - Clean up associated artifact state
   - Prevent orphaned data

4. **Artifact State History:**
   - Keep history of artifact states
   - User can revert to previous views
   - Audit trail of browsing behavior

