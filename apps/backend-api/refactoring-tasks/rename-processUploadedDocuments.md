# Rename Task: processUploadedDocuments → analyzeUploadedDocuments

**Date**: 2025-10-08
**Reason**: Function name is ambiguous for Claude's Two-Stage Selector. Stage 1 only sees function NAMES (not descriptions), and "processUploadedDocuments" doesn't clearly indicate AI analysis. New name "analyzeUploadedDocuments" is more explicit.

**Impact**: This rename will fix the function selection issue where Claude picks `previewPendingDocument` instead of the actual analysis function.

---

## Files to Update (10 total)

### ✅ CHECKPOINT 1: Core Function Definition ✅ COMPLETED
- [x] **documentService.js** (3 locations)
  - [x] Line 75: Function definition `async analyzeUploadedDocuments(params, practiceContext, session)`
  - [x] Line 583: Error logging `console.error('Error in analyzeUploadedDocuments:', error)`
  - [x] Line 924: Comment reference updated

### ✅ CHECKPOINT 2: Function Routing ✅ COMPLETED
- [x] **agentServiceV4.js** (1 location)
  - [x] Line 1102-1103: Case statement `case 'analyzeUploadedDocuments': return await documentService.analyzeUploadedDocuments(...)`

### ✅ CHECKPOINT 3: Claude Function Registry (CRITICAL) ✅ COMPLETED
- [x] **aiHelpers.js** (2 locations)
  - [x] Line 193: Display name updated to `analyzeUploadedDocuments`
  - [x] Line 1174: Function definition name `name: "analyzeUploadedDocuments"`

### ✅ CHECKPOINT 4: Two-Stage Selector (CRITICAL) ✅ COMPLETED
- [x] **claudeTwoStageSelector.js** (2 locations)
  - [x] Line 101: Stage 1 high-priority list updated
  - [x] Line 423: Function name mapping `'analyzeUploadedDocuments': 'analyzeUploadedDocuments'`

### ✅ CHECKPOINT 5: Agent Service Integration ✅ COMPLETED
- [x] **agentServiceClaude.js** (6 locations)
  - [x] Line 587: Comment about forcing selection
  - [x] Line 2576: Special formatting handler `if (content.name === 'analyzeUploadedDocuments'`
  - [x] Line 5037: Hebrew system prompt instruction
  - [x] Line 5110: Hebrew documentation reference
  - [x] Line 5221: English documentation reference
  - [x] Line 5355: Comment mention

### ✅ CHECKPOINT 6: Learning & Capabilities ✅ COMPLETED
- [x] **selfImprovingMemory.js** (2 locations)
  - [x] Line 39: Doctor role function preferences
  - [x] Line 55: Secretary role function preferences

- [x] **agentCapabilityManager.js** (1 location)
  - [x] Line 238: Documents capability function list

### ✅ CHECKPOINT 7: Selectors & Routes ✅ COMPLETED
- [x] **keywordFunctionSelector.js** (1 location)
  - [x] Line 128: Keyword-based selection list

- [x] **routes/agent.js** (1 location)
  - [x] Line 3627: Display name for frontend

- [x] **medicalHelpers.js** (1 location)
  - [x] Line 97: Medical helper functions list

---

## Files to SKIP (Not in Production)

### Refactoring Scripts (historical, not used)
- `apps/backend-api/refactoring-tasks/extract-functions.js:68`
- `apps/backend-api/refactoring-tasks/remove-functions-node.js:21`
- `apps/backend-api/refactoring-tasks/remove-functions-ast.js:25`

### Backup/Temp Files
- `temp-agent.js` (lines 1892, 9488, 9489, 24191, 24672)

---

## Rename Pattern

**OLD**: `processUploadedDocuments`
**NEW**: `analyzeUploadedDocuments`

**Search & Replace Rules**:
1. Function names: `processUploadedDocuments` → `analyzeUploadedDocuments`
2. Comments/strings: Keep descriptive context, just update name
3. Display names: Update Hebrew/English accordingly
4. Case-sensitive replacement only

---

## Post-Rename Verification

- [ ] Run backend server and check for errors
- [ ] Test function selection with user message "analyze the document"
- [ ] Verify Claude selects `analyzeUploadedDocuments` (not `previewPendingDocument`)
- [ ] Check logs to confirm proper function execution
- [ ] Verify Hebrew/English display names work correctly

---

## Expected Outcome

**Before**: Claude selects `retrievePendingUpload` + `previewPendingDocument` (2 functions)
**After**: Claude selects `retrievePendingUpload` + `analyzeUploadedDocuments` (correct behavior)

**Reason it will work**: Two-Stage Selector Stage 1 only sees function NAMES. "analyzeUploadedDocuments" contains the keyword "analyze" which matches user intent more clearly than "processUploadedDocuments".

---

## Status: ✅ COMPLETED
**Last Updated**: 2025-10-08
**Updated By**: Claude Code Assistant

**Completion Summary**:
- ✅ All 7 checkpoints completed
- ✅ 10 production files updated (19 total occurrences)
- ✅ Function renamed from `processUploadedDocuments` → `analyzeUploadedDocuments`
- ⏳ Awaiting verification testing
