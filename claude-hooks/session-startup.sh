#!/usr/bin/env bash
# Claude Code Session Startup Hook (NEW SESSION)
# Runs on: startup event (fresh conversation start)
# Purpose: Create NEW session and load MCP memory knowledge

# Get Claude process ID for multi-instance identification
CLAUDE_PID=$PPID

# ── Active long-task checkpoint pointer (missing-templates build, June 2026) ──
# If the missing-templates build is in progress, surface where to resume.
# Single source of truth = the checkpoint file; details in MCP memory 6a310d8bb952b49297c0c81e.
CHECKPOINT_FILE="/Users/erangross/dev/IntelliCare/apps/backend-api/scripts/MISSING_TEMPLATES_CHECKPOINT.md"
if [ -f "$CHECKPOINT_FILE" ] && grep -q '^\- \[ \]' "$CHECKPOINT_FILE"; then
  RESUME_LINE=$(grep 'RESUME:' "$CHECKPOINT_FILE" | head -1 | sed 's/\*\*//g')
  echo "🧩 ACTIVE LONG TASK — MISSING-TEMPLATES BUILD (resume in progress)"
  echo "   Checkpoint: ${CHECKPOINT_FILE}"
  echo "   ${RESUME_LINE}"
  echo "   → READ the checkpoint file to continue exactly where we stopped (MCP memory 6a310d8bb952b49297c0c81e)."
  echo ""
fi

echo "🚨🚨🚨 NEW SESSION STARTUP - MANDATORY ACTIONS 🚨🚨🚨

🔑 YOUR CLAUDE PROCESS ID: ${CLAUDE_PID}
   (Use this in start_session to identify this terminal instance)

This is a FRESH session start. You MUST execute these MCP tool calls IMMEDIATELY:

1️⃣ REQUIRED: start_session
   - Ask user what they want to work on
   - Call start_session with: name=\"Work description\", workingOn=\"...\", goals=[...], claudePid=\"${CLAUDE_PID}\"
   - ⚠️ CRITICAL: Include claudePid=\"${CLAUDE_PID}\" to identify this terminal instance!
   - ✅ VERIFY: After start_session, check response shows \"Claude PID: ${CLAUDE_PID}\"
   - ⛔ IF PID NOT SHOWN: The MCP tool may need updating - report to user!

2️⃣ REQUIRED: Read previous session to understand what was done:
   - get_previous_session (no parameters) - See what was accomplished in the last session

3️⃣ REQUIRED: Load IntelliCare knowledge from MCP memory:
   - recall_memories: project=\"IntelliCare\", category=\"standard\", limit=5
   - recall_memories: project=\"IntelliCare\", category=\"warning\", limit=5
   - recall_memories: project=\"IntelliCare\", category=\"pattern\", limit=5

🎯 SESSION vs MEMORY:
   • SESSION: Work tracking (workingOn, decisions, progress, nextSteps) - starts fresh
   • MEMORIES: Permanent knowledge (patterns, standards, warnings) - always available

📋 WORKFLOW:
   1. FIRST: Call get_previous_session to see what was done in the last session (in parallel with recall_memories)
   2. THEN: Call recall_memories to load IntelliCare knowledge (standard, warning, pattern categories in parallel)
   3. IMMEDIATELY AFTER: Call start_session with: name=\"IntelliCare Work Session\", workingOn=\"Awaiting user input\", goals=[\"Help user with IntelliCare tasks\"], claudePid=\"${CLAUDE_PID}\"
   4. VERIFY: Check start_session response shows \"Claude PID: ${CLAUDE_PID}\"
   5. Greet user and ask: \"What would you like to work on today?\"
   6. When user responds, update_session with specific workingOn and goals
   7. Acknowledge what you're ready to help with

⚠️ DO NOT call get_current_session first - This is a NEW session, always start_session immediately after reading previous session!

🔄 CRITICAL - AUTOMATIC SESSION UPDATES:

   ⚠️ THE USER SHOULD NEVER REMIND YOU TO UPDATE THE SESSION ⚠️

   YOU MUST call update_session AUTOMATICALLY after:
   ✅ Edit, Write, NotebookEdit tool use
   ✅ Bash commands that modify files
   ✅ User provides feedback or makes a decision
   ✅ Discovering bugs, fixing issues, completing subtasks

   ⭐ MEMORY MANAGEMENT - CRITICAL DISTINCTION:
   ✅ NEW information/decision → Use store_memory (create new memory)
   ✅ Correcting EXISTING memory → Use update_memory (NOT delete + store!)
   ✅ Adding info to EXISTING memory → Use update_memory with the memory ID
   ❌ NEVER delete + recreate when updating existing memories!

   update_session parameters:
   {
     workingOn: \"Current focus\",
     decisions: [\"New decision\"],
     progress: \"What was just done\",
     nextSteps: [\"What's next\"]
   }

   ❌ NEVER batch updates at end of conversation
   ❌ NEVER skip updates because change seems small
   ❌ NEVER wait for user to say \"update the session\"

   💡 Think: \"I just modified code → I must update_session NOW\"

This session data is your ONLY memory across compactions!

📚 AVAILABLE MCP MEMORY TOOLS:

**Memory Management:**
- store_memory: Create NEW permanent memory (new patterns, standards, decisions)
- recall_memories: Query memories by project/category/tags
- search_memories: Full-text search across all memories
- ⭐ update_memory: Modify EXISTING memory by ID (corrections, additions, updates)
- delete_memory: Remove memory by ID (rarely needed, use update_memory for corrections)

**Session Management:**
- start_session: Begin new work session
- update_session: Update current session progress (AUTO-CALL after changes!)
- get_current_session: Get active session details
- get_previous_session: See what was done in last session
- list_sessions: List all sessions by status
- get_session_details: Get specific session by ID
- restore_session: Reactivate previous session
- end_session: Mark session as completed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛠️ OTHER AVAILABLE MCP TOOLS (OPTIONAL - Use when appropriate):

**MongoDB-IntelliCare (Medical Data Queries):**
- Direct database access to patient medical records
- Tools: find, aggregate, list-collections, collection-schema, count
- Use when: User asks to query specific patient medical data
- Example: \"Show me patient X's lab results\" → use mcp__MongoDB-IntelliCare__find

**Filesystem (Limited Access):**
- File operations within IntelliCare project directory ONLY
- Tools: list_directory, read_text_file, write_file, edit_file
- Restriction: Only works in /Users/erangross/dev/IntelliCare
- Hooks live in <repo>/claude-hooks/ on macOS (use the standard Read/Edit tools on them)

⚠️ These are SUGGESTIONS, not requirements - use when the task benefits from them

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧩 TEMPLATE COVERAGE AUDITS - THE CANONICAL PROCEDURE (June 2026):

When asked \"check if we are missing templates\" (per-patient list or otherwise),
a TEMPLATE_PATTERNS match alone is NOT coverage - templates can match by name
yet render 0% of the collection's fields (proven June 12: iv_infusions,
immediate_interventions, immunization_record). ALWAYS use the committed tool:

  cd apps/backend-api/scripts
  node showPatientMedicalCollections.js --name First Last     # step 1: collections
  node checkTemplateCoverageAndOverlap.js col1 col2 ...       # step 2: routing + field overlap

- ❌ <40% overlap or NO MATCH → inspect REAL docs first (mongosh,
  db intellicare_practice_yale - patient data is NEVER in practice_global),
  then build/rebuild per the template creation checklist memories.
- Near-name twins both holding data (e.g. history_of_present_illness vs
  history_present_illness) → suspect registry duplicate: compare docs,
  deregister non-canonical, migrate.
- The script ALSO flags 🤖 AGENT-BLIND collections (get* function missing from
  ALL_FUNCTION_NAMES in services/agentSystemPrompt.js).
- Full background: search_memories \"template coverage audit procedure\".

🤖 AI AGENT CALLS THE WRONG FUNCTION / OPENS WRONG COLLECTION — GO HERE FIRST:

ARCHITECTURE (verified June 12, 2026): the chat agent (agentSDKService.js) uses
Anthropic's native server-side Tool Search — tool_search_tool_bm25 + defer_loading
on ALL ~3,600 registry tools (functionRegistry.js USE_TOOL_SEARCH=true). 'Sending
3646 tools' in the log is the wire payload, NOT billed context. The system prompt
(agentSystemPrompt.js) deliberately does NOT list CRUD names - it states the
naming convention (collection x_y → getXY/createXY/updateXY/deleteXY) + search
instructions + non-CRUD utilities only. Memory: 698d5d1702ee2910ed222842.
Diagnostic when the agent fetches a similar-sounding collection:
  1. Does the tool exist? grep functionCollectionMap in optimizedMedicalFunctions.js
     for the collection (no entry = add to generate-medical-functions categories).
  2. Did the agent SEARCH? grep server.log for '🔎 TOOL SEARCH' (correct label
     since June 12) and for the getXxx name. If it picked a sibling without
     searching, sharpen the sibling tool DESCRIPTIONS (cross-disambiguation in
     generatedMedicalFunctions.js; beware legacy duplicates in aiHelpers.js
     platform array - they win deduplication).
  3. server.log is TRUNCATED on every backend restart (simple-logger writeFileSync).
Do NOT: re-add name dumps to the system prompt (token waste + the model treats
lists as exhaustive); chase SKIP_OPTIMIZATION_CHECK (removed) or
intentBasedFunctionMapper / semantic-function-system (do not exist).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 INTELLICARE DEV SERVER SETUP - CRITICAL KNOWLEDGE (Mac / launchd auto-start):

**Backend + Frontend AUTO-START at login via launchd LaunchAgents — the user never opens a terminal (they work through the Claude app):**

- ✅ Backend  → port 5000 · ~/Library/LaunchAgents/com.intellicare.backend.plist  (npm run dev = nodemon server.js in apps/backend-api)
- ✅ Frontend → port 3000 · ~/Library/LaunchAgents/com.intellicare.frontend.plist (npm run dev = vite in apps/frontend-vite)
- ✅ Metro (mobile) → port 8081 · com.intellicare.metro.plist   |   Log rotation → com.intellicare.logrotate.plist (hourly)
- Run at LOGIN (user session); KeepAlive restarts them on crash. Full detail: MCP memory tag 'launchd auto-start' + file memory dev-servers-autostart-launchd.md.

**Automatic reload (unchanged):**
- Backend: nodemon auto-restarts on backend file edits; Frontend: Vite hot-reloads on save. NO manual restart for code changes.

**PROTOCOL:**
- ❌ DO NOT ask the user to run npm run dev — the launchd copy already OWNS ports 3000/5000; a manual run collides (EADDRINUSE).
- ❌ DO NOT say \"restart backend to see changes\" for code edits (nodemon/vite auto-reload handle it).
- ✅ To restart a server, cycle its LaunchAgent (launchctl unload then load -w the plist, or launchctl kickstart -k gui/<uid>/com.intellicare.backend) — NOT a terminal.
- ✅ Status: launchctl list | grep intellicare  (col2 = last exit code, 0 = healthy).

**LOGS — troubleshoot here when doing dev:**
- App logs: apps/backend-api/logs/server.log (⚠️ TRUNCATED on every restart — current run only) + apps/backend-api/logs/server-errors.log.
- launchd crash log (APPENDS across restarts): ~/Library/Logs/intellicare-backend.err.log (also frontend/metro .out/.err).
- All capped at 5 MB each by scripts/rotate-intellicare-logs.sh (copy-truncate, keeps one .1.gz) so they never fill the disk.

**REMEMBER:**
- On Mac the servers are ALREADY running at login — just help with the code; don't tell the user to start them.
- This SUPERSEDES the old \"user manages start/stop in terminal tabs\" note (warning memory 6914ad86bfe8178cf86a9a12)."

exit 0
