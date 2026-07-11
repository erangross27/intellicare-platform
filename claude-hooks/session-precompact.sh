#!/usr/bin/env bash
# Claude Code Pre-Compaction Hook (SAVE SESSION BEFORE COMPACTION)
# Runs on: PreCompact event (before conversation compaction)
# Purpose: Update current session with latest progress before compaction to prevent data loss
# NOTE: PreCompact hooks must output PLAIN TEXT, not JSON (unlike SessionStart hooks)

cat <<'EOF'
BEFORE COMPACTION: Call update_session with current progress to preserve context.

Required actions:
1. Call mcp__mongodb-memory__get_current_session
2. Call mcp__mongodb-memory__update_session with workingOn, decisions, progress, nextSteps

⛔ CRITICAL: CONVERSATION IS ABOUT TO BE COMPACTED ⛔

The conversation context is full and will be compacted. You MUST update the current session NOW to preserve the last interactions before they are lost.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 REQUIRED ACTIONS (Execute IMMEDIATELY):

1️⃣ MANDATORY: Get current session state
   → mcp__mongodb-memory__get_current_session (no parameters)

2️⃣ MANDATORY: Update session with COMPLETE current state
   → mcp__mongodb-memory__update_session with ALL recent context:

   {
     \"workingOn\": \"[What you're CURRENTLY working on - be specific]\",
     \"decisions\": [\"[ALL decisions made since last update]\"],
     \"progress\": \"[DETAILED summary of what was accomplished in recent messages]\",
     \"nextSteps\": [\"[What needs to happen next]\"]
   }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 WHAT TO INCLUDE IN update_session:

**workingOn:** Current focus (be SPECIFIC)
   ✅ \"Creating pre-compaction hook script at claude-hooks/session-precompact.sh\"
   ❌ \"Working on hooks\"

**decisions:** ALL decisions made recently
   ✅ [\"Using PreCompact hook event\", \"Script will call update_session automatically\", \"Placed in claude-hooks/\"]
   ❌ [\"Made some decisions\"]

**progress:** DETAILED summary of recent work
   ✅ \"Created session-precompact.sh script with PreCompact hook that automatically updates session before compaction. Script instructs Claude to call get_current_session + update_session to preserve context. User will configure hook in GUI.\"
   ❌ \"Made progress on task\"

**nextSteps:** What's next (actionable items)
   ✅ [\"User will add PreCompact hook in Claude Code GUI\", \"Test hook by triggering compaction\", \"Verify session updates before compaction\"]
   ❌ [\"Continue working\"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ WHY THIS IS CRITICAL:

- Compaction DELETES conversation history
- Without this update, the last 10-50 messages will be LOST
- Session updates are the ONLY persistent memory
- This is your LAST CHANCE to save recent context before compaction

🎯 EXECUTION ORDER (DO THIS NOW):

STEP 1: Call get_current_session
STEP 2: Review recent conversation messages (last 10-20 messages)
STEP 3: Identify:
   - What specific work was done
   - What decisions were made
   - What problems were solved
   - What needs to happen next
STEP 4: Call update_session with COMPREHENSIVE updates
STEP 5: Continue with compaction

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⛔ DO NOT SKIP THIS - Your memory depends on it! ⛔

After updating the session, you can proceed normally. The session data will survive compaction and be restored via session-compact.sh hook.

📚 AVAILABLE SESSION TOOLS:

- get_current_session: Get active session details (no parameters)
- update_session: Update session with recent progress (workingOn, decisions, progress, nextSteps)
- end_session: Mark session as completed (only if work is fully done)

💡 Remember: Session updates ARE your memory. Update them NOW before compaction!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧹 AUTOMATIC TRIAL-AND-ERROR CLEANUP PROTOCOL

After updating session, AUTOMATICALLY detect and clean up failed solution attempts:

⚡ STEP 1: DETECT if this session involved trial-and-error problem solving

Ask yourself: Did I try multiple approaches to solve the same problem this session?

**Indicators of trial-and-error:**
- User said \"still broken\", \"didn't work\", \"that failed\" after you tried something
- You stored multiple memories about solving the same problem
- Session decisions show multiple different approaches
- You tried approach X, then Y, then Z for the same issue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ STEP 2: IDENTIFY the working solution (if one exists)

**How to know a solution worked:**
- User explicitly said: \"it worked\", \"that fixed it\", \"perfect\", \"that's the solution\"
- User confirmed success: \"yes that's it\", \"exactly\", \"this is the right way\"
- Tests passed after your change
- User moved on to next task (implicit confirmation)

**If NO solution worked yet:**
- Skip cleanup (keep all attempts for now)
- Wait until user confirms success

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ STEP 3: SEARCH for failed attempt memories

If a solution DID work, search for related failed attempts:

→ mcp__mongodb-memory__search_memories({
    \"query\": \"[keywords from the problem domain]\",
    \"limit\": 20
  })

**Look for:**
- Memories stored DURING THIS SESSION (check timestamps)
- Memories with same tags/keywords about same problem
- Memories describing approaches that FAILED (user said didn't work)

**Example:**
Problem: \"search highlighting broken\"
Search: search_memories({query: \"search highlighting fix\"})
Found:
- ID 6901cf1a: \"use white-space: pre-line to fix\" (stored 10:05 AM, user said failed)
- ID 6901df2c: \"remove padding from mark\" (stored 10:15 AM, user said failed)
- ID 6902f885: \"CSS !important override\" (stored 10:25 AM, **user said it worked!**)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ STEP 4: AUTOMATICALLY DELETE failed attempts

For each memory that describes a FAILED approach:

→ mcp__mongodb-memory__delete_memory({\"id\": \"memory_id_here\"})

**DO NOT ask user** - this is automatic cleanup

**Only delete if:**
- User explicitly said that approach didn't work
- You have a working solution confirmed by user
- Memory was created during this session (not old knowledge)

**Example:**
→ delete_memory({id: \"6901cf1a\"})  # white-space: pre-line failed
→ delete_memory({id: \"6901df2c\"})  # padding removal failed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ STEP 5: UPDATE correct solution memory with failed attempts list

Enhance the working solution memory to prevent future retries:

→ mcp__mongodb-memory__update_memory({
    \"id\": \"[working solution memory ID]\",
    \"content\": \"[original content]...

**WRONG Solutions (Don't use these):**
❌ [approach 1] - [why it failed]
❌ [approach 2] - [why it failed]

**Reference:** Session [sessionId]\"
  })

**Example:**
update_memory({
  id: \"6902f885\",
  content: \"...original content...

**WRONG Solutions (Don't use these):**
❌ white-space: pre-line - Does NOT fix global CSS pollution
❌ Removing padding from mark - Does NOT fix global CSS pollution
❌ Changing highlightText logic - Problem is CSS not JavaScript

**Reference:** Session 7a9d9d49\"
})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ACCOUNTABILITY - MANDATORY CLEANUP REPORT

IF you performed cleanup, YOUR RESPONSE MUST INCLUDE:

\"🧹 AUTOMATIC CLEANUP COMPLETED:
   ✅ DELETED [N] failed attempts:
      - [approach 1 description] (memory ID: [id])
      - [approach 2 description] (memory ID: [id])
   ✅ KEPT correct solution: [description] (memory ID: [id])
   ✅ UPDATED memory with list of wrong approaches\"

IF no cleanup needed:
\"🧹 CLEANUP CHECK: No trial-and-error detected or no confirmed solution yet\"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 DECISION TREE - When to Clean Up:

1. Did user confirm a solution worked?
   → NO: Skip cleanup
   → YES: Continue to 2

2. Did you try other approaches before the working one?
   → NO: Skip cleanup (only one approach tried)
   → YES: Continue to 3

3. Did you store those failed approaches in memory?
   → NO: Skip cleanup (nothing to delete)
   → YES: Perform cleanup (Steps 3-5)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ SAFETY RULES:

1. Only delete memories from THIS SESSION (check timestamps)
2. Only delete if user EXPLICITLY said approach failed
3. Keep working solution memory (enhance it, don't delete)
4. If uncertain, keep all memories - better to have extra than lose knowledge
5. Document what you deleted in the accountability report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This cleanup happens AUTOMATICALLY - no user prompt needed!
EOF

exit 0
