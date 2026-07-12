# IntelliCare Agent SDK Service - Technical Deep Dive

## Overview
The Agent SDK Service (`agentSDKService.js`) implements a sophisticated two-stage agentic loop that powers IntelliCare's autonomous medical assistant. It combines Claude Sonnet 4.5 with direct function execution, real-time streaming, and prompt caching for efficient medical decision-making.

**Key Achievement**: Handles agentic conversations with 1400+ medical functions, producing responses in 5-10 seconds with 95% token cost reduction via prompt caching.

---

## Architecture: Two-Stage Agentic Loop

### Stage 1: Function Selection (Fast & Token-Efficient)
**Purpose**: Determine which functions are needed WITHOUT loading all function definitions

**Token Savings**: 500 tokens vs 63,000 tokens = **126x reduction** for function selection

Stage 1 analyzes the user request and conversation history, then returns only the names of 3-5 relevant functions. This avoids loading 1400+ full function definitions into the context window.

### Stage 2: Function Execution (Direct + Streaming)
**Purpose**: Execute selected functions with real-time feedback and agentic loop

The service enters an agentic loop where:
1. Claude sees the selected tools and patient context
2. Claude decides whether to call tools or generate final response
3. If tools are needed: execute immediately and return results to Claude
4. Claude sees results and decides next action
5. Repeat until Claude generates final response (max 15 loops)
6. Stream text to frontend token-by-token in real-time

---

## Key Optimizations

### 1. Real-Time Streaming Architecture
- Uses Anthropic SDK streaming API for token-by-token delivery
- Thinking blocks aggregated and sent as complete units
- Frontend sees Claude's reasoning in real-time
- Estimated latency: 50-100ms per token (~500ms for typical response)

### 2. Prompt Caching (95% Token Cost Reduction)
- Cache system prompt (~10K tokens) with `cache_control: { type: 'ephemeral' }`
- Cache selected function definitions
- ephemeral cache: 5-minute TTL
- Cost reduction: 90% on cached input tokens (10% of first request)

### 3. Function Selection with Smart Filtering
Key decision logic:
- "recommendations" → ACTION functions (prescribeMedication, scheduleFollowUp)
- "Apply" → Implementation functions
- Patient name mention → searchPatientsByName FIRST
- CSV upload detection → importPatientsFromCSV or importUsersFromCSV
- Artifact panel context → Analytical vs action functions

### 4. Smart AI Collection Skipping
Prevents Claude from reading its own AI-generated insights (clinical decision support, medication optimization, etc.). Instead:
- Send empty tool result to Claude (saves ~34K tokens)
- Send full data to artifact panel for user display
- Claude regenerates fresh insights from raw patient data

### 5. Background Processing for Document Analysis
Large batch operations return immediately via `backgroundProcessing: true` flag:
- `analyzeUploadedDocuments`: PDF analysis via Claude Batch API (1M token context)
- `importPatientsFromCSV`: Bulk patient import from CSV
- Returns immediately, user sees batch ID and can track progress

### 6. Token Budget Enforcement
Monitors conversation token usage with:
- MAX_CONVERSATION_TOKENS: 180,000 (leaves 20K buffer)
- Per-loop token tracking
- Stops agentic loop if budget exceeded
- Logs percentage of token budget used

---

## Function Selection & Execution Flow

### Function Registry (O(1) Lookup)
```
Initialization: Load all 1400+ functions ONCE at startup into Map
Single lookup: <0.1ms (O(1) via Map)
Batch lookup (3-8 functions): <1ms
All functions: <10ms
```

### Tool Execution Pipeline
```
User Request
    ↓
[Stage 1] Claude selects 3-5 function names (~500 tokens)
    ↓
[Stage 2] Get full definitions for selected functions (<1ms)
    ↓
[Loop Start] Claude sees tools + patient context
    ↓
Claude decides: Call tools? or Finish?
    ├─ YES: Execute immediately via agentServiceV4
    │  ├─ Check for AI collection → Skip if AI-generated
    │  ├─ Check for directReturn → Send to artifact panel
    │  └─ Return full result to Claude
    │
    └─ NO: Generate final response → Stream to frontend
```

### Example Workflow
```
User: "Show Helen Cox's medications"
    ↓
Stage 1: ["searchPatientsByName", "getMedications"]
    ↓
Loop 1: Claude calls searchPatientsByName(name: "Helen Cox")
    → Returns patientId
    ↓
Loop 2: Claude calls getMedications(patientId: "abc123...")
    → Returns medication list
    ↓
Loop 3: Claude generates final response
    → Stream to frontend
    → Exit loop
```

---

## Streaming Implementation Details

The service uses `this.anthropic.messages.stream(apiPayload)` to receive events:

```javascript
// Stream events processed in real-time
for await (const event of stream) {
  switch(event.type) {
    case 'content_block_start':
      // Initialize blocks
    case 'content_block_delta':
      if (event.delta?.type === 'text_delta') {
        // Send text chunks immediately to frontend (true streaming)
        onChunk({ type: 'chunk', content: event.delta.text });
      } else if (event.delta?.type === 'thinking_delta') {
        // Accumulate thinking blocks
      }
    case 'content_block_stop':
      // Send complete thinking blocks
      onChunk({ type: 'thinking', content: thinkingBlock });
    case 'message_stop':
      // Get final message with all content blocks
      response = await stream.finalMessage();
  }
}
```

**Benefits**:
- Token-by-token delivery (true streaming UI)
- Frontend sees text appear word-by-word
- Thinking blocks show Claude's reasoning
- No need to wait for entire response

---

## Artifact Panel Integration

### Data Flow
```
Tool Result
    ↓
Check: displayType === 'openArtifactPanel'?
    ├─ YES: Capture artifactPanelData
    │  ├─ Send full data to artifact panel (split-screen editor)
    │  ├─ Send summary to Claude (save tokens)
    │  └─ Store for final response
    │
    └─ NO: Send full result to Claude only
```

### Dual-Path Architecture
Example: `getFullMedicalReport()` returns 40-60KB unified document
```
Data goes to artifact panel (full, uncompressed)
    ↓
Claude gets: Summary only ("10 medications, last updated 2 weeks ago")
    ↓
Saves ~40KB of tokens in conversation
```

### Categories Handled
- medications_list, clinical_decision_support, follow_up_intelligence
- intelligent_recommendations, imaging_reports, lab_results
- And 190+ other medical collections

---

## Performance Characteristics

### Latency Breakdown
```
Stage 1 (function selection): 1-2 seconds
  - Claude Sonnet 4.5 analysis
  - ~500 token input, ~50 token output

Stage 2 (agentic loops): 1-2 seconds per loop
  - Claude decides which tools to call
  - Tool execution: 100-500ms per tool
  - Claude sees results

Final response: 1-3 seconds
  - Stream to frontend: instant (token-by-token)
  - Total time: first token appears in ~500ms

Total: 5-10 seconds for typical query
```

### Token Usage
```
Typical conversation (3-5 function calls):
  First request: 15,000 tokens × $0.003 = $0.045
  Cached request: 1,500 tokens × $0.003 = $0.0045 (10%)
  
Savings with caching: 85-90% on cached requests
```

### Memory Footprint
```
Function Registry: ~50MB (1400 functions loaded once)
Conversation history: ~100KB per 20 messages
Active request: ~1-5MB during execution
```

---

## Security & Data Handling

### SecureDataAccess Integration
All functions execute through `SecureDataAccess` for database operations:
```javascript
const context = {
  serviceId: 'agentSDKService',
  operation: 'agent-function-call',
  practiceId: practiceId,
  practiceSubdomain: practiceId  // Use subdomain NOT id
};
```

### Artifact Panel Data Structure
Functions returning artifact data MUST include:
```javascript
{
  displayType: 'openArtifactPanel',
  artifactPanel: {
    category: 'collection_name',
    displayName: 'User-friendly name',
    data: {...}
  }
}
```

---

## Critical Implementation Details

1. **Two-Stage Selection is Mandatory**: Never load all 1400 function definitions for Claude

2. **Artifact Panel Data Must Have displayType**: Required for split-screen panel to open

3. **Conversational Responses Bypass Tools**: If stage 1 returns no functions, Claude provides direct response

4. **CSV Type Affects Function Selection**:
   - `csvType === 'patients'` → Select importPatientsFromCSV
   - `csvType === 'users'` → Select importUsersFromCSV

5. **AI Collections Should Be Skipped**: Return empty result to Claude but send data to artifact panel

---

## Comparison: Traditional vs Agent SDK

| Aspect | Traditional | Agent SDK |
|--------|-----------|-----------|
| Function selection | All 1400+ (63K tokens) | Selected 3-5 only (~500 tokens) |
| Token usage | 15-20K per request | 8-12K first, 1-2K cached |
| Cost per request | $0.045-0.060 | $0.025-0.035 first, $0.003-0.008 cached |
| Streaming | Text chunks only | Text + thinking + tool calls |
| Tool selection | User specifies | Claude decides autonomously |
| Multi-turn loops | N/A | Yes, up to 15 loops |
| Prompt caching | Limited | 95% cost reduction cached |
| Document analysis | Streaming only | Background Batch API |

---

## Key Files & Architecture

### Main Service
- `/apps/backend-api/services/agentSDKService.js` - Main service (1158 lines)
  - `processChatMessageWithAgent()` - Entry point
  - Streaming implementation (lines 529-580)
  - Agentic loop (lines 484-896)
  - Tool execution (lines 1094-1133)

### Two-Stage Selector
- `/apps/backend-api/services/claudeTwoStageSelector.js`
  - `selectFunctionNames()` - Stage 1 (lines 67-332)
  - `getSelectedFunctions()` - Stage 2 (lines 338-364)
  - `selectFunctions()` - Complete pipeline (lines 417-447)

### Function Registry
- `/apps/backend-api/services/functionRegistry.js`
  - O(1) function lookup via Map
  - Loads all 1400+ functions ONCE at startup
  - Pre-converts to Claude format for faster access

### Supporting Services
- `/apps/backend-api/services/agentServiceV4.js` - Function execution
- `/apps/backend-api/services/utils/aiHelpers.js` - Function registry source
- `/apps/backend-api/services/agentSystemPrompt.js` - Static system prompt with all function names

---

## Future Optimizations

1. **Function Caching by Category**: Group functions by specialty
2. **Contextual Pruning**: Remove irrelevant functions based on patient condition
3. **Multi-Agent Orchestration**: Separate agents for diagnosis vs treatment
4. **Batch Tool Execution**: Execute multiple non-dependent tools in parallel
5. **Extended Thinking**: Use Claude's extended thinking for complex diagnoses

