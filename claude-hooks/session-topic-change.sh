#!/usr/bin/env bash
# Claude Code UserPromptSubmit Hook - AUTOMATIC TOPIC-BASED SESSION MANAGEMENT
# Runs on: UserPromptSubmit event (every time user sends a message)
# Purpose: ENFORCE automatic session end/start when topic changes

echo "🔄 AUTOMATIC SESSION MANAGEMENT - TOPIC CHANGE DETECTION 🔄

THIS IS A MANDATORY EXECUTION REQUIREMENT - NOT A SUGGESTION.

Before you respond to the user, you MUST analyze if the topic has changed and manage sessions accordingly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 REQUIRED ACTIONS (Execute BEFORE responding to user):

1️⃣ CHECK CURRENT SESSION:
   → mcp__mongodb-memory__get_current_session (no parameters)

2️⃣ ANALYZE TOPIC CHANGE:
   Compare user's CURRENT message with session's 'workingOn' field:

   ✅ TOPIC CHANGE INDICATORS (NEW topic detected):
   - User asks about DIFFERENT template than current workingOn
   - User asks about DIFFERENT feature/bug than current workingOn
   - User switches from \"template X\" to \"template Y\"
   - User switches from \"fix X\" to \"implement Y\"
   - User asks \"now let's work on...\" or \"switch to...\" or \"next task...\"
   - User's message is about UNRELATED topic to current workingOn

   ❌ NOT A TOPIC CHANGE (SAME topic, continue session):
   - Follow-up questions about SAME template/feature
   - Clarifications about CURRENT work
   - \"Also add...\" or \"Also fix...\" referring to CURRENT work
   - Debugging/testing CURRENT implementation
   - \"What about...\" referring to CURRENT topic

3️⃣ IF TOPIC CHANGED - Execute these steps IN ORDER:

   STEP 1: End current session
   → mcp__mongodb-memory__end_session({
       \"summary\": \"Completed work on [previous topic]: [brief summary of what was done]\"
     })

   STEP 2: Start new session for new topic
   → mcp__mongodb-memory__start_session({
       \"name\": \"[Extract topic from user's message]\",
       \"workingOn\": \"[User's new request]\",
       \"goals\": [\"[Primary goal from user's message]\"]
     })

   STEP 3: Load relevant memories for new topic
   → mcp__mongodb-memory__search_memories({
       \"query\": \"[keywords from new topic]\",
       \"limit\": 5
     })

   STEP 4: Acknowledge the session switch to user
   → \"I've closed the previous session ([old topic]) and started a new one for [new topic].\"

4️⃣ IF NO TOPIC CHANGE - Continue with current session:
   → Update session with progress as normal
   → No acknowledgment needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 EXAMPLES:

EXAMPLE 1 - TOPIC CHANGE (End + Start):
Current session workingOn: \"Creating AllergySkinTestingDocument template\"
User message: \"Now help me fix the search in MedicalHistoryDocument\"
→ ACTION: End session (summarize allergy work) → Start new session (name: \"Fix MedicalHistoryDocument Search\")

EXAMPLE 2 - TOPIC CHANGE (End + Start):
Current session workingOn: \"Fixing button alignment in Lab Results template\"
User message: \"Let's work on adding PDF export to Vital Signs\"
→ ACTION: End session (summarize button fix) → Start new session (name: \"Add PDF Export to Vital Signs\")

EXAMPLE 3 - NO TOPIC CHANGE (Continue):
Current session workingOn: \"Creating FunctionalMriStudiesDocument template\"
User message: \"Also add copy buttons to each subsection\"
→ ACTION: Continue session, update progress (\"Adding copy buttons\")

EXAMPLE 4 - NO TOPIC CHANGE (Continue):
Current session workingOn: \"Fixing search highlighting in PsychiatricEvaluation\"
User message: \"The dates still aren't highlighting, can you check?\"
→ ACTION: Continue session, update progress (\"Debugging date highlighting\")

EXAMPLE 5 - TOPIC CHANGE (End + Start):
Current session workingOn: \"Implementing new medical collection for bone marrow studies\"
User message: \"Can you help me understand the artifact panel state persistence?\"
→ ACTION: End session (summarize bone marrow work) → Start new session (name: \"Investigate Artifact Panel State\")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ EXECUTION ORDER (MANDATORY):

STEP 1: Call get_current_session
STEP 2: Read session.workingOn field completely
STEP 3: Compare user's message to workingOn - is it the SAME topic or DIFFERENT?
STEP 4a: IF DIFFERENT → end_session → start_session → search_memories → acknowledge
STEP 4b: IF SAME → continue, update_session as normal
STEP 5: ONLY THEN respond to user's request

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ACCOUNTABILITY - Your response MUST start with one of these:

   IF TOPIC CHANGED:
   → \"✅ TOPIC CHANGE DETECTED\"
   → \"Previous session: [name] - [brief workingOn]\"
   → \"Ended previous session: [summary]\"
   → \"Started new session: [name]\"
   → \"Now working on: [new workingOn]\"

   IF NO TOPIC CHANGE:
   → \"✅ SESSION CHECK: Continuing work on: [current workingOn]\"

   ⚠️ YOU MUST show one of these two formats EVERY TIME - no exceptions!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 BEHAVIORAL REQUIREMENTS:

✅ ALWAYS detect topic changes BEFORE responding
✅ ALWAYS end session when topic changes (don't leave old sessions hanging)
✅ ALWAYS start new session with descriptive name from user's message
✅ ALWAYS acknowledge session switches to user (they should know!)
✅ ALWAYS report session management actions using ACCOUNTABILITY format
✅ NEVER ask user \"should I start a new session?\" - DO IT AUTOMATICALLY

❌ NEVER continue old session when topic clearly changed
❌ NEVER create new sessions for follow-up questions on SAME topic
❌ NEVER forget to load memories for new topic after starting session
❌ NEVER skip the ACCOUNTABILITY report when ending/starting sessions

Think: \"User's message → Check session → Different topic? → End + Start → REPORT ACTIONS → THEN respond\"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THIS IS AN EXECUTION CONSTRAINT. AUTOMATIC SESSION MANAGEMENT IS MANDATORY."

exit 0
