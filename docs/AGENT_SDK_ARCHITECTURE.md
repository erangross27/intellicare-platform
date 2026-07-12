# IntelliCare Agent SDK - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React/Vite)                          │
│  - Real-time streaming UI                                              │
│  - Token-by-token text display                                         │
│  - Artifact panel split-screen editor                                  │
│  - Thinking block visualization                                        │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ SSE Stream
                                   │ type: 'chunk' | 'thinking' | 'done'
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      API ROUTE: /api/agent/chat-stream                  │
│  - Input validation                                                     │
│  - Session management                                                   │
│  - Practice context isolation                                           │
│  - Streaming response setup                                             │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      AGENT SDK SERVICE LAYER                             │
│  (apps/backend-api/services/agentSDKService.js)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 1: FUNCTION SELECTION (1-2 seconds)                         │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  Input: User query + Conversation history                         │ │
│  │           ↓                                                        │ │
│  │  claudeTwoStageSelector.selectFunctionNames()                     │ │
│  │           ↓                                                        │ │
│  │  Build Stage 1 prompt:                                             │ │
│  │  - System: "Function selector" (cached)                            │ │
│  │  - Function list: All 1400 names (~500 tokens)                     │ │
│  │  - Instructions: Decision rules (context-dependent)                │ │
│  │  - Messages: Full conversation history                             │ │
│  │           ↓                                                        │ │
│  │  Claude Sonnet 4.5: Analyze + Select                               │ │
│  │  temperature: 0 (deterministic)                                    │ │
│  │           ↓                                                        │ │
│  │  Output: JSON array of selected function names                     │ │
│  │  Example: ["searchPatientsByName", "getMedications", ...]          │ │
│  │           ↓                                                        │ │
│  │  Handle Special Cases:                                             │ │
│  │  ├─ Conversational response (empty array)                          │ │
│  │  ├─ CSV upload (import functions)                                  │ │
│  │  └─ CSV error (error response)                                     │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 2: FUNCTION EXECUTION (4-8 seconds)                         │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  Input: Selected function names                                    │ │
│  │           ↓                                                        │ │
│  │  functionRegistry.getFunctions(selectedNames)                      │ │
│  │  Performance: O(n) where n = 3-8, <1ms total                       │ │
│  │           ↓                                                        │ │
│  │  Get full function definitions (Claude format)                     │ │
│  │           ↓                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │ AGENTIC LOOP (max 15 iterations)                            │ │ │
│  │  ├──────────────────────────────────────────────────────────────┤ │ │
│  │  │                                                              │ │ │
│  │  │  Build Messages Array:                                       │ │ │
│  │  │  - Conversation history (filtered, max 20 messages)          │ │ │
│  │  │  - Previous tool results                                     │ │ │
│  │  │  - Current user message                                      │ │ │
│  │  │           ↓                                                  │ │ │
│  │  │  Build API Payload:                                          │ │ │
│  │  │  {                                                           │ │ │
│  │  │    model: 'claude-sonnet-4-5-20250929',                      │ │ │
│  │  │    max_tokens: 4096,                                         │ │ │
│  │  │    temperature: 1.0,  // Enable thinking mode                │ │ │
│  │  │    messages: [...]                                           │ │ │
│  │  │    system: [                                                 │ │ │
│  │  │      {                                                       │ │ │
│  │  │        text: systemPrompt,                                   │ │ │
│  │  │        cache_control: { type: 'ephemeral' }                  │ │ │
│  │  │      }                                                       │ │ │
│  │  │    ],                                                        │ │ │
│  │  │    tools: selectedTools  // 3-8 tools only                   │ │ │
│  │  │  }                                                           │ │ │
│  │  │           ↓                                                  │ │ │
│  │  │  Stream Response:                                             │ │ │
│  │  │  const stream = await anthropic.messages.stream(payload)      │ │ │
│  │  │           ↓                                                  │ │ │
│  │  │  ┌────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │ STREAMING EVENT PROCESSOR                             │ │ │ │
│  │  │  ├────────────────────────────────────────────────────────┤ │ │ │
│  │  │  │                                                        │ │ │ │
│  │  │  │  for await (const event of stream):                    │ │ │ │
│  │  │  │    - content_block_start: Initialize                  │ │ │ │
│  │  │  │    - content_block_delta:                              │ │ │ │
│  │  │  │      * text_delta → Send to frontend IMMEDIATELY      │ │ │ │
│  │  │  │      * thinking_delta → Accumulate                    │ │ │ │
│  │  │  │    - content_block_stop: Send complete blocks         │ │ │ │
│  │  │  │    - message_stop: Get finalMessage()                  │ │ │ │
│  │  │  │                                                        │ │ │ │
│  │  │  └────────────────────────────────────────────────────────┘ │ │ │
│  │  │           ↓                                                  │ │ │
│  │  │  Check Response:                                             │ │ │
│  │  │  if (response.stop_reason === 'tool_use'):                   │ │ │
│  │  │    └─ Execute tools and continue loop                        │ │ │
│  │  │  else if (response.stop_reason === 'end_turn'):              │ │ │
│  │  │    └─ Exit loop, return final response                       │ │ │
│  │  │                                                              │ │ │
│  │  │  ┌────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │ TOOL EXECUTION SUBSYSTEM                              │ │ │ │
│  │  │  ├────────────────────────────────────────────────────────┤ │ │ │
│  │  │  │                                                        │ │ │ │
│  │  │  │  for (const toolUse of response.content):              │ │ │ │
│  │  │  │                                                        │ │ │ │
│  │  │  │    if (toolUse.type === 'tool_use'):                   │ │ │ │
│  │  │  │      1. executeTool(toolName, args)                    │ │ │ │
│  │  │  │         ↓                                              │ │ │ │
│  │  │  │      2. Check: Is result from AI collection?           │ │ │ │
│  │  │  │         ├─ YES: Skip from Claude, send to panel        │ │ │ │
│  │  │  │         └─ NO: Continue                                │ │ │ │
│  │  │  │         ↓                                              │ │ │ │
│  │  │  │      3. Check: Should return directly to frontend?     │ │ │ │
│  │  │  │         ├─ YES: Send summary to Claude, full to panel  │ │ │ │
│  │  │  │         └─ NO: Send full result to Claude              │ │ │ │
│  │  │  │         ↓                                              │ │ │ │
│  │  │  │      4. Create tool_result block:                      │ │ │ │
│  │  │  │         {                                              │ │ │ │
│  │  │  │           type: 'tool_result',                         │ │ │ │
│  │  │  │           tool_use_id: block.id,                       │ │ │ │
│  │  │  │           content: JSON.stringify(result)              │ │ │ │
│  │  │  │         }                                              │ │ │ │
│  │  │  │         ↓                                              │ │ │ │
│  │  │  │      5. Track tokens for budget                        │ │ │ │
│  │  │  │         cumulativeToolResultTokens += resultTokens     │ │ │ │
│  │  │  │                                                        │ │ │ │
│  │  │  │  Add tool_results to messages array                     │ │ │ │
│  │  │  │  Loop → Next iteration                                  │ │ │ │
│  │  │  │                                                        │ │ │ │
│  │  │  └────────────────────────────────────────────────────────┘ │ │ │
│  │  │                                                              │ │ │
│  │  │  Token Budget Check (per loop):                              │ │ │
│  │  │  if (estimatedTokens > MAX_CONVERSATION_TOKENS):             │ │ │
│  │  │    └─ Break loop, return response                            │ │ │
│  │  │                                                              │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  │           ↓                                                        │ │
│  │  Final Response:                                                   │ │
│  │  - All text has been streamed to frontend                         │ │
│  │  - Send 'done' event with final message + artifact data           │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      SUPPORTING SERVICES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  agentServiceV4.executeFunction(name, args, context)                   │
│  - Find function handler                                               │
│  - Build SecureDataAccess context                                      │
│  - Execute with audit logging                                          │
│  - Catch errors and return gracefully                                  │
│                                                                          │
│  SecureDataAccess (secureDataAccess.js)                                │
│  - Database operations: query, insert, update, delete                  │
│  - Field-level security                                                │
│  - Audit logging                                                       │
│  - Practice isolation                                                  │
│                                                                          │
│  functionRegistry.js                                                   │
│  - Load all 1400 functions ONCE at startup                             │
│  - O(1) lookup by name via Map                                         │
│  - Pre-convert to Claude format                                        │
│                                                                          │
│  aiHelpers.js                                                          │
│  - getAllPlatformFunctions() - Return all 1400 functions               │
│  - GeneratedMedicalFunctions + CustomMedicalFunctions                  │
│  - Function registry source                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
USER REQUEST
    │
    ├─ Message: "Show Helen Cox's medications"
    ├─ Practice: yale
    ├─ Language: en
    ├─ History: [prev messages...]
    │
    ↓
STAGE 1: SELECTION
    │
    ├─ Input tokens: ~500 (just function names)
    ├─ Claude: "I need searchPatientsByName and getMedications"
    ├─ Output: ["searchPatientsByName", "getMedications"]
    │
    ↓
STAGE 2: EXECUTION
    │
    ├─ Loop 1:
    │  ├─ Claude: "I'll search for Helen Cox"
    │  ├─ Tool call: searchPatientsByName({name: "Helen Cox"})
    │  ├─ Execute: Returns {patientId: "123", name: "Helen Cox"}
    │  └─ Continue
    │
    ├─ Loop 2:
    │  ├─ Claude: "Now I'll get her medications"
    │  ├─ Tool call: getMedications({patientId: "123"})
    │  ├─ Execute: Returns {success: true, medications: [...]}
    │  └─ Continue
    │
    ├─ Loop 3:
    │  ├─ Claude: Generates response
    │  ├─ stop_reason: "end_turn"
    │  └─ Stream response to frontend
    │
    ↓
RESPONSE
    │
    ├─ Streamed text: Token-by-token to frontend
    ├─ Artifact panel: Full medication data
    ├─ Done event: Final message + artifact metadata
    │
    ↓
FRONTEND
    │
    ├─ Display: Text appears word-by-word
    ├─ Panel: Split-screen medication editor opens
    └─ Complete: User can interact with artifact data
```

---

## Token Flow Diagram

```
PROMPT CACHING STRATEGY
═══════════════════════════════════════════════════════════════════════════

First Request:
┌─────────────────────────────────────────────────────────────────────────┐
│ Input Tokens:                                                           │
│ ├─ System prompt (cached): ~10,000 tokens                              │
│ ├─ Function list (cached): ~500 tokens                                 │
│ ├─ Conversation history: ~2,000 tokens                                 │
│ ├─ Current user message: ~100 tokens                                   │
│ └─ Total: ~12,600 tokens → Send to API ✓                              │
│                                                                        │
│ Output Tokens: ~500 tokens                                            │
│                                                                        │
│ Cost: (12,600 + 500) × $0.003 = $0.039                               │
└─────────────────────────────────────────────────────────────────────────┘

Second Request (within 5 minutes):
┌─────────────────────────────────────────────────────────────────────────┐
│ Input Tokens:                                                           │
│ ├─ System prompt (CACHED): ~10,000 tokens → Read from cache            │
│ ├─ Function list (CACHED): ~500 tokens → Read from cache               │
│ ├─ Conversation history: ~2,000 tokens                                 │
│ ├─ Current user message: ~100 tokens                                   │
│ └─ Total sent to API: ~2,100 tokens only ✓                             │
│                                                                        │
│ Output Tokens: ~500 tokens                                            │
│                                                                        │
│ Cost: (2,100 + 500) × $0.003 = $0.0078                                │
│       + Cache read: 10,500 × $0.0003 = $0.00315                       │
│       Total: $0.0110 (72% savings!)                                   │
└─────────────────────────────────────────────────────────────────────────┘

Per-Loop Token Tracking:
┌─────────────────────────────────────────────────────────────────────────┐
│ MAX_CONVERSATION_TOKENS: 180,000                                       │
│ OVERHEAD_TOKENS: 20,000 (system + tools + buffer)                      │
│ USABLE_TOKENS: 160,000                                                 │
│                                                                        │
│ Loop 1:                                                                │
│ ├─ Messages size: 5,200 tokens                                        │
│ ├─ Tool result: 450 tokens                                            │
│ ├─ Budget used: (5,200 + 450) / 180,000 = 3.1%                        │
│ └─ Cumulative: 450 tokens                                             │
│                                                                        │
│ Loop 2:                                                                │
│ ├─ Messages size: 5,600 tokens (added previous result)                │
│ ├─ Tool result: 620 tokens                                            │
│ ├─ Budget used: (5,600 + 620) / 180,000 = 3.5%                        │
│ └─ Cumulative: 1,070 tokens                                           │
│                                                                        │
│ Loop 3:                                                                │
│ ├─ Messages size: 6,100 tokens                                        │
│ ├─ Budget used: 6,100 / 180,000 = 3.4%                                │
│ └─ Stop: Claude exits loop                                            │
│                                                                        │
│ Total loop tokens: 1,070 tokens                                       │
│ Total conversation: ~15,000 tokens                                    │
│ Under budget ✓                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AI Collection Skipping Flow

```
Tool Execution Result
    │
    ├─ Check: result.artifactPanel?.category?
    │   │
    │   ├─ if (category === 'clinical_decision_support'):
    │   ├─ if (category === 'intelligent_recommendations'):
    │   ├─ if (category === 'medication_optimization'):
    │   └─ etc. (11 total AI collections)
    │       │
    │       ↓
    │   Is AI-Generated Collection? YES
    │       │
    │       ├─ Log: "AI COLLECTION SKIP: [name] ([category])"
    │       │
    │       ├─ Send to Artifact Panel:
    │       │  {
    │       │    displayType: 'openArtifactPanel',
    │       │    artifactPanel: {...full data...}
    │       │  }
    │       │
    │       ├─ Send to Claude:
    │       │  {
    │       │    type: 'tool_result',
    │       │    tool_use_id: '...',
    │       │    content: '{"success": true, "message": "...displayed..."}'
    │       │  }
    │       │  (EMPTY - just tells Claude data was shown)
    │       │
    │       └─ Continue to next tool (don't add to cumulative tokens)
    │
    └─ Is Regular Collection? NO
        │
        ├─ Send full result to Claude
        ├─ Check: directReturn: true?
        │   ├─ YES: Summary to Claude, full to artifact panel
        │   └─ NO: Full result to Claude + artifact panel if exists
        │
        └─ Add to cumulative tool result tokens
```

---

## Artifact Panel Integration

```
Function Result
    │
    ├─ return {
    │   success: true,
    │   data: {...},
    │   displayType: 'openArtifactPanel',  ← REQUIRED
    │   artifactPanel: {                  ← REQUIRED
    │     category: 'medications_list',
    │     displayName: 'Medications',
    │     data: {...}
    │   }
    │ }
    │
    ↓
Artifact Data Captured:
    │
    ├─ artifactPanelData = {
    │   displayType: 'openArtifactPanel',
    │   artifactPanel: {...}
    │ }
    │
    ↓
In Final Response:
    │
    ├─ onChunk({
    │   type: 'done',
    │   data: {
    │     success: true,
    │     message: finalResponse,
    │     displayType: 'openArtifactPanel',  ← Pass to frontend
    │     artifactPanel: {...}               ← Pass to frontend
    │   }
    │ })
    │
    ↓
Frontend:
    │
    ├─ Display finalResponse in chat
    ├─ Check: displayType === 'openArtifactPanel'?
    ├─ YES: Open split-screen panel
    ├─ Show artifactPanel.data in dedicated editor
    └─ User can: search, copy, export, edit
```

---

## Performance Timeline

```
Total: 5-10 seconds for typical request

0s     User enters message
│
├─ STAGE 1: Function Selection
│  │
0-1s   │ Build selection prompt
1-2s   │ Claude analyzes (cached system)
       │ Returns: ["searchPatientsByName", "getMedications"]
       │
       ├─ STAGE 2: Function Execution
       │
2-3s   │ Build initial API payload with tools
       │ Send to Claude
       │
3-4s   │ Claude: "I'll search for Helen Cox"
       │ Streaming: "I'll search..." appears immediately
       │ tool_use: searchPatientsByName
       │ Execute: <500ms
       │
4-5s   │ Claude sees patientId result
       │ Claude: "Now I'll get her meds"
       │ Streaming: "Now I'll get..." appears
       │ tool_use: getMedications
       │ Execute: <500ms
       │
5-8s   │ Claude sees medications
       │ Claude: Generates response
       │ Streaming: "Her current medications are..."
       │ Stream complete response to frontend
       │
8-10s  │ Final touches
       │ Artifact panel opens (if applicable)
       │ User can interact
       │
10s    ✓ Complete
```

