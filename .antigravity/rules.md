# Agent Rules & Lifecycle Protocols

## 🔄 Session Management & Accountability (Startup/Resume)
**CRITICAL: On every session start, resume, or context clear, you MUST perform these steps immediately:**

1.  **Restore Context**:
    -   Run `mcp1_get_current_session` to check for an active session.
    -   If no active session, run `mcp1_get_previous_session`.
    -   If a relevant session is found, **RESTORE IT**.

2.  **Load Memories**:
    -   Run `mcp1_recall_memories` to load relevant project context, architectural decisions, and patterns.

3.  **Report Accountability**:
    -   You **MUST** output the current status in this EXACT format before proceeding:
    ```text
    🔍 SESSION RESTORED: [Session Name]
    🆔 ID: [Session ID]
    📊 Status: [Active/Paused]
    🏗️ Working On: [Complete text from DB]
    📈 Progress: [Complete text from DB]
    ⏭️ Next Steps:
      - [Item 1]
      - [Item 2]
    🧠 Memories Loaded: [Count]
    ```

## 🚀 Auto-Continue Protocol (Task Execution)
**When executing a multi-step task (e.g., "update all 5 files", "fix all errors"):**

1.  **Silent Continuation**:
    -   If work remains, **IMMEDIATELY** use the next tool.
    -   **DO NOT** stop to ask "Shall I continue?".
    -   **DO NOT** output intermediate summaries like "I have done 2/5, continuing...".
    -   **JUST DO IT**.

2.  **Completion Criteria**:
    -   Only stop when **100%** of the requested work is done.
    -   Or if you hit a blocking error requiring user intervention.

## 💾 Memory & State Management
1.  **Update Often**:
    -   Call `mcp1_update_session` frequently to save your `progress`, `decisions`, and `nextSteps`.
    -   **NEVER** finish a turn without updating the session state if you made progress.

2.  **Store Knowledge**:
    -   Use `mcp1_store_memory` for:
        -   Architectural decisions.
        -   New patterns or standards established.
        -   Critical bug fixes and their root causes.

3.  **End Session**:
    -   Only run `mcp1_end_session` when the entire high-level goal is achieved.
