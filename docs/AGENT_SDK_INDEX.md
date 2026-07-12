# IntelliCare Agent SDK - Complete Documentation Index

## Quick Start

**Main Documentation**:
- **AGENT_SDK_TECHNICAL_OVERVIEW.md** - Comprehensive technical guide (this file provides full details)
- **AGENT_SDK_ARCHITECTURE.md** - Visual architecture diagrams and flows
- **Summary** - One-page executive summary below

**Main Service File**:
- `/apps/backend-api/services/agentSDKService.js` (1158 lines) - Entry point

---

## One-Page Executive Summary

The Agent SDK Service implements a **two-stage agentic loop** that enables autonomous medical decision-making:

### Stage 1: Function Selection (1-2 seconds)
- Input: User query + conversation history
- Claude analyzes which functions are needed
- Output: 3-5 selected function names
- Token savings: 126x reduction (500 vs 63,000 tokens)

### Stage 2: Function Execution (4-8 seconds)
- Get full definitions for selected functions only
- Enter agentic loop: Claude calls tools → Backend executes → Claude sees results → Decides next action
- Stream response token-by-token to frontend
- Repeat until Claude generates final response (max 15 loops)

### Key Features
1. **Real-time Streaming**: Token-by-token text delivery with thinking blocks
2. **Prompt Caching**: 95% cost reduction on cached requests (ephemeral 5-min TTL)
3. **Smart AI Collection Skipping**: Prevents Claude from reading its own AI-generated insights
4. **Artifact Panel Integration**: Large documents (40-60KB) go to split-screen editor, summaries to Claude
5. **Background Processing**: Document analysis via Claude Batch API (1M token context)
6. **Token Budget Enforcement**: MAX_CONVERSATION_TOKENS: 180,000

### Performance
- **Latency**: 5-10 seconds total (1-2s selection + 4-8s execution)
- **First token**: ~500ms (streaming starts immediately)
- **Token usage**: 15,000 first request, 1,500 cached (90% savings)
- **Cost**: $0.045 first, $0.0045 cached
- **Functions handled**: 1400+ medical functions

---

## Documentation Files

### Architecture & Design
1. **AGENT_SDK_TECHNICAL_OVERVIEW.md** (28KB)
   - Complete architecture overview
   - Two-stage selection deep dive
   - Real-time streaming implementation
   - Prompt caching strategy
   - Function selection logic
   - AI collection skipping
   - Performance metrics
   - Critical implementation details

2. **AGENT_SDK_ARCHITECTURE.md** (30KB)
   - Visual system architecture diagram
   - Data flow diagram
   - Token flow diagram (prompt caching)
   - AI collection skipping flow
   - Artifact panel integration flow
   - Performance timeline

3. **AGENT_SDK_INDEX.md** (this file)
   - Documentation index
   - Quick reference
   - File guide

### Code References

#### Main Service (agentSDKService.js)
- **Lines 1-55**: Initialization and constructor
- **Lines 113-217**: Entry point and Stage 1 integration
- **Lines 236-479**: Token budget and system prompt
- **Lines 484-896**: Agentic loop implementation
  - **529-580**: Streaming implementation
  - **599-860**: Tool execution
  - **661-714**: AI collection skipping
  - **717-746**: Background processing handling
  - **748-814**: Direct return handling
- **Lines 969-1024**: Tool definition building
- **Lines 1031-1060**: Selected tools retrieval
- **Lines 1094-1133**: Tool execution (executeTool method)

#### Two-Stage Selector (claudeTwoStageSelector.js)
- **Lines 40-59**: getAllFunctionNames()
- **Lines 67-332**: selectFunctionNames() - Stage 1 implementation
- **Lines 338-364**: getSelectedFunctions() - Stage 2 implementation
- **Lines 417-447**: selectFunctions() - Complete pipeline

#### Function Registry (functionRegistry.js)
- **Lines 1-27**: Constructor and initialization
- **Lines 33-99**: _doInitialize() - Load all 1400 functions
- **Lines 107-128**: getFunction() - O(1) lookup
- **Lines 136-150**: getFunctions() - Batch lookup
- **Lines 170-200**: convertToClaudeFormat() - Schema conversion

---

## Key Implementation Patterns

### Pattern 1: Streaming to Frontend
```javascript
const stream = await this.anthropic.messages.stream(apiPayload);

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    if (event.delta?.type === 'text_delta') {
      // Send immediately (true streaming)
      onChunk({ type: 'chunk', content: event.delta.text });
    }
  }
}
```

### Pattern 2: Prompt Caching
```javascript
system: [
  {
    type: 'text',
    text: systemPrompt,  // ~10K tokens
    cache_control: { type: 'ephemeral' }  // Cache for 5 minutes
  }
]
```

### Pattern 3: AI Collection Skipping
```javascript
if (isAICollection) {
  // Send empty result to Claude
  toolResults.push({
    type: 'tool_result',
    tool_use_id: block.id,
    content: JSON.stringify({ success: true, message: '...' })
  });
  // Send full data to artifact panel
  artifactPanelData = { displayType: 'openArtifactPanel', artifactPanel: {...} };
  continue;  // Skip from token count
}
```

### Pattern 4: Token Budget Tracking
```javascript
const messagesJson = JSON.stringify(messages);
const currentMessageTokens = Math.ceil(messagesJson.length / 4);
const estimatedTotalTokens = currentMessageTokens + OVERHEAD_TOKENS;

if (estimatedTotalTokens > MAX_CONVERSATION_TOKENS) {
  break;  // Stop loop
}
```

---

## Function Selection Decision Tree

```
User Query + History
    ↓
Is response purely conversational (no tools needed)?
    ├─ YES: Return empty array → Claude responds directly
    └─ NO: Continue
    ↓
Is this a CSV upload?
    ├─ patients → Select importPatientsFromCSV
    ├─ users → Select importUsersFromCSV
    └─ document/error → Select analyzeUploadedDocuments or error response
    ↓
Does message contain "recommendations" keyword?
    └─ YES: Select ACTION functions (prescribeMedication, scheduleFollowUp)
    ↓
Does message contain "Apply" or implementation keywords?
    └─ YES: Select specific action functions
    ↓
Does message mention patient by name?
    └─ YES: Include searchPatientsByName FIRST
    ↓
Does message ask for "what data exists"?
    └─ YES: Select getAvailableMedicalData
    ↓
Default: Select 3-5 functions most relevant to query
```

---

## Performance Metrics Quick Reference

| Metric | Value |
|--------|-------|
| Stage 1 time | 1-2 seconds |
| Stage 2 time | 4-8 seconds |
| Total latency | 5-10 seconds |
| First token | ~500ms |
| Functions selected | 3-5 per request |
| Token usage (first) | 15,000 tokens |
| Token usage (cached) | 1,500 tokens |
| Cost (first) | $0.045 |
| Cost (cached) | $0.0045 |
| Cost savings | 90% with caching |
| Function registry lookup | <0.1ms (O(1)) |
| Batch lookup (3-8) | <1ms |
| Memory (registry) | ~50MB |
| Memory (per request) | 1-5MB |
| Max conversation tokens | 180,000 |
| Overhead tokens | 20,000 |
| Model | claude-sonnet-4-5-20250929 |
| Max tokens per loop | 4,096 |
| Temperature | 1.0 (thinking enabled) |
| Max loops | 15 |
| Cache TTL | 5 minutes (ephemeral) |

---

## Artifact Panel Categories Handled

**AI-Generated Collections** (skipped from Claude):
- clinical_decision_support
- intelligent_recommendations
- medication_optimization
- patient_specific_care_plan
- follow_up_intelligence
- trending_analysis
- patient_education_context
- guideline_compliance
- quality_metrics
- care_gaps
- outcomes_prediction

**Medical Collections** (sent to artifact panel):
- medications_list
- lab_results
- imaging_reports
- appointments
- vaccination_records
- prescriptions
- diagnoses
- allergies
- consultation_notes
- discharge_summaries
- And 180+ more

---

## Common Issues & Solutions

### Issue 1: Function Not Found in Registry
**Symptom**: "Function not found: [name]" error

**Solution**:
1. Check function name spelling (case-sensitive)
2. Verify in aiHelpers.getAllPlatformFunctions()
3. Check functionRegistry initialization completed

### Issue 2: No Functions Selected (Empty Array)
**Symptom**: Claude returns [] and responds conversationally

**Reason**: Claude decided no tools are needed for this query

**Solution**: This is correct behavior - Claude is answering directly

### Issue 3: Artifact Panel Not Opening
**Symptom**: Artifact panel doesn't appear despite returned data

**Solution**: Function must return:
```javascript
{
  displayType: 'openArtifactPanel',  // REQUIRED
  artifactPanel: {                  // REQUIRED
    category: 'collection_name',
    displayName: 'Friendly name',
    data: {...}
  }
}
```

### Issue 4: Token Budget Exceeded
**Symptom**: Agentic loop stops early, response incomplete

**Solution**:
1. Reduce conversation history (max 20 messages)
2. Enable AI collection skipping (saves 34K tokens)
3. Use directReturn: true for large documents
4. Request simpler queries with fewer tools

### Issue 5: Streaming Delays
**Symptom**: Text takes a long time to appear

**Solution**:
1. Check network latency
2. Verify SSE connection is stable
3. Check frontend isn't buffering chunks
4. Monitor Claude API response times

---

## File Locations

**Core Service**:
- `/apps/backend-api/services/agentSDKService.js`

**Two-Stage Selection**:
- `/apps/backend-api/services/claudeTwoStageSelector.js`

**Function Registry**:
- `/apps/backend-api/services/functionRegistry.js`

**Function Execution**:
- `/apps/backend-api/services/agentServiceV4.js`

**Function Definitions**:
- `/apps/backend-api/services/utils/aiHelpers.js`
- `/apps/backend-api/services/optimizedMedicalFunctions.js`
- `/apps/backend-api/services/generatedMedicalFunctions.js`

**System Prompt**:
- `/apps/backend-api/services/agentSystemPrompt.js`

**API Routes**:
- `/apps/backend-api/routes/agent.js`

**Security & Access**:
- `/apps/backend-api/services/secureDataAccess.js`
- `/apps/backend-api/services/serviceAccountManager.js`

**Database Models**:
- `/apps/backend-api/models/Patient.js`
- `/apps/backend-api/models/User.js`

---

## Debug Logs to Watch

```
[Agent] ========== STARTING AGENTIC LOOP SESSION ==========
[Agent] User Message: "..."
[Agent] ========== STAGE 1: Function Selection ==========
[Agent] Stage 1 selected X functions: [list]
[Agent] ========== STAGE 2: Tool Execution ==========
[Agent] Loop #1: Claude selected N function(s) to execute:
🔧 Claude selected 1 function to execute: [name]
▶️  EXECUTING: [name]
✅ COMPLETED: [name]
📊 LOOP #1 SUMMARY
   Tools executed: N
   Tokens added: X
   Token budget: Y% used
[Agent] 🛑 Loop #X: Claude finished (stop_reason=end_turn)
[Agent] ========== SESSION COMPLETE ==========
```

---

## Future Enhancements

1. **Function Caching by Category** - Group by specialty (cardiology, pediatrics)
2. **Contextual Pruning** - Remove irrelevant functions based on patient condition
3. **Multi-Agent Orchestration** - Separate agents for diagnosis vs treatment
4. **Batch Tool Execution** - Execute multiple non-dependent tools in parallel
5. **Extended Thinking** - Use Claude's extended thinking for complex diagnoses
6. **Function Bundling** - Combine related functions for faster selection

---

## References

- **Anthropic API**: https://docs.anthropic.com
- **Claude Sonnet 4.5**: Latest model for medical reasoning
- **Prompt Caching**: 5-minute ephemeral cache for cost reduction
- **Tool Use**: Direct function execution in Node.js
- **Streaming**: Server-sent events (SSE) to frontend

