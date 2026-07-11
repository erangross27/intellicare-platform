# Task 02: Core Agent Service Migration

**Goal:** Create `agentServiceGemini.js` to replace the core chat functionality of `agentServiceClaude.js`.

## Requirements

1.  **Service Structure**
    *   Create `apps/backend-api/services/agentServiceGemini.js`.
    *   Implement the same public interface as `agentServiceClaude.js`:
        *   `initialize()`
        *   `processChatMessage(message, sessionId, language, practiceContext)`

3. **Gemini Client Initialization**
    *   Import `GoogleGenerativeAI` from `@google/generative-ai`.
    *   Initialize with `GOOGLE_API_KEY`.
    *   Select model: `gemini-3.0-pro-latest` (for deep reasoning) or `gemini-3.0-flash-latest` (for high-speed agentic loops).

3.  **Chat Session Management**
    *   Gemini SDK uses `model.startChat()`.
    *   Need to manage history manually if we want to persist it in MongoDB like `agentServiceClaude.js` does.
    *   **Strategy:** Map the existing MongoDB `messages` array to Gemini's `Content` format (`{ role: 'user' | 'model', parts: [...] }`) on every request. This is stateless and robust.

4.  **Streaming Support**
    *   Implement `sendMessageStream`.
    *   Map Gemini's streaming events to the frontend's expected format (same as `agentServiceClaude.js` does for chunks).

5.  **Basic Function Calling Wiring**
    *   Gemini uses `tools: [{ functionDeclarations: [...] }]`.
    *   The `processChatMessage` method must detect `functionCall` parts in the response.
    *   **Execution:** Iterate through function calls, execute them using `agentServiceHelpers` or `functionRegistry`, and feed the results back to Gemini using `functionResponse` parts.

## Code Skeleton (Concept)

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");

class AgentServiceGemini {
  async processChatMessage(message, sessionId, context) {
    // 1. Build history from DB
    const history = this.convertHistoryToGemini(dbMessages);
    
    // 2. Start chat
    const chat = this.model.startChat({ 
      history,
      tools: this.getToolsForContext(context)
    });

    // 3. Send message
    const result = await chat.sendMessage(message);
    const response = await result.response;
    
    // 4. Handle Function Calls
    if (response.functionCalls()) {
       // Execute and loop back
    }
    
    // 5. Return text
    return response.text();
  }
}
```
