# Artifact Panel State Persistence - Implementation Guide

## Step-by-Step Implementation

### STEP 1: Update MongoDB Schema

**File:** `/apps/backend-api/models/ChatSession.js`

**Change lines 64-69** (after `context` field):

```javascript
  // Session metadata
  isActive: {
    type: Boolean,
    default: true
  },

  // Message count for quick reference
  messageCount: {
    type: Number,
    default: 0
  },

  // Last message timestamp for sorting
  lastMessageAt: {
    type: Date,
    default: Date.now
  },

  // Context for maintaining conversation state
  context: {
    type: Object,
    default: {},
    // Store pending actions, uploads, etc.
  },

  // ARTIFACT PANEL STATE - NEW FIELD
  artifactState: {
    type: Object,
    default: null,
    // Stores per-conversation artifact panel state
    // Structure: {
    //   isOpen: boolean,
    //   patientId: string,
    //   category: string,
    //   documentId: string,
    //   level: string,
    //   gridData: object,
    //   patientName: string,
    //   savedAt: Date
    // }
  },

  // Session summary for search (auto-generated from first few messages)
  summary: {
    type: String,
    default: ''
  }
```

---

### STEP 2: Update Backend Routes

**File:** `/apps/backend-api/routes/chat.js`

#### A. Update GET /api/chat/sessions/:sessionId (line 480-491)

**Change the response from:**
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

**To:**
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
    lastMessageAt: session.lastMessageAt,
    artifactState: session.artifactState || null  // ADD THIS LINE
  }
});
```

#### B. Add new PUT endpoint (after line 975, before router.patch line 978)

```javascript
// PUT /api/chat/sessions/:sessionId/artifact-state - Save artifact panel state
router.put('/sessions/:sessionId/artifact-state', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { sessionId } = req.params;
    const { artifactState } = req.body;
    
    // Validate input
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    if (!artifactState || typeof artifactState !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid artifact state'
      });
    }
    
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && 
      console.log(`💾 [CHAT] Saving artifact state for session: ${sessionId}`);
    
    // Security context for SecureDataAccess
    const context = getSecureContext(req, userId);
    const updateData = {
      $set: {
        artifactState: artifactState,
        updatedAt: new Date()
      }
    };
    
    // First check if session exists
    const sessions = await SecureDataAccess.query('chat_sessions', { sessionId, userId }, {}, context);
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }
    
    // Update the session
    await SecureDataAccess.update('chat_sessions', { sessionId, userId }, updateData, context);
    
    process.env.QUIET_LOGS !== 'true' && secureConfigService.get('NODE_ENV') !== 'production' && 
      console.log(`✅ [CHAT] Saved artifact state for session: ${sessionId}`);
    
    res.json({
      success: true,
      data: { artifactState }
    });
  } catch (error) {
    console.error('❌ [CHAT] Error saving artifact state:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save artifact state',
      error: error.message
    });
  }
});
```

---

### STEP 3: Update Frontend - ChatContainer.js

#### A. Modify State Initialization (lines 101-153)

**IMPORTANT:** The state initialization is lazy-loaded, so it can't directly access `sessionId` which comes from another state. Instead, we'll use a separate effect to restore from DB.

Keep the current initialization as-is for now, but we'll add effects to override it.

#### B. Add New Effect to Fetch Artifact State from Database (after line 207)

Add this new effect after the artifact persistence effects:

```javascript
// Fetch artifact state from database when session changes
useEffect(() => {
  if (!sessionId) {
    // No session loaded yet
    return;
  }
  
  const fetchArtifactStateFromDB = async () => {
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🎨 [CHAT] Fetching artifact state for session:', sessionId);
      }
      
      const response = await secureApi.get(`/api/chat/sessions/${sessionId}`);
      
      if (response.success && response.data?.artifactState) {
        // Restore artifact state from database
        const state = response.data.artifactState;
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('🎨 [CHAT] Restoring artifact state:', {
            isOpen: state.isOpen,
            patientId: state.patientId,
            category: state.category
          });
        }
        
        setArtifactPanelOpen(state.isOpen || false);
        setArtifactPatientId(state.patientId || null);
        setArtifactCategory(state.category || null);
        setArtifactDocumentId(state.documentId || null);
        setArtifactLevel(state.level || 'categories');
        setArtifactGridData(state.gridData || null);
        setArtifactPatientName(state.patientName || null);
        
        // Also update session-specific localStorage as fallback
        localStorage.setItem(`artifactState_${sessionId}_panelOpen`, JSON.stringify(state.isOpen || false));
        localStorage.setItem(`artifactState_${sessionId}_patientId`, state.patientId || '');
        localStorage.setItem(`artifactState_${sessionId}_category`, state.category || '');
        localStorage.setItem(`artifactState_${sessionId}_documentId`, state.documentId || '');
        localStorage.setItem(`artifactState_${sessionId}_level`, state.level || 'categories');
        if (state.gridData) {
          localStorage.setItem(`artifactState_${sessionId}_gridData`, JSON.stringify(state.gridData));
        }
        localStorage.setItem(`artifactState_${sessionId}_patientName`, state.patientName || '');
      } else {
        // No artifact state saved for this session - clear everything
        if (process.env.NODE_ENV !== 'production') {
          console.log('🎨 [CHAT] No artifact state found for session, clearing');
        }
        setArtifactPanelOpen(false);
        setArtifactPatientId(null);
        setArtifactCategory(null);
        setArtifactDocumentId(null);
        setArtifactLevel('categories');
        setArtifactGridData(null);
        setArtifactPatientName(null);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('🎨 [CHAT] Failed to fetch artifact state from DB:', error);
      }
      // Fallback: clear artifact state
      setArtifactPanelOpen(false);
      setArtifactPatientId(null);
      setArtifactCategory(null);
      setArtifactDocumentId(null);
      setArtifactLevel('categories');
      setArtifactGridData(null);
      setArtifactPatientName(null);
    }
  };
  
  fetchArtifactStateFromDB();
}, [sessionId]);
```

#### C. Add New Function to Save Artifact State (after line 500)

Add this function that will be called when artifact state changes:

```javascript
// Save artifact state to database
const saveArtifactStateToDB = useCallback(async () => {
  if (!sessionId) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('🎨 [CHAT] Cannot save artifact state - no sessionId');
    }
    return;
  }
  
  try {
    const artifactStateData = {
      isOpen: artifactPanelOpen,
      patientId: artifactPatientId || null,
      category: artifactCategory || null,
      documentId: artifactDocumentId || null,
      level: artifactLevel || 'categories',
      gridData: artifactGridData || null,
      patientName: artifactPatientName || null,
      savedAt: new Date().toISOString()
    };
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('🎨 [CHAT] Saving artifact state to DB:', artifactStateData);
    }
    
    const response = await secureApi.put(`/api/chat/sessions/${sessionId}/artifact-state`, {
      artifactState: artifactStateData
    });
    
    if (!response.success) {
      console.warn('🎨 [CHAT] Failed to save artifact state:', response);
    }
  } catch (error) {
    console.warn('🎨 [CHAT] Error saving artifact state to DB:', error);
    // Continue - localStorage fallback will work
  }
}, [sessionId, artifactPanelOpen, artifactPatientId, artifactCategory, 
    artifactDocumentId, artifactLevel, artifactGridData, artifactPatientName]);
```

#### D. Update Artifact State Persistence Effects (lines 155-207)

**Replace the effect for `artifactPanelOpen`** (lines 155-162) with:

```javascript
// Persist artifact panel state to database and session-specific localStorage
useEffect(() => {
  try {
    // Save to database
    if (sessionId) {
      saveArtifactStateToDB();
    }
    
    // Also save to session-specific localStorage as fallback
    if (sessionId) {
      localStorage.setItem(`artifactState_${sessionId}_panelOpen`, JSON.stringify(artifactPanelOpen));
    }
  } catch (error) {
    console.error('Failed to save artifactPanelOpen:', error);
  }
}, [artifactPanelOpen, sessionId, saveArtifactStateToDB]);
```

**Replace the effect for `artifactPatientId`** (lines 164-174) with:

```javascript
// Persist artifact patient ID to database and session-specific localStorage
useEffect(() => {
  try {
    // Save to database
    if (sessionId) {
      saveArtifactStateToDB();
    }
    
    // Also save to session-specific localStorage as fallback
    if (sessionId) {
      if (artifactPatientId) {
        localStorage.setItem(`artifactState_${sessionId}_patientId`, artifactPatientId);
      } else {
        localStorage.removeItem(`artifactState_${sessionId}_patientId`);
      }
    }
  } catch (error) {
    console.error('Failed to save artifactPatientId:', error);
  }
}, [artifactPatientId, sessionId, saveArtifactStateToDB]);
```

**Replace the effect for `artifactCategory`** (lines 177-187) with:

```javascript
// Persist artifact category to database and session-specific localStorage
useEffect(() => {
  try {
    // Save to database
    if (sessionId) {
      saveArtifactStateToDB();
    }
    
    // Also save to session-specific localStorage as fallback
    if (sessionId) {
      if (artifactCategory) {
        localStorage.setItem(`artifactState_${sessionId}_category`, artifactCategory);
      } else {
        localStorage.removeItem(`artifactState_${sessionId}_category`);
      }
    }
  } catch (error) {
    console.error('Failed to save artifactCategory:', error);
  }
}, [artifactCategory, sessionId, saveArtifactStateToDB]);
```

**Replace the effect for `artifactDocumentId`** (lines 189-199) with:

```javascript
// Persist artifact document ID to database and session-specific localStorage
useEffect(() => {
  try {
    // Save to database
    if (sessionId) {
      saveArtifactStateToDB();
    }
    
    // Also save to session-specific localStorage as fallback
    if (sessionId) {
      if (artifactDocumentId) {
        localStorage.setItem(`artifactState_${sessionId}_documentId`, artifactDocumentId);
      } else {
        localStorage.removeItem(`artifactState_${sessionId}_documentId`);
      }
    }
  } catch (error) {
    console.error('Failed to save artifactDocumentId:', error);
  }
}, [artifactDocumentId, sessionId, saveArtifactStateToDB]);
```

**Replace the effect for `artifactLevel`** (lines 201-207) with:

```javascript
// Persist artifact level to database and session-specific localStorage
useEffect(() => {
  try {
    // Save to database
    if (sessionId) {
      saveArtifactStateToDB();
    }
    
    // Also save to session-specific localStorage as fallback
    if (sessionId) {
      localStorage.setItem(`artifactState_${sessionId}_level`, artifactLevel);
    }
  } catch (error) {
    console.error('Failed to save artifactLevel:', error);
  }
}, [artifactLevel, sessionId, saveArtifactStateToDB]);
```

**Add new effect for `artifactGridData`** (after artifactLevel effect):

```javascript
// Persist artifact grid data to database and session-specific localStorage
useEffect(() => {
  try {
    // Save to database
    if (sessionId) {
      saveArtifactStateToDB();
    }
    
    // Also save to session-specific localStorage as fallback
    if (sessionId) {
      if (artifactGridData) {
        localStorage.setItem(`artifactState_${sessionId}_gridData`, JSON.stringify(artifactGridData));
      } else {
        localStorage.removeItem(`artifactState_${sessionId}_gridData`);
      }
    }
  } catch (error) {
    console.error('Failed to save artifactGridData:', error);
  }
}, [artifactGridData, sessionId, saveArtifactStateToDB]);
```

**Add new effect for `artifactPatientName`** (after artifactGridData effect):

```javascript
// Persist artifact patient name to database and session-specific localStorage
useEffect(() => {
  try {
    // Save to database
    if (sessionId) {
      saveArtifactStateToDB();
    }
    
    // Also save to session-specific localStorage as fallback
    if (sessionId) {
      if (artifactPatientName) {
        localStorage.setItem(`artifactState_${sessionId}_patientName`, artifactPatientName);
      } else {
        localStorage.removeItem(`artifactState_${sessionId}_patientName`);
      }
    }
  } catch (error) {
    console.error('Failed to save artifactPatientName:', error);
  }
}, [artifactPatientName, sessionId, saveArtifactStateToDB]);
```

#### E. Update handleSessionChange Function (line 2021)

**Replace the function** with:

```javascript
const handleSessionChange = useCallback((newSessionId) => {
  // First, clear artifact state before loading new session
  // The fetch effect will restore the correct state for the new session
  setArtifactPanelOpen(false);
  setArtifactPatientId(null);
  setArtifactCategory(null);
  setArtifactDocumentId(null);
  setArtifactLevel('categories');
  setArtifactGridData(null);
  setArtifactPatientName(null);
  
  // Now load the new session
  setSessionId(newSessionId);
  secureStorage.setItem(getUserStorageKey('current_session_id'), newSessionId);
  loadMessages(newSessionId);

  if (onSessionChange) {
    onSessionChange(newSessionId);
  }

  const storedCost = secureStorage.getItem(getUserStorageKey(`cost_${newSessionId}`));
  if (storedCost) {
    try {
      setCostInfo(JSON.parse(storedCost));
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to restore cost info:', e);
      }
    }
  } else {
    setCostInfo(null);
  }
  
  // The useEffect that watches sessionId will now fetch artifact state from DB
}, [getUserStorageKey, loadMessages, onSessionChange]);
```

---

## Summary of Changes

### Files Modified:
1. **Backend:** 2 files
   - `/apps/backend-api/models/ChatSession.js` - Add schema field
   - `/apps/backend-api/routes/chat.js` - Add endpoint + update response

2. **Frontend:** 1 file
   - `/apps/frontend-vite/src/components/chat/ChatContainer.js` - Update state management

### New Features:
- Artifact state persists per-conversation
- Database as primary storage
- localStorage as fallback cache
- Automatic restore when switching conversations
- Automatic save when state changes

### No Breaking Changes:
- Old sessions without artifactState work fine
- localStorage keys still work as fallback
- Optional field in database

---

## Testing After Implementation

```bash
# 1. Open conversation A
# 2. Open artifact panel, select category X
# 3. Verify in Browser DevTools:
#    - Network tab shows PUT /api/chat/sessions/{id}/artifact-state
#    - Response contains artifactState
# 4. Open MongoDB shell and check:
#    db.chat_sessions.findOne({sessionId: "..."})
#    Should show: artifactState: { isOpen: true, category: "X", ... }
# 5. Switch to conversation B
# 6. Verify artifact panel is closed
# 7. Switch back to conversation A
# 8. Verify artifact panel opens with category X
# 9. Refresh page
# 10. Verify artifact panel still shows category X
```

---

## Code Quality Checklist

- [ ] All new endpoints properly authenticated
- [ ] All new endpoints properly error handled
- [ ] All new effects properly cleaned up (no memory leaks)
- [ ] All dependencies listed in useEffect deps arrays
- [ ] Proper null/undefined checks
- [ ] Console logging only in development
- [ ] No hardcoded values
- [ ] Follows existing code patterns
