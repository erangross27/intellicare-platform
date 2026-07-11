# Migration Decision: Claude to Gemini 3.0 (STATUS: BLOCKED)

**Decision Date:** January 18, 2026
**Status:** **DO NOT MIGRATE**

## Summary
The migration from Anthropic Claude to Google Gemini 3.0 has been halted. While Gemini 3.0 offers impressive context windows and multimodal capabilities, it lacks the specific architectural features required to handle IntelliCare's massive toolset (3,500+ functions) using the current "Agent Tool Search" design.

## Technical Blockers

### 1. Tool Selection Architecture
*   **Claude Design:** Claude's API and model architecture are specifically designed for agentic workflows where it can ingest a large list of tools with short descriptions and intelligently select the correct tool for an entire multi-step workflow.
*   **Gemini Limitation:** Gemini has a hard limit of 128 function declarations per request. It does not natively support the "semantic tool search" pattern that allows an agent to reason over thousands of potential tools simultaneously.
*   **Impact:** To make 3,500 tools work with Gemini, we would need to implement a complex Retrieval Augmented Generation (RAG) system for tools. This adds significant latency and risks "router hallucination," where the intermediate selection layer fails to retrieve the correct medical tool, breaking the clinical workflow.

### 2. Complex Workflow Reasoning
*   IntelliCare's agent relies on the model to "see" the entire breadth of possible medical actions to compose complex plans. 
*   Claude's superior ability to handle high-density tool schemas without losing reasoning quality is critical for the "Doctor" persona in this project.

## Recommendation for Future Developers
**DO NOT** attempt to switch the AI provider to Gemini unless:
1.  Google increases the native function calling limit significantly (to 1,000+).
2.  Google introduces a "Tool Search" capability similar to Anthropic's that handles thousands of functions natively within the model's latent space.
3.  The project architecture is refactored to use a much smaller, consolidated set of tools (not recommended for the current medical granularity).

## Files Preserved for Reference
The migration plans in this directory remain for research purposes only. They accurately describe the infrastructure but confirm the **functional gap** regarding tool management.
