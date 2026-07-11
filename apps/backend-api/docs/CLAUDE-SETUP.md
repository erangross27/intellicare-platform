# Claude API Setup for IntelliCare

## Using Claude Sonnet 4 (Latest Model)
Now using **Claude Sonnet 4** (`claude-sonnet-4-20250514`) - the latest high-performance model with exceptional reasoning and efficiency.

## Why Claude?
After extensive testing, we found that Gemini's function calling is unreliable:
- It doesn't understand natural language context well
- It asks for unnecessary parameters (like "reason for deletion")
- It fails to handle conversational flows naturally
- It often greets users instead of performing requested actions

Claude Sonnet 4 provides:
- Superior natural language understanding
- Better function calling that "just works"
- More natural conversational flow
- Proper context preservation across multi-step operations

## Setup Instructions

### 1. Get Claude API Key
1. Go to https://console.anthropic.com/
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-api03-...`)

### 2. Configure Environment Variables
Add these to your `.env` file:
```env
# Enable Claude instead of Gemini
USE_CLAUDE=true

# Your Claude API key
CLAUDE_API_KEY=sk-ant-api03-YOUR-KEY-HERE
```

### 3. Restart Server
```bash
cd backend
node server.js
```

You should see:
```
🤖 Using Claude Sonnet 4 for natural language understanding
```

### 4. Test Claude
Run the test script:
```bash
node test-claude-operations.js
```

## Switching Back to Gemini
Simply remove or set to false:
```env
USE_CLAUDE=false
# or just remove the line
```

## Cost Comparison
- **Gemini 2.5 Flash**: $0.075 per 1M tokens
- **Claude Sonnet 4**: $3 input / $15 output per 1M tokens (same as 3.5)

While Claude is more expensive, it actually works correctly for function calling.

## Features That Work Better with Claude
1. **Patient Deletion**: No longer asks for "reason"
2. **Patient Creation**: Asks naturally for information
3. **Document Upload**: Understands context properly
4. **Updates**: Handles partial updates naturally
5. **Search**: Understands names vs IDs intuitively

## Implementation Details
- Service: `backend/services/agentServiceClaude.js`
- Wrapper: `backend/services/agentServiceWrapper.js`
- Test: `backend/test-claude-operations.js`

The implementation:
- Uses proper tool_use and tool_result flow
- Sends results back to Claude for natural responses
- Maintains conversation history
- Calculates costs in ILS for Israeli practices
- Reuses all existing functions from agentServiceV4

## Troubleshooting

### "Claude agent error: 401"
Your API key is invalid. Check CLAUDE_API_KEY in .env

### Still using Gemini
1. Check USE_CLAUDE=true is set
2. Check CLAUDE_API_KEY is set
3. Restart the server

### Function not executing
This shouldn't happen with Claude, but if it does:
1. Check console logs for tool execution
2. Verify function exists in getCoreFunctions()
3. Check executeFunction() handles the function name