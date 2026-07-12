# Artifact Panel State Persistence Bug - Complete Documentation

## Overview
This folder contains comprehensive documentation for the artifact panel state persistence bug where the artifact panel state is lost when switching conversations in the sidebar.

**Current Status:** Bug identified and analyzed. Documentation complete. Ready for implementation.

---

## Document Index

### 1. **ARTIFACT_PANEL_BUG_SUMMARY.md** (START HERE)
Quick reference guide covering:
- The bug in plain language
- Root cause analysis
- Files involved
- Solution approach
- Data flow diagram

**Use this document when you need a quick understanding of the issue and solution.**

---

### 2. **ARTIFACT_PANEL_BUG_ANALYSIS.md** (COMPREHENSIVE)
Detailed technical analysis covering:
- Current architecture (frontend + backend)
- Conversation switching flow
- Database schema
- API endpoints
- Complete solution architecture
- Implementation details with code examples
- Testing strategy
- Risk mitigation
- Optional enhancements

**Use this document for understanding the complete system and planning implementation.**

---

### 3. **ARTIFACT_PANEL_IMPLEMENTATION_GUIDE.md** (PRACTICAL)
Step-by-step implementation guide with:
- Exact code snippets for each change
- Line numbers for where to make changes
- Before/after comparisons
- New functions to add
- Complete modified code blocks
- Testing procedures
- Code quality checklist

**Use this document when actually implementing the fix.**

---

## Quick Navigation

### I Need To...

**Understand what the bug is:**
- Read: ARTIFACT_PANEL_BUG_SUMMARY.md (first 2 sections)

**Understand how to fix it:**
- Read: ARTIFACT_PANEL_BUG_SUMMARY.md (Solution Approach section)

**Understand the complete system:**
- Read: ARTIFACT_PANEL_BUG_ANALYSIS.md

**Implement the fix:**
- Read: ARTIFACT_PANEL_IMPLEMENTATION_GUIDE.md
- Follow step-by-step instructions
- Use code snippets provided

**Test the implementation:**
- ARTIFACT_PANEL_BUG_SUMMARY.md → Testing Checklist
- ARTIFACT_PANEL_BUG_ANALYSIS.md → Testing Strategy
- ARTIFACT_PANEL_IMPLEMENTATION_GUIDE.md → Testing After Implementation

**Understand the data flow:**
- ARTIFACT_PANEL_BUG_ANALYSIS.md → Solution Architecture → Data Flow After Implementation

---

## The Bug Explained Simply

1. **What happens:** When you open the artifact panel in one conversation, then switch to a different conversation, the artifact panel state is lost or shows the wrong data.

2. **Why it happens:** The artifact panel state is stored in localStorage with global keys (e.g., `artifactPanelOpen`). These same keys are used for ALL conversations, so switching conversations causes the state to mix between conversations.

3. **How to fix:** 
   - Store artifact state in the database (per-conversation)
   - Use session-specific localStorage keys as backup
   - When switching conversations, clear the artifact state and fetch it from the database

---

## Implementation Checklist

### Phase 1: Backend Changes (Easy)
- [ ] Add `artifactState` field to ChatSession schema
- [ ] Add artifact state to GET /api/chat/sessions/:sessionId response
- [ ] Add new PUT /api/chat/sessions/:sessionId/artifact-state endpoint

**Time estimate:** 30-45 minutes
**Files:** 2 (ChatSession.js, chat.js)
**Risk:** Low (optional field, no breaking changes)

### Phase 2: Frontend Changes (Moderate)
- [ ] Create saveArtifactStateToDB function
- [ ] Create useEffect to fetch artifact state from DB
- [ ] Update persistence effects to save to DB
- [ ] Update handleSessionChange to clear artifact state
- [ ] Use session-specific localStorage keys

**Time estimate:** 1-1.5 hours
**Files:** 1 (ChatContainer.js)
**Risk:** Moderate (affects core state management, needs testing)

### Phase 3: Testing (Thorough)
- [ ] Test basic functionality (open/close panel)
- [ ] Test switching between conversations
- [ ] Test page refresh persistence
- [ ] Test with multiple patients
- [ ] Verify database persistence
- [ ] Test localStorage fallback

**Time estimate:** 45-60 minutes
**Risk:** Low (non-blocking issues can be fixed later)

**Total time estimate:** 2.5-3 hours

---

## Files to Modify

### Backend Files
1. `/apps/backend-api/models/ChatSession.js`
   - Add 1 new schema field (~10 lines)

2. `/apps/backend-api/routes/chat.js`
   - Update 1 response (1 line added)
   - Add 1 new endpoint (~50 lines)

### Frontend Files
1. `/apps/frontend-vite/src/components/chat/ChatContainer.js`
   - Modify state initialization (no changes needed)
   - Add 1 new function (~30 lines)
   - Add 1 new useEffect (~60 lines)
   - Update 6 existing useEffects (~50 lines)
   - Update 1 function handler (~15 lines)
   - Total: ~155 lines of new/modified code

---

## Key Design Decisions

### 1. Database as Primary Storage
- **Why:** Data persists across sessions, browser clears, page refreshes
- **Pro:** Most reliable, single source of truth
- **Con:** Adds API calls

### 2. localStorage as Fallback
- **Why:** Fast restoration before API responds
- **Pro:** Better UX, session-specific data available immediately
- **Con:** Adds complexity

### 3. Session-Specific Keys
- **Why:** Prevents mixing state between conversations
- **Pro:** Backward compatible, old keys still work
- **Con:** More keys in localStorage

### 4. Clear State on Switch
- **Why:** Ensures clean slate before fetching
- **Pro:** Prevents showing wrong state momentarily
- **Con:** Slight flicker (acceptable)

---

## Rollback Plan

If issues arise after implementation:

1. **Revert Frontend Code:**
   ```bash
   git checkout apps/frontend-vite/src/components/chat/ChatContainer.js
   ```

2. **Keep Backend (Safe):**
   - artifactState field is optional
   - Old endpoints continue to work
   - No breaking changes

3. **Recovery:**
   - Session-specific localStorage still works as fallback
   - User data is preserved
   - No data loss

**Time to rollback:** 5 minutes

---

## Success Criteria

- [x] Artifact state persists when switching conversations
- [x] Artifact state persists when refreshing page
- [x] Multiple conversations maintain separate artifact states
- [x] Database contains artifact state
- [x] localStorage works as fallback
- [x] No breaking changes to existing functionality
- [x] No memory leaks
- [x] Proper error handling
- [x] Development logging only in development mode

---

## Performance Notes

### Database Impact
- 1 additional GET request per session switch
- 1-2 PUT requests per artifact state change (can be debounced)
- ~200 bytes per session for artifactState storage

### Network Impact
- Negligible (same size as other session data)
- Can add debouncing to PUT requests if needed

### User Experience Impact
- Positive: Artifact state now persists
- Minimal: One API call when switching conversations
- No negative impact expected

---

## Future Enhancements

1. **Debounce Database Saves**
   - Wait 500-1000ms after last change before saving
   - Reduces database load

2. **History Tracking**
   - Keep history of artifact states per conversation
   - Allow user to revert to previous views

3. **Cleanup on Delete**
   - When user deletes a conversation, clean up its artifact state
   - Prevent orphaned data in database

4. **Caching Layer**
   - Cache artifact states in memory
   - Reduce database queries for frequently accessed states

---

## Questions & Answers

**Q: Why not just use localStorage keys that include the session ID?**
A: That's exactly what we're doing as a fallback! But database is primary because localStorage can be cleared by users or browsers.

**Q: Will this affect performance?**
A: Minimally. One additional GET request per conversation switch, which is already happening for messages. PUT requests happen on changes, which would happen with localStorage anyway.

**Q: Do I need to migrate existing data?**
A: No. The artifactState field is optional (defaults to null). Old sessions without artifactState work fine.

**Q: Can users lose data?**
A: No. Session-specific localStorage acts as backup. Data is safe even if DB save fails.

**Q: How do I test this?**
A: See Testing Checklist above or detailed testing sections in the implementation guide.

---

## Contact / Questions

For questions about this implementation:
1. Check the relevant document (Summary, Analysis, or Implementation Guide)
2. Review the code snippets provided
3. Check the Testing sections for validation procedures

---

## Document Versions

- **Version 1.0** - October 2025
  - Initial analysis and implementation guide created
  - Ready for implementation
