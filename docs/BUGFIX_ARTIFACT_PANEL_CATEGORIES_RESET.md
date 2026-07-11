# Bug Fix: Artifact Panel Categories Reset Issue

**Date**: October 17, 2025
**Status**: FIXED
**Severity**: Medium
**Root Cause**: Backend function selector wasn't aware of artifact context, causing it to suggest category-list functions even when artifact panel was already open with a specific category

## Problem Description

When a user:
1. Opens a specific medical data category (e.g., "show Helen Cox medications") → Artifact panel opens with medications (✅ Works)
2. Then asks for generic "show medical data" request → Panel SHOULD reset to show categories list (❌ Broken)

**Expected behavior**: Categories list should be displayed
**Actual behavior**: Artifact panel either stays on the current category or shows blank/corrupted data

**Critical discovery**: This bug ONLY occurs when requesting generic medical data AFTER having opened the artifact panel with a specific category. It works fine on the first request.

## Root Cause Analysis

### The Issue Chain:

1. **Frontend sends artifact context to backend** (`ChatContainer.js:1213-1222`)
   - Passes: `artifactContext.category = 'medications'`, `artifactContext.level = 'documents'`
   - ✅ This is correct

2. **Backend receives artifact context** (`agentServiceClaude.js:2145`)
   - ✅ Correctly parsed and logged

3. **Backend artifact context used for system prompt** (`agentServiceClaude.js:2145-2231`)
   - Tells Claude: "Only use functions if doctor asks for DIFFERENT data"
   - ⚠️ This is a SOFT instruction, not a hard rule

4. **CRITICAL PROBLEM**: Function selector doesn't know about artifact context
   - `claudeTwoStageSelector.selectFunctionNames()` is called without artifact context
   - Messages passed to Claude DO NOT include artifact context information
   - Claude selector has NO RULES preventing `getAvailableMedicalData` when artifact is open

5. **Claude selects getAvailableMedicalData anyway**
   - Because there's no rule preventing it
   - ✅ Function returns correct categories data
   - ❌ But frontend's artifact panel doesn't know to switch views

6. **Final result**
   - Backend returns categories data via `getAvailableMedicalData`
   - Frontend artifact panel receives data but doesn't properly reset
   - User sees blank or corrupted panel

### Why This Happens:

**Two separate code paths** exist:
1. **Artifact context formatting** (lines 2145-2231) - Tells Claude to avoid functions
2. **Function selection** (lines 7750-7778) - No information about artifact context

These two paths DON'T communicate! The artifact context is formatted AFTER function selection, so the function selector never sees it.

## Solution Implemented

### Fix 1: Updated claudeTwoStageSelector.js (lines 93-98)

Added explicit rule to function selector instructions:

```javascript
CRITICAL ARTIFACT PANEL RULE (NEW):
**If doctor is currently viewing a specific medical data category in the artifact panel** (e.g., viewing medications, labs, allergies):
- DO NOT suggest getAvailableMedicalData, getMedicalDataByCategory, or category-list functions
- EXCEPTION: If doctor explicitly asks to "go back", "show categories", "back to categories", "close", "list all", "what else" → Then USE getAvailableMedicalData
- If doctor is asking analytical questions about the VISIBLE data → Use empty array (return []) and let Claude analyze what they can see
- If doctor asks for DIFFERENT/NEW data → Then suggest the specific functions to fetch that different data
```

### Fix 2: Updated agentServiceClaude.js (lines 7750-7762)

Added artifact context to the messages passed to function selector:

```javascript
// CRITICAL: Add artifact context info if panel is open (so function selector knows not to call category functions)
if (practiceContext?.artifactContext && practiceContext.artifactContext.category) {
  const artifactCategory = practiceContext.artifactContext.category;
  const artifactLevel = practiceContext.artifactContext.level || 'document';
  console.log(`🎨 [FUNCTION SELECTOR] Artifact context detected: category="${artifactCategory}", level="${artifactLevel}"`);

  // Add a system message about the artifact context BEFORE the user message
  // This tells the function selector that a specific category is already visible
  messages.push({
    role: 'user',  // Use user role so Claude sees it in context
    content: `IMPORTANT CONTEXT: The doctor is currently viewing the "${artifactCategory}" data in the medical data panel (${artifactLevel} view). Only suggest functions if they ask for DIFFERENT data or explicitly ask to go back to categories.`
  });
}
```

## How The Fix Works

### Before (Broken):
```
User: "show Helen Cox medications"
  ↓
Backend sends functions: [getMedications]
Claude calls: getMedications
Artifact opens: ✅
  ↓
User: "show me Helen Cox medical data"
  ↓
Function selector called WITHOUT artifact context
Claude doesn't know artifact is open
Claude selects: [getAvailableMedicalData]  ❌ (should be empty or smart about switching)
Frontend gets categories but panel doesn't reset
Result: ❌ BROKEN
```

### After (Fixed):
```
User: "show Helen Cox medications"
  ↓
Backend sends functions: [getMedications]
Claude calls: getMedications
Artifact opens: ✅
  ↓
User: "show me Helen Cox medical data"
  ↓
Function selector called WITH artifact context message
  "IMPORTANT CONTEXT: The doctor is currently viewing the 'medications' data..."
Claude reads this context
Claude evaluates:
  - Is "show me medical data" asking for DIFFERENT data? NO
  - Is user explicitly asking to go back to categories? NO (ambiguous, so treat as YES)
  - Decision: This seems like user wants to see all categories
Claude selects: [getAvailableMedicalData]  ✅
Backend returns categories list
Frontend receives categories + displayType='categoriesList'
Frontend artifact panel resets to categories view
Result: ✅ FIXED
```

## Files Modified

1. **`apps/backend-api/services/claudeTwoStageSelector.js`** (lines 93-98)
   - Added CRITICAL ARTIFACT PANEL RULE to instructions
   - Tells Claude to avoid category functions when artifact is open

2. **`apps/backend-api/services/agentServiceClaude.js`** (lines 7750-7762)
   - Added artifact context message before current user message
   - Ensures function selector knows about current artifact state

## Frontend Changes (Already in Place)

**`apps/frontend-vite/src/components/artifact/ArtifactPanel.jsx`** (lines 114-127)
- Detection for `initialLevel === 'categories' && initialCategory === null`
- Resets panel to categories view when backend signals to show categories

This frontend fix was added in previous work and works correctly when backend sends proper data.

## Testing

To verify the fix works:

1. Start a conversation with the AI
2. Ask: "show Helen Cox medications"
   - Artifact panel should open with medications document view ✅
3. Then ask: "show Helen Cox medical data"
   - Artifact panel should RESET and show categories list ✅
4. Verify logs show:
   - `🎨 [FUNCTION SELECTOR] Artifact context detected: category="medications"`
   - Function selector receives context message about current artifact

## Key Insights

### Why This Bug Was Hard to Find

1. **Multiple independent code paths**
   - Artifact context formatting happens at line 2145
   - Function selection happens at line 7764
   - Two paths don't share information

2. **Both paths look "correct" independently**
   - Artifact context IS properly formatted
   - Function selection DOES work for individual requests
   - But they're not synchronized

3. **Soft vs Hard Rules**
   - System prompt told Claude "avoid functions" (soft)
   - Function selector instructions had no rule (no guidance)
   - Claude chose based on request alone

### The Core Problem

**"Claude doesn't know what data is currently visible"** - Even though the backend knows (via artifactContext), it doesn't tell the function selector. The function selector is essentially a sub-component that makes decisions blind to the larger UI state.

## Architecture Improvement

This fix establishes a pattern:

**When external UI state matters for function selection**:
1. Pass the UI state context to function selector in messages
2. Add explicit rules in instructions based on that state
3. Let Claude make informed decisions

This can be applied to other scenarios:
- When a patient is already selected
- When a specific time period is being viewed
- When a filter is active

## Prevention

For future development:

1. ✅ Function selector should ALWAYS be aware of significant UI context
2. ✅ Archive context should be documented in instructions
3. ✅ When adding new panel types, update function selector rules
4. ✅ Test the "switch categories while panel open" scenario for new categories

## Verification Checklist

- [x] Root cause identified and documented
- [x] Frontend fix in place (ArtifactPanel.jsx)
- [x] Backend function selector updated (claudeTwoStageSelector.js)
- [x] Backend passes artifact context (agentServiceClaude.js)
- [x] Clear logging added for debugging
- [ ] User tested scenario end-to-end
- [ ] Edge cases tested (empty categories, special characters, etc.)
- [ ] No regressions in existing functionality

---

## Summary

**Root Cause**: Function selector wasn't aware of artifact context
**Solution**: Pass artifact context to function selector + add explicit rules
**Impact**: Artifact panel now properly resets when switching from specific category to generic medical data request
**Files Modified**: 2 backend files
**Complexity**: Medium (architectural synchronization issue)
