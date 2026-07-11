#!/usr/bin/env bash
# PostToolUse Hook - Runs AFTER every successful tool execution
# Created: October 2025
# Updated: December 2025 - AGGRESSIVE session update enforcement
# Updated: June 2026 - Fixed to read JSON from stdin (Claude Code passes hook
#          data as JSON on stdin, NOT as command-line arguments) and to emit
#          hookSpecificOutput.additionalContext JSON (plain stdout from
#          PostToolUse hooks is only shown in transcript mode, never to Claude).
#          Removed the $2 status check: PostToolUse only fires on success.
#
# THE GAP PROBLEM:
# There's a gap between Claude's last update_session call and compaction.
# Any work done in that gap is LOST after compaction.
# This hook enforces session updates after EVERY modification to minimize the gap.
#
# Stdin JSON shape:
# {
#   "session_id": "...", "cwd": "...", "hook_event_name": "PostToolUse",
#   "tool_name": "Edit", "tool_input": { ... }, "tool_response": { ... }
# }

INPUT=$(cat)

# python3 parses the stdin payload (jq is NOT installed on this machine — a silent
# `command -v jq || exit 0` guard left this hook dead for months; do not reintroduce it).
command -v python3 >/dev/null 2>&1 || exit 0

# json_field <dot.path> [fallback.path] — extract a string field from $INPUT ('' when absent)
json_field() {
  printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    for path in sys.argv[1:]:
        v = d
        for k in path.split('.'):
            v = v.get(k, None) if isinstance(v, dict) else None
        if isinstance(v, str) and v:
            print(v)
            break
except Exception:
    pass
" "$@"
}

TOOL_NAME=$(json_field tool_name toolName)

# Wrap a plain-text message in the JSON envelope Claude actually receives
emit_context() {
  printf '%s' "$1" | python3 -c "
import json, sys
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': sys.stdin.read()}}))
"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENFORCEMENT #1: IMMEDIATE Session Update After Code Modifications
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [[ "$TOOL_NAME" == "Edit" ]] || [[ "$TOOL_NAME" == "Write" ]] || [[ "$TOOL_NAME" == "NotebookEdit" ]] \
   || [[ "$TOOL_NAME" == "search_replace" ]] || [[ "$TOOL_NAME" == "write" ]]; then
  MODIFIED_FILE=$(json_field tool_input.file_path tool_input.notebook_path tool_input.path toolInput.file_path toolInput.path toolInput.notebook_path)
  [[ -z "$MODIFIED_FILE" ]] && MODIFIED_FILE="unknown file"
  MSG=$(cat <<EOF
🚨 MANDATORY SESSION UPDATE 🚨

You just modified: ${MODIFIED_FILE}
This MUST be recorded in the session NOW.

🔴 THE GAP PROBLEM: Compaction can happen at ANY moment without warning.
   Any work not recorded in the session will be PERMANENTLY LOST.

📋 REQUIRED: Call mcp__mongodb-memory__update_session with:
{
  "progress": "Modified ${MODIFIED_FILE} - [WHAT YOU CHANGED]",
  "decisions": ["Any architectural decisions made (if applicable)"],
  "nextSteps": ["What needs to happen next"]
}

🚨 After calling update_session, display:
"✅ SESSION UPDATED: [file_name] - [brief change description]"

⚠️ THIS IS NOT OPTIONAL. If you are making several edits in a row for the
   same task, you may batch them into ONE update_session call at the end of
   the edit sequence - but it must happen before you finish your response.
EOF
)
  emit_context "$MSG"
  exit 0
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENFORCEMENT #2: Git Commit Completed
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [[ "$TOOL_NAME" == "Bash" ]] || [[ "$TOOL_NAME" == "run_terminal_command" ]]; then
  # Note: must not be named BASH_COMMAND - that is a reserved bash variable
  RUN_COMMAND=$(json_field tool_input.command toolInput.command)

  if echo "$RUN_COMMAND" | grep -q "git commit"; then
    MSG=$(cat <<'EOF'
✅ GIT COMMIT COMPLETED

📊 POST-COMMIT VERIFICATION - Recommended actions:

✅ Verify session was updated before commit
   → Check that update_session was called with this commit's changes

✅ Consider storing critical patterns in MCP memory
   → New pattern introduced → store_memory
   → Recurring bug fixed → update existing bug memory

✅ Check git status to confirm commit success
   → Run: git status or git log -1
EOF
)
    emit_context "$MSG"
    exit 0
  fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUGGESTION: Memory Storage Confirmation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [[ "$TOOL_NAME" == "mcp__mongodb-memory__store_memory" ]] || [[ "$TOOL_NAME" == "mongodb-memory__store_memory" ]]; then
  MSG=$(cat <<'EOF'
✅ MEMORY STORED SUCCESSFULLY

💡 RECOMMENDED FOLLOW-UP ACTIONS:

✅ Update current session to reference this decision
   → Add to session.decisions array if this was a key decision

✅ Verify memory has appropriate tags (specific, descriptive, searchable)

✅ Check memory category is correct
   → standard, warning, pattern, reference, architecture, etc.
EOF
)
  emit_context "$MSG"
  exit 0
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Default: Silent pass-through for other tools
# (update_session confirmation was removed - it added noise after every
#  update without changing behavior)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

exit 0
