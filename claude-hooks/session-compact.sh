#!/usr/bin/env bash
# Claude Code Session Compact Hook (RESTORE SESSION)
# Runs on: compact event (after compaction)
# Purpose: FORCE context restoration after compaction

# Get Claude process ID for multi-instance identification
CLAUDE_PID=$PPID

echo "🚨🚨🚨 POST-COMPACTION CONTEXT RESTORATION - MANDATORY 🚨🚨🚨

🔑 YOUR CLAUDE PROCESS ID: ${CLAUDE_PID}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 GATE CHECK QUESTIONS (You MUST answer ALL 4 in your response):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Q1: Did you call get_current_session to restore your session?
    Your answer → Session Status: [ACTIVE: session name | NO SESSION]

Q2: What is the complete workingOn text from the session?
    Your answer → Working On: [FULL text, not summarized]

Q3: What are ALL the nextSteps from the session?
    Your answer → Next Steps: [list EVERY item, numbered]

Q4: How many memories did you load from recall_memories?
    Your answer → Memories: [X] standard, [Y] warning, [Z] pattern

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔ REQUIRED OUTPUT FORMAT - Your response MUST start with this:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 POST-COMPACTION CONTEXT RESTORED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session Status: [ACTIVE: name | NO SESSION - starting fresh]
Session ID: [id or N/A]
Claude PID: ${CLAUDE_PID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Working On: [COMPLETE text from session]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Decisions Made:
1. [first decision]
2. [second decision]
... [ALL decisions, not summarized]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Progress: [COMPLETE progress text]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next Steps:
1. [first step]
2. [second step]
... [ALL steps, not summarized]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Memories Loaded: [X] standard, [Y] warning, [Z] pattern
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⛔ YOU CANNOT SKIP THIS FORMAT - It proves you restored context!
⛔ If you don't show this format, the user knows you forgot!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 MANDATORY TOOL CALLS - EXECUTE THESE NOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ FIRST - Restore your session:
   mcp__mongodb-memory__get_current_session (no parameters)

2️⃣ THEN - Load IntelliCare knowledge (call ALL in parallel):
   mcp__mongodb-memory__recall_memories({\"project\": \"IntelliCare\", \"category\": \"standard\", \"limit\": 5})
   mcp__mongodb-memory__recall_memories({\"project\": \"IntelliCare\", \"category\": \"warning\", \"limit\": 5})
   mcp__mongodb-memory__recall_memories({\"project\": \"IntelliCare\", \"category\": \"pattern\", \"limit\": 5})

3️⃣ ALSO - Search for task-relevant memories:
   Extract 2-4 keywords from workingOn field
   mcp__mongodb-memory__search_memories({\"query\": \"[keywords]\", \"limit\": 5})

⛔ DO NOT respond to user until you complete all tool calls above!
⛔ DO NOT summarize session data - show COMPLETE text!
⛔ DO NOT skip the REQUIRED OUTPUT FORMAT!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 WHY THIS MATTERS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After compaction, your conversation history is GONE. You have lost:
- What task you were working on
- Decisions made with the user
- Progress completed
- Next steps planned
- Project standards and patterns

The ONLY way to recover is:
1. Read session data (workingOn, decisions, progress, nextSteps)
2. Load memories (standard, warning, pattern)

WITHOUT doing this, you will:
❌ Ask the user to repeat what they already told you
❌ Forget decisions already made
❌ Redo work already completed
❌ Make mistakes that memories would have prevented

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SCENARIOS (What to do based on get_current_session result):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IF get_current_session returns session data:
   ✅ Read ALL fields: workingOn, decisions[], progress, nextSteps[]
   ✅ Check claudePid matches ${CLAUDE_PID}
   ✅ Load memories (standard, warning, pattern)
   ✅ Search for task-relevant memories using workingOn keywords
   ✅ Show REQUIRED OUTPUT FORMAT with COMPLETE session data
   ✅ Continue working on the task

IF get_current_session returns \"No active session\":
   ✅ Check get_previous_session for context
   ✅ Load memories (standard, warning, pattern)
   ✅ Ask user what they want to work on
   ✅ Call start_session with claudePid=\"${CLAUDE_PID}\"
   ✅ Show REQUIRED OUTPUT FORMAT with \"NO SESSION - starting fresh\"

⚠️ CRITICAL - claudePid ownership:
   - Sessions belong to specific Claude terminal instances
   - Only work on sessions where claudePid matches ${CLAUDE_PID}
   - If PID mismatch, treat as fresh start (session belongs to another terminal)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 AUTOMATIC SESSION UPDATES (After restoration):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU MUST call update_session AUTOMATICALLY after:
✅ Edit, Write, NotebookEdit tool use
✅ Bash commands that modify files
✅ User provides feedback or makes a decision
✅ Discovering bugs, fixing issues, completing subtasks

❌ NEVER batch updates at end of conversation
❌ NEVER skip updates because change seems small
❌ NEVER wait for user to say \"update the session\"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 AVAILABLE MCP MEMORY TOOLS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Memory Management:**
- recall_memories: Query by project/category/tags (USE THIS)
- search_memories: Full-text search (USE THIS for task-relevant)
- store_memory: Create NEW permanent memory
- update_memory: Modify EXISTING memory by ID

**Session Management:**
- get_current_session: Get active session (USE THIS FIRST)
- get_previous_session: See last session context
- update_session: Update progress (AUTO-CALL after changes)
- start_session: Begin new session (include claudePid!)
- end_session: Mark session complete"

exit 0
