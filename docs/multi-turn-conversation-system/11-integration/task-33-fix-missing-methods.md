# Task 33: Fix Missing Methods

## Objective
Add missing methods that are called but not implemented

## Missing Methods Identified
1. `agentServiceWrapper.processWithClaude()`
   - Called from: routes/agent.js line 3643
   - Used by: /api/agent/process-text endpoint

## Implementation Requirements
1. Add processWithClaude method to agentServiceWrapper
2. Method should route to Claude service
3. Maintain same signature as expected
4. Include proper error handling

## Method Signature
```
async processWithClaude(text, sessionId, language)
```

## Should Return
```
{
  success: boolean,
  response: string,
  toolUsed: string,
  toolResult: any,
  error?: string
}
```

## Success Criteria
- [ ] Method implemented
- [ ] /api/agent/process-text endpoint works
- [ ] Proper error handling added
- [ ] Returns expected format