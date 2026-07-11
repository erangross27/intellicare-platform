# Agent Execution Logging Integration Guide

## Problem Statement
Currently, thinking messages are disappearing after the final response. Users can't debug why agent failed to find a patient or understand the agent's decision-making process. All execution details are lost after the SSE stream closes.

## Solution Architecture

### 1. New Agent Execution Log Service
**File**: `/apps/backend-api/services/agentExecutionLogService.js` (CREATED ✅)

Provides:
- Structured logging of all thinking messages
- Function call tracking (params, results, duration, errors)
- Error tracking (type, message, context, stack)
- Fallback mechanism logging
- Execution statistics (duration, success rate, function count)

### 2. Integration Points (REQUIRED)

#### A. Start Execution Log (in processChatMessage - line 634)
```javascript
// AFTER line 812 (after security validation)
const AgentExecutionLogService = require('./agentExecutionLogService');

const executionLogId = await AgentExecutionLogService.createExecutionLog(
  sessionId,
  practiceContext?.currentUser?.id || practiceContext?.user?.id,
  messageText,
  context
);

// Store in session for later reference
session.executionLogId = executionLogId;
let thinkingMessageOrder = 0;
```

#### B. Log Each Thinking Message (at line 2924 and each onChunk thinking)
```javascript
// BEFORE each: onChunk({ type: 'thinking', content: ... })

if (session.executionLogId) {
  await AgentExecutionLogService.logThinkingMessage(
    session.executionLogId,
    content.thinking || thinkingContent,
    thinkingMessageOrder++,
    context
  ).catch(err => console.error('Failed to log thinking:', err));
}

// THEN send the chunk
onChunk({ type: 'thinking', content: ... });
```

#### C. Log Function Calls (in agentServiceV4.executeFunction)
```javascript
// After function executes with result and duration
if (session?.executionLogId) {
  await AgentExecutionLogService.logFunctionCall(
    session.executionLogId,
    functionName,
    params,
    result,
    duration,
    !error,  // success = !error
    error?.message || null,
    context
  ).catch(err => console.error('Failed to log function call:', err));
}
```

#### D. Log Errors (when error occurs)
```javascript
// When error caught during function execution
if (session?.executionLogId) {
  await AgentExecutionLogService.logError(
    session.executionLogId,
    'function_error' || 'timeout' || 'validation_error',
    error.message,
    `Function: ${functionName}`,
    context
  ).catch(err => console.error('Failed to log error:', err));
}
```

#### E. Log Fallbacks (when using fallback)
```javascript
// When using fallback mechanism
if (session?.executionLogId) {
  await AgentExecutionLogService.logFallback(
    session.executionLogId,
    'cache_hit' || 'economy_mode' || 'backup_service',
    'Patient not found in primary service',
    { usedService: 'backup', duration: 500 },
    context
  ).catch(err => console.error('Failed to log fallback:', err));
}
```

#### F. Complete Execution Log (before sendChunk done)
```javascript
// BEFORE: sendChunk({ type: 'done', data: result });

await AgentExecutionLogService.completeExecutionLog(
  session.executionLogId,
  result.success === true,  // boolean
  result.message || 'Execution completed',
  result,
  context
).catch(err => console.error('Failed to complete execution log:', err));

sendChunk({ type: 'done', data: result });
```

### 3. Database Schema (Auto-created)

**Collection**: `agent_execution_logs`

```javascript
{
  executionLogId: "exec_1728901234567_abc12345",
  sessionId: "practice_session_123",
  userId: "user_456",
  initialMessage: "Show me patient John's medications",

  // Status tracking
  status: "completed|failed|in_progress",
  startTime: ISODate("2025-10-18T10:30:00Z"),
  endTime: ISODate("2025-10-18T10:30:05Z"),
  totalDuration: 5000,

  // Thinking messages (in order)
  thinkingMessages: [
    {
      timestamp: ISODate("2025-10-18T10:30:00Z"),
      order: 0,
      content: "User is asking for patient medications...",
      length: 45
    },
    {
      timestamp: ISODate("2025-10-18T10:30:01Z"),
      order: 1,
      content: "I need to search for this patient first.",
      length: 50
    }
  ],

  // Function calls with full details
  functionCalls: [
    {
      timestamp: ISODate("2025-10-18T10:30:01Z"),
      functionName: "findPatient",
      params: { name: "John", nationalId: "[REDACTED]" },
      resultSummary: "Found patient with ID 123",
      duration: 150,
      success: true,
      error: null,
      resultSize: 245
    },
    {
      timestamp: ISODate("2025-10-18T10:30:02Z"),
      functionName: "getMedications",
      params: { patientId: "123" },
      resultSummary: "Array with 5 items",
      duration: 200,
      success: true,
      error: null,
      resultSize: 1250
    }
  ],

  // Errors encountered
  errors: [
    {
      timestamp: ISODate("2025-10-18T10:30:03Z"),
      type: "validation_error",
      message: "Invalid date format",
      context: "Function: parseDate",
      stack: "..."
    }
  ],

  // Fallbacks used
  fallbacks: [
    {
      timestamp: ISODate("2025-10-18T10:30:04Z"),
      type: "cache_hit",
      reason: "Patient search already cached",
      details: { usedService: "redis", ttl: 3600 }
    }
  ],

  // Final result
  finalStatus: "Successfully retrieved 5 medications",
  resultSummary: { keys: ['medications', 'patient'], hasError: false, hasData: true },

  // Metadata
  metadata: {
    functionCount: 2,
    errorCount: 1,
    fallbackCount: 1,
    thinkingMessageCount: 5
  },

  createdAt: ISODate("2025-10-18T10:30:00Z"),
  updatedAt: ISODate("2025-10-18T10:30:05Z")
}
```

### 4. Frontend Updates (OPTIONAL - for displaying logs)

#### A. Add log retrieval endpoint
```javascript
// GET /api/agent/execution-logs/:executionLogId
// Returns full execution log with all details
```

#### B. Add log viewer component
```javascript
// Display thinking messages in order
// Show function call timeline
// Show errors with context
// Show fallbacks used
```

### 5. Implementation Checklist

- [ ] **agentExecutionLogService.js** - Created (services/agentExecutionLogService.js)
- [ ] **agentServiceClaude.js line 634** - Add execution log creation
- [ ] **agentServiceClaude.js lines 2924+** - Add thinking message logging before each onChunk call
- [ ] **agentServiceV4.js executeFunction** - Add function call logging
- [ ] **agentServiceClaude.js line ~2924** - Add error logging in catch blocks
- [ ] **agentServiceClaude.js line ~2924** - Add fallback logging
- [ ] **agentServiceClaude.js before sendChunk done** - Add completion logging
- [ ] **routes/agent.js** - Add GET endpoint for logs
- [ ] **Frontend** - Create log viewer (optional)
- [ ] **Test** - Run full conversation and verify log creation

### 6. Usage Example

```javascript
// User asks: "Show me John's medications"

// Backend executes:
// 1. Creates execution log
// 2. Logs thinking: "User asking for medications..."
// 3. Logs function call: findPatient("John") → found patient 123
// 4. Logs function call: getMedications(123) → 5 medications
// 5. Logs thinking: "Found medications, preparing response"
// 6. Completes execution log with status="completed"

// If patient not found:
// 1. Creates execution log
// 2. Logs thinking: "Searching for patient..."
// 3. Logs function call: findPatient("John") → ERROR: Not found
// 4. Logs error: "Patient not found in database"
// 5. Logs fallback: "Using fuzzy search..."
// 6. Logs function call: fuzzySearchPatients("John") → 0 results
// 7. Logs error: "No patient found with fuzzy search either"
// 8. Completes execution log with status="failed"
```

### 7. Data Retrieval Patterns

#### Get all thinking messages from an execution
```javascript
const log = await AgentExecutionLogService.getExecutionLog(executionLogId, context);
console.log(log.thinkingMessages.map(m => m.content).join('\n'));
```

#### Get function execution timeline
```javascript
const log = await AgentExecutionLogService.getExecutionLog(executionLogId, context);
console.log(log.functionCalls.map(f => `${f.functionName}: ${f.duration}ms - ${f.success ? 'OK' : 'FAILED'}`).join('\n'));
```

#### Get execution statistics
```javascript
const stats = await AgentExecutionLogService.getExecutionStatistics('userId', userId, context);
console.log(`Success rate: ${stats.successRate}%`);
console.log(`Average duration: ${stats.averageDuration}ms`);
console.log(`Total function calls: ${stats.totalFunctionCalls}`);
```

### 8. Non-Breaking Implementation

All logging is **non-blocking**:
- If logging fails, it doesn't interrupt the agent execution
- All logging operations are wrapped in `.catch()` to ignore errors
- No changes to existing function signatures
- No changes to response format
- Backward compatible with existing frontend

### 9. Next Steps

1. Add the 6 integration points listed in Section 2
2. Test with a simple "find patient" query
3. Verify logs appear in database
4. Add frontend endpoint to retrieve logs
5. Create log viewer UI (optional but helpful for debugging)

## Impact

This solution will:
✅ **Preserve all thinking messages** - Never lost after SSE stream
✅ **Track function execution** - Know exactly which functions called, params, results, duration
✅ **Document failures** - Why agent failed and what was attempted
✅ **Enable debugging** - Full execution trace for support team
✅ **Support analytics** - Understand agent performance patterns
✅ **Help optimization** - See which functions take too long
✅ **Non-breaking** - Zero changes to existing API/frontend
