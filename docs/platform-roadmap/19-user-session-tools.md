# Task 19: Add User Session Management Tools

## Priority: MEDIUM
## Category: Phase 4 - Agent Capability Gaps
## Dependencies: None

## Background

Administrators need to manage active user sessions - see who's logged in, force logout a user (security incident), and view session history. The platform has session infrastructure (`secureSessionManager.js`, `sessionCache.js`) but no agent tools to manage sessions.

## What Already Exists

### Session Infrastructure
- `secureSessionManager.js` - Session management with encryption
- `sessionCache.js` - Session caching
- JWT-based authentication
- Session data stored in MongoDB

### Security Tools
- `getSecurityEvents` - View security events
- `getAuditLogs` - Audit trail
- `blockIP` / `unblockIP` - IP management

## What Needs to Be Done

### Step 1: Add Session Management Functions
In `secureSessionManager.js` or new `sessionManagementService.js`:
- `getActiveSessions()` - List all currently active sessions (userId, loginTime, IP, device)
- `getUserSessions(userId)` - Get sessions for a specific user
- `forceLogout(userId)` - Terminate all sessions for a user
- `forceLogoutSession(sessionId)` - Terminate a specific session
- `getSessionHistory(userId, dateRange)` - Login/logout history
- `getLoginFailures(dateRange)` - Failed login attempts
- `unlockUser(userId)` - Unlock account locked after failed attempts

### Step 2: Add Agent Tools
- `getActiveUserSessions` - "See who is currently logged in"
- `forceUserLogout` - "Force a user to log out (all sessions)"
- `getUserLoginHistory` - "View login/logout history for a user"
- `getFailedLoginAttempts` - "View failed login attempts (security monitoring)"
- `unlockUserAccount` - "Unlock a user account that was locked after failed login attempts"

### Step 3: Test via Chat
- "Who is currently logged in?"
- "Force Dr. Smith to log out"
- "Show me login history for nurse Mary"
- "Are there any failed login attempts today?"
- "Unlock John's account"

## Files to Modify
1. `apps/backend-api/services/secureSessionManager.js` - New functions
2. Standard agent wiring files

## Notes
- Force logout is important for security incidents
- Login failure monitoring is a HIPAA requirement
- Account unlock prevents unnecessary password resets
