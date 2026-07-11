# Task 108: Refactor callAPI to SecureDataAccess

**Status:** ❌ Not Started
**File:** agentServiceV4.js
**Line:** 12729
**Endpoint:** POST /practice-auth/rotate/${args.practiceId}

## Current Implementation
```javascript
// Line 12729
return await this.callAPI(`/practice-auth/rotate/${args.practiceId}`, 'POST', {}, practiceContext);
```

## Analysis Needed
- [ ] Determine if this is a database operation or infrastructure service
- [ ] If database: Identify collection(s) and refactor to SecureDataAccess
- [ ] If infrastructure: Mark as "INFRASTRUCTURE" and keep as callAPI
- [ ] If external service: Mark as "EXTERNAL SERVICE" and keep as callAPI

## Notes
<!-- Add implementation notes here -->
