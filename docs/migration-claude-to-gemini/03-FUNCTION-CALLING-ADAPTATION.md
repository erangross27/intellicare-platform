# Task 03: Function Calling & Tooling (Gemini 3.0)

**Goal:** Adapt the existing 1,400+ medical functions and the "Two-Stage Selector" for Gemini 3.0.

## 1. Schema Adaptation
*   **Current State:** Tools are in `functionRegistry.js` stored in "Claude format" (JSON Schema).
*   **Gemini 3.0 Requirements:** Gemini accepts standard JSON Schema in `functionDeclarations`. Gemini 3.0 is even more strict about schema compliance but handles complex nesting better than previous versions.
*   **Action:**
    *   Verify if `functionRegistry.convertToClaudeFormat` output is compatible with Gemini.
    *   If not, create `functionRegistry.convertToGeminiFormat`.
    *   Gemini 3.0 benefits from detailed docstrings; ensure descriptions are robust.

## 2. Two-Stage Selector Migration
*   **Current State:** `claudeTwoStageSelector.js` uses Claude Haiku/Sonnet to pick function names from a list of ~1400.
*   **Gemini 3.0 Strategy:**
    *   Create `geminiTwoStageSelector.js`.
    *   Use **Gemini 3.0 Flash**. It has a massive context window (2M+) and industry-leading speed.
    *   **Optimization:** With Gemini 3.0 Flash's 2M token context, we can likely fit ALL 1,400 function signatures directly into the primary prompt, potentially eliminating the "Two-Stage" latency.
    *   **Action:** Test "Single-Pass" vs "Two-Stage" selection accuracy on 3.0 Flash.

## 3. Tool Execution Loop
*   Ensure the `agentServiceGemini.js` loop correctly serializes medical results back to the model. Gemini 3.0's function calling is more robust for multi-tool chaining.

## 4. "Medical Intelligence" & "Direct Return"
*   Port the `skipClaudeFormatting` logic.
*   Gemini 3.0 can process huge outputs; however, we will still use the "Artifact Panel" for large grids to keep the chat UI clean.