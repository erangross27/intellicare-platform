# 🎯 IntelliCare MCP Split Mode Strategy

## Current Status: API Mode Only
**Note**: MCP integration was attempted but removed due to authentication issues with Claude Code CLI when called from Node.js. This document describes the planned hybrid approach for future reference.

## How Split Mode Would Work:

### 1. Authentication Flow (Uses API - Required for Login)
- **Service**: `authAIService.js`
- **Mode**: API (using tokens)
- **Why**: Auth functions require immediate availability, no CLI dependency
- **When**: Login, signup, OTP verification, magic links
- **Cost**: Minimal (~$0.001 per login)
- **Functions**: 
  - `loginUser` - User authentication
  - `signupUser` - New user registration
  - `verifyOTP` - OTP code verification
  - `createNewClinic` - Practice onboarding

### 2. Main Application (Would Use MCP - Your Subscription)
- **Service**: `agentServiceClaude.js`
- **Mode**: MCP (would use your Claude Pro/Team subscription)
- **Why**: Leverage subscription for unlimited usage
- **When**: After login - all medical operations
- **Cost**: $0 additional (covered by subscription)
- **Functions**: 235+ medical and administrative functions

## The Flow:

```
1. User opens app → Types "Login"
   ↓
2. authAIService (API mode) → Handles authentication
   ↓ (minimal cost ~$0.001)
3. User logged in → Types "Create new patient"
   ↓
4. agentServiceClaude (MCP mode) → Uses your subscription
   ↓ (no cost - subscription)
5. All medical operations use MCP/subscription
```

## Cost Analysis:

### Current (API Only):
- **Per operation**: ~$0.05-0.10 (depending on complexity)
- **Daily (100 operations)**: ~$5-10
- **Monthly (3000 operations)**: ~$150-300
- **Per doctor**: Direct API costs

### With MCP Split Mode:
- **Login/Signup**: ~$0.001 per operation (API)
- **Medical operations**: $0 (MCP subscription)
- **Daily (100 operations)**: ~$0.01 (auth only)
- **Monthly**: ~$0.30 (auth only)
- **Savings**: **99.9% reduction in API costs**

### Business Model:
- **Doctor pays**: $200/month for IntelliCare
- **Claude Team subscription**: $25-30/month per doctor
- **Profit margin**: $170/month per doctor
- **Development savings**: Use personal Max subscription ($100/month)

## Configuration:

### Current Setup (API Mode):
```env
USE_MCP_MODE=false  # Using API mode due to CLI authentication issues
```
- `authAIService.js` → Uses API 
- `agentServiceClaude.js` → Uses API
- **Status**: Working but incurring API costs

### Future MCP Split Setup:
```env
USE_MCP_MODE=true  # Enable MCP for main operations
USE_API_FOR_AUTH=true  # Keep auth on API for reliability
```
- `authAIService.js` → Would use API (auth only)
- `agentServiceClaude.js` → Would use MCP (medical operations)
- **Blocker**: Claude Code CLI authentication when called from Node.js

## Why This Works:

1. **Authentication is rare**: Users login once per session
2. **Medical operations are frequent**: Hundreds of operations after login
3. **99% of costs were from medical operations**: Now free with MCP
4. **Auth stays reliable**: Using proven API for critical auth flow

## Testing:

1. **Test login** (will use API):
   - Type: "Login"
   - See: "📡 [Auth AI] Calling Claude API"
   - Cost: ~$0.001

2. **Test medical operations** (will use MCP):
   - After login, type: "Search patients with diabetes"
   - See: "🤖 Processing via MCP (Max subscription)"
   - Cost: $0

## Technical Challenges Encountered:

### 1. Windows Command Line Limits
- **Issue**: System prompts + 235 functions exceed 8191 character limit
- **Attempted Solution**: Write prompt to temp file, pipe to Claude CLI
- **Result**: Worked around length issue but hit authentication problem

### 2. Claude Code CLI Authentication
- **Issue**: CLI couldn't authenticate when called from Node.js subprocess
- **Error**: "Invalid API key · Fix external API key"
- **Attempted Fixes**:
  - Set HOME, USERPROFILE, APPDATA environment variables
  - Added npm directory to PATH
  - Tried various subprocess configurations
- **Result**: Authentication consistently failed from Node.js

### 3. Process Integration
- **Issue**: Claude Code expects interactive terminal environment
- **Challenge**: Node.js subprocess doesn't provide same auth context
- **Impact**: MCP mode unusable for production automation

## Lessons Learned:

1. **MCP is designed for interactive use** - Works great in terminal, not from apps
2. **API remains most reliable** - Direct API calls work consistently
3. **Hybrid approach has merit** - Split between auth (API) and operations (MCP)
4. **Cost savings potential exists** - 99.9% reduction theoretically achievable
5. **Implementation complexity** - MCP integration requires solving CLI auth

## Current Recommendation:

Stay with API mode until:
1. Claude provides programmatic MCP SDK (not just CLI)
2. Authentication can be passed to subprocess reliably
3. Official Node.js MCP client library is available

## Summary:

- **Current**: Full API mode (working, stable, but with costs)
- **Attempted**: MCP integration (failed due to CLI auth issues)
- **Future**: Wait for official MCP SDK or authentication solution
- **Business Model**: Still viable with API, just higher operational costs