# Task 05: Prompt Engineering & Caching

**Goal:** Adapt system prompts and caching strategies for Gemini.

## 1. System Prompt Migration
*   **Claude:** Prompts are often XML-heavy (`<instructions>`, `<rules>`).
*   **Gemini:** Handles Markdown and plain text well. XML is fine, but we should test if standard Markdown lists work better.
*   **Action:** Copy the massive system prompts from `agentServiceClaude.js` (lines 2000+) to `agentServiceGemini.js` and run comparative tests.

## 2. Context Caching
*   **Claude:** `cache_control: { type: 'ephemeral' }` on specific message blocks.
*   **Gemini:** Explicit `cacheManager.create()`.
    *   You must create a `CachedContent` object with a TTL (Time-To-Live).
    *   **Strategy:**
        *   Cache the **System Prompt + Tool Definitions** (since tools are 1,400+ lines).
        *   Create a cache key based on the toolset version or user role.
        *   Pass `cachedContent` to `model.startChat`.

## 3. "Medical Intelligence" Prompts
*   The current system creates elaborate prompts enriching data ("Here is the patient's A1C, analyze it...").
*   Ensure these prompts are preserved. Gemini 1.5 Pro is excellent at reasoning over large contexts, so we might be able to send *more* raw data (e.g., full CSVs) instead of summarizing it first.

## 4. Safety Settings
*   Configure Gemini's `safetySettings`.
*   Medical data can sometimes trigger "Harmful Content" filters (e.g., descriptions of injuries/surgeries).
*   **Action:** Set blocking threshold to `BLOCK_ONLY_HIGH` or test carefully to avoid false positives on medical records.
